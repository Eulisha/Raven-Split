require('dotenv').config();
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const Admin = require('../models/admin_model');
const User = require('../models/user_model');
const GraphHandler = require('../util/graph_handler');
const { updateBalance } = require('../util/balance_handler');
const { updatedBalanceGraph } = require('../util/bundle_getter');
const { produceSqsJob } = require('../util/sqs_producer');
const Mapping = require('../config/mapping');

const postDebt = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@postDebt: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const debtMain = req.body.debt_main; //{date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();

    try {
        //1) MYSQL 新增raw data
        const debtMainId = await Debt.createDebt(conn, gid, debtMain);
        if (!debtMainId) {
            throw new Error('Internal Server Error');
        }
        const detailIds = await Debt.createDebtDetail(conn, debtMainId, debtDetail);
        if (!detailIds) {
            throw new Error('Internal Server Error');
        }

        //2-1) MYSQL balance table 加入新的帳
        const updateBalanceResult = await updateBalance(conn, gid, debtMain, debtDetail);
        if (!updateBalanceResult) {
            throw new Error('Internal Server Error');
        }

        //2-2) NEO4j best path graph 查出舊帳並加入新帳更新
        const updateGraphEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMain, debtDetail);
        if (!updateGraphEdgeesult) {
            console.error(updateGraphEdgeesult);
            throw new Error('Internal Server Error');
        }

        //2-3) 增加hasNewData
        await Admin.addNewDataAmount(conn, gid);

        //2-4) SQS建立Job
        const currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
        if (currNewDataAmount[0].hasNewData > 5) {
            await produceSqsJob(gid, process.env.NORMAL_SQS_URL);
        }

        await conn.commit();
        await txc.commit();

        return res.status(200).json({ data: { debtId: debtMainId, detailIds } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
        session.close();
    }
};
const updateDebt = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@updateDebt: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const debtId = Number(req.params.debtId);
    const debtMainNew = req.body.debt_main;
    const debtDetailNew = req.body.debt_detail;

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();

    try {
        //0-1) search if debt exist and get previous debt data for balance and best path usage
        const debtMainOld = await Debt.getDebt(conn, debtId);
        if (!debtMainOld) {
            console.error('@updateDebt: db getDebt fail: ', debtMainOld);
            throw new Error('Internal Server Error');
        }
        const debtDetailOld = await Debt.getDebtDetailTrx(conn, debtId);
        if (!debtDetailOld) {
            console.error('@updateDebt: db getDebtDetailTrx fail: ', debtDetailOld);
            throw new Error('Internal Server Error');
        }
        //找不到或已經更新了
        if (debtMainOld.length === 0 || debtDetailOld.length === 0) {
            console.error('@updateDebt: db getDebt getDebtDetailTrx no match :', debtMainOld.length, debtDetailOld.length);
            conn.rollback();
            return res.status(404).json({ err: 'DebtId not exist' });
        }

        //0-2) mysql set previous debt status to 0
        const status = Mapping.DEBT_STATUS.deprach; //custom update, create new one directly
        const deleteResult = await Debt.deleteDebt(conn, debtId, status);
        if (!deleteResult) {
            throw new Error('Internal Server Error');
        }

        //1) MYSQL create new raw data
        const debtMainId = await Debt.createDebt(conn, gid, debtMainNew);
        if (!debtMainId) {
            throw new Error('Internal Server Error');
        }
        const detailIds = await Debt.createDebtDetail(conn, debtMainId, debtDetailNew);
        if (!detailIds) {
            throw new Error('Internal Server Error');
        }

        //set debt amount reversely stand for delete
        debtDetailOld.forEach((ele, ind) => {
            debtDetailOld[ind].amount = -ele.amount;
        });

        //2-1) mysql update balance
        //平衡包含了先前的那筆帳，所以要先減掉它、然後再加上新的；因為新舊帳牽涉的人不一定是同一個，所以沒辦法先算好，只更新一次
        const oldBalanceResult = await updateBalance(conn, gid, debtMainOld[0], debtDetailOld);
        if (!oldBalanceResult) {
            throw new Error('Internal Server Error');
        }
        const newBalanceResult = await updateBalance(conn, gid, debtMainNew, debtDetailNew);
        if (!newBalanceResult) {
            throw new Error('Internal Server Error');
        }

        //2-2)Neo4j update edge
        const oldEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMainOld[0], debtDetailOld);
        const newEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMainNew, debtDetailNew);

        //2-3) 增加hasNewData
        await Admin.addNewDataAmount(conn, gid);

        //2-4) SQS建立Job
        const currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
        if (currNewDataAmount[0].hasNewData > 5) {
            await produceSqsJob(gid, process.env.NORMAL_SQS_URL);
        }

        await conn.commit();
        await txc.commit();

        return res.status(200).json({ data: { debtId: debtMainId, detailIds } });
    } catch (err) {
        console.error('@updateDebt: err: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
        session.close();
    }
};

const deleteDebt = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@deleteDebt: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const debtId = Number(req.params.debtId);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();

    try {
        //0-1) get previous debt data for balance and best path usage
        const debtMain = await Debt.getDebt(conn, debtId);
        if (!debtMain) {
            console.error('@deleteDebt: db getDebtDet fail: ', debtMain);
            throw new Error('Internal Server Error');
        }
        const debtDetail = await Debt.getDebtDetailTrx(conn, debtId);
        if (!debtDetail) {
            console.error('@deleteDebt: db getDebtDetailTrx fail: ', debtDetail);
            throw new Error('Internal Server Error');
        }
        //找不到或已經更新了
        if (debtMain.length === 0 || debtDetail.length === 0) {
            console.error('@deleteDebt: db  getDebt getDebtDetailTrx no match :', debtMain.length, debtDetail.length);
            conn.rollback();
            return res.status(404).json({ err: 'DebtId not exist' });
        }

        //0-2) mysql set debt status to customer delete
        const status = Mapping.DEBT_STATUS.customer_deleted; //customer delete
        const deleteResult = await Debt.deleteDebt(conn, debtId, status);
        if (!deleteResult) {
            throw new Error('Internal Server Error');
        }
        //set debt amount reversely stand for delete
        debtDetail.forEach((ele, ind) => {
            debtDetail[ind].amount = -ele.amount;
        });
        // 2-1) mysql update balance
        const updateBalanceResult = await updateBalance(conn, gid, debtMain[0], debtDetail); //這裡的debtDetail已經是amount為負的
        if (!updateBalanceResult) {
            throw new Error('Internal Server Error');
        }

        // 2-2) Neo4j update edge
        const updateGraphEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMain[0], debtDetail);
        if (!updateGraphEdgeesult) {
            throw new Error('Internal Server Error');
        }

        //2-3) 增加hasNewData
        await Admin.addNewDataAmount(conn, gid);

        //2-4) SQS建立Job
        const currNewDataAmount = await Admin.getNewDataAmount(conn, gid);
        if (currNewDataAmount[0].hasNewData > 5) {
            await produceSqsJob(gid, process.env.NORMAL_SQS_URL);
        }

        await conn.commit();
        await txc.commit();

        return res.status(200).json({ data: { debtId } });
    } catch (err) {
        console.error('@deleteDebt: err: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
        session.close();
    }
};

const postSettle = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@postSettle: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }

    const uid = req.user.id;
    const gid = Number(req.params.id);
    const { date } = req.body.settle_main;

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();

    try {
        // 1) get group balance from Neo
        const result = await Graph.getGraph(txc, neo4j.int(gid));
        if (!result) {
            console.error('@postSettle: neo4j getGraph fail: ', result);
            throw new Error('Internal Server Error');
        }

        if (result.records.length == 0) {
            console.error('@postSettle: neo4j getGraph no match: ', result.records.length);
            //res之前要先把settle鎖拿掉
            const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
            if (!resultSetSetting) {
                console.error('@postSettle: db setSettleDone fail: ', resultSetSetting);
                throw new Error('Internal Server Error');
            }
            await conn.commit();
            return res.status(404).json({ err: 'No matched result' });
        }

        // 2) MySql clear balance of this pair
        for (let record of result.records) {
            let amount = record.get('amount').toNumber();
            let borrower = record.get('borrower').toNumber();
            let lender = record.get('lender').toNumber();
            if (amount != 0) {
                const userNames = await User.getUserNames(conn, borrower, lender);
                if (!userNames) {
                    console.error('@postSettle: db getUserNames fail: ', userNames);
                    throw new Error('Internal Server Error');
                }
                //因為是還錢所以debtMain的lender值為本來的borrower
                let debtMain = { gid, date, total: amount, lender: borrower, split_method: Mapping.SPLIT_METHOD.full_amount };
                debtMain.title = `Settle Balances Between ${userNames[0].name} ${userNames[1].name}`;
                let debtId = await Debt.createDebt(conn, gid, debtMain);
                if (!debtId) {
                    console.error('@postSettle: db createDebt fail: ', debtId);
                    throw new Error('Internal Server Error');
                }
                let debtDetail = [{ borrower: lender, amount }];
                const createDebtDetailResult = await Debt.createDebtDetail(conn, debtId, debtDetail);
                if (!createDebtDetailResult) {
                    console.error('@postSettle: db createDebtDetail fail: ', createDebtDetailResult);
                    throw new Error('Internal Server Error');
                }
            }
        }
        // 3) MySql clear balance of this pair
        const deleteDebtBalancesResult = await Debt.deleteDebtBalances(conn, gid);
        if (!deleteDebtBalancesResult) {
            console.error('@postSettle: db deleteDebtBalances fail: ', deleteDebtBalancesResult);
            throw new Error('Internal Server Error');
        }

        // 4) Neo4j delete old edges(debt), nodes remained

        //準備開始更新, 更新DB狀態
        await Admin.setProcessingBestGraph(conn, gid, Mapping.BESTGRAPH_STATUS.processing);

        const deleteBestPathResult = await Graph.deleteBestPath(txc, neo4j.int(gid));
        if (!deleteBestPathResult) {
            console.error('@postSettle: neo4j deleteBestPath fail: ', deleteBestPathResult);
            throw new Error('Internal Server Error');
        }

        //結束settle, 更新狀態
        const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        if (!resultSetSetting) {
            throw new Error('Internal Server Error');
        }
        await Admin.setFinishedBestGraph(conn, gid, Mapping.BESTGRAPH_STATUS.finishedProcessing);

        await conn.commit();
        await txc.commit();
        return res.status(200).json({ data: null });
    } catch (err) {
        console.error('@postSettle: err: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
        session.close();
    }
};

const postSettlePair = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@postSettlePair: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const { date } = req.body.settle_main;
    // const title = req.body.settle_main.title || 'Settle Balances Between';
    const gid = Number(req.params.id);
    const uid1 = Number(req.params.uid1);
    const uid2 = Number(req.params.uid2);
    const uid = req.user.id;

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();
    // await session.writeTransaction(async (txc) => {
    try {
        // 1-1) get balance of this pair from MySql
        let balances = await Debt.getAllBalances(conn, gid);
        if (!balances) {
            console.error('@postSettlePair: db getAllBalances fail:', balances);
            throw new Error('Internal Server Error');
        }

        // 1-2) find balance of this pair
        let pairBalance = {};
        for (let i = 0; i < balances.length; i++) {
            if ((balances[i].borrower == uid1 && balances[i].lender == uid2) || (balances[i].borrower == uid2 && balances[i].lender == uid1)) {
                pairBalance = balances[i];
                balances.splice(i, 1); //將balances內該筆刪除，供後面Neo建立graph使用
                break;
            }
        }

        if (!pairBalance.id || pairBalance.amount === 0) {
            //找不到, 代表沒有債務關係、或目前債務為0
            console.error('@postSettlePair: no debt: ', pairBalance);

            //res之前要先把settle鎖拿掉
            const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
            if (!resultSetSetting) {
                console.error('@postSettlePair: db setSettleDone fail:', resultSetSetting);
                throw new Error('Internal Server Error');
            }
            await conn.commit();
            return res.status(404).json({ err: 'Balances not exist.' });
        }

        // 2) MySql create a reverse debt as settle
        let debtMain = { gid, date, total: pairBalance.amount, lender: pairBalance.borrower, split_method: Mapping.SPLIT_METHOD.full_amount }; //因為是還錢所以debtMain的lender值為本來的borrower
        const userNames = await User.getUserNames(conn, pairBalance.lender, pairBalance.borrower); //查user name組title
        if (!userNames) {
            console.error('@postSettlePair: db getUserNames fail:', userNames);
            throw new Error('Internal Server Error');
        }
        debtMain.title = `Settle Balances Between ${userNames[0].name} ${userNames[1].name}`;
        const debtId = await Debt.createDebt(conn, gid, debtMain);
        if (!debtId) {
            console.error('@postSettlePair: db createDebt fail:', debtId);
            throw new Error('Internal Server Error');
        }
        let debtDetail = [{ borrower: pairBalance.lender, amount: pairBalance.amount }];
        const createDebtDetailResult = await Debt.createDebtDetail(conn, debtId, debtDetail);
        if (!createDebtDetailResult) {
            console.error('@postSettlePair: db createDebtDetail fail:', createDebtDetailResult);
            throw new Error('Internal Server Error');
        }
        // 3) MySql clear balance of this pair //也可以是update一筆反向的, 跟刪除結果會是相同
        const deleteDebtBalanceResult = await Debt.deleteDebtBalance(conn, pairBalance.id); //直接把該id的balance帳刪除
        if (!deleteDebtBalanceResult) {
            console.error('@postSettlePair: db deleteDebtBalance fail:', deleteDebtBalanceResult);
            throw new Error('Internal Server Error');
        }

        // 4) Neo4j recreate

        // 4-1) Neo4j delete old edges(debt), nodes remained
        const deleteBestPathResult = await Graph.deleteBestPath(txc, neo4j.int(gid));
        if (!deleteBestPathResult) {
            console.error('@postSettlePair: neo4j deleteBestPath fail: ', deleteBestPathResult);
            throw new Error('Internal Server Error');
        }

        // 4-2) Neo4j recreate(update) edges
        let newMap = balances.map((balance) => {
            // 處理neo的數字 這裡的balance已經去除被settle的pair的帳
            return {
                borrower: neo4j.int(balance.borrower),
                lender: neo4j.int(balance.lender),
                amount: neo4j.int(balance.amount),
            };
        });
        const updateGraphEdgeesult = await Graph.updateEdge(txc, neo4j.int(gid), newMap);
        if (!updateGraphEdgeesult) {
            console.error('@postSettlePair: neo4j updateEdge fail: ', updateGraphEdgeesult);
            throw new Error('Internal Server Error');
        }

        //準備開始更新, 更新DB狀態
        await Admin.setProcessingBestGraph(conn, gid, Mapping.BESTGRAPH_STATUS.processing);
        // 5) Neo4j get all path and calculate
        let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
        if (!debtsForUpdate) {
            console.error('@postSettlePair: neo4j getBestPath fail', debtsForUpdate);
            throw new Error('Internal Server Error');
        }
        // 6) Neo4j update best path graph
        const updateGraph = Graph.updateBestPath(txc, gid, debtsForUpdate);
        if (!updateGraph) {
            console.error('@postSettlePair: neo4j updateBestPath fail: ', updateGraph);
            throw new Error('Internal Server Error');
        }

        //結束settle, 更新狀態
        const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        if (!resultSetSetting) {
            console.error('@postSettlePair: db settledone fail: ', resultSetSetting);
            throw new Error('Internal Server Error');
        }
        await Admin.setFinishedBestGraph(conn, gid, Mapping.BESTGRAPH_STATUS.finishedProcessing);

        await conn.commit();
        await txc.commit();
        return res.status(200).json({ data: updateGraph });
    } catch (err) {
        console.error('@postSettlePair: err: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
        session.close();
    }
};
const postSettleDone = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@postSettleDone: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const uid = req.user.id;
    const gid = Number(req.params.id);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    try {
        //結束settle, 更新狀態
        const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        if (!resultSetSetting) {
            console.error('@postSettleDone: db settledone fail: ', resultSetSetting);
            throw new Error('Internal Server Error');
        }
        return res.status(200).json({ data: null });
    } catch (err) {
        console.error('@postSettleDone: err: ', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    } finally {
        conn.release();
    }
};

module.exports = { postDebt, updateDebt, deleteDebt, postSettle, postSettlePair, postSettleDone };
