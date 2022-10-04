const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const Admin = require('../models/admin_model');
const User = require('../models/user_model');
const GraphHandler = require('../util/graph_handler');
const { updateBalance } = require('../util/balance_handler');
const { updatedBalanceGraph } = require('../util/bundle_getter');
const Mapping = require('../config/mapping');

const postDebt = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const debtMain = req.body.debt_main; //{date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }
    console.info('controller: gid, debtMain, debtDetail:  ', gid, debtMain, debtDetail, req.id);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();
    // await session.writeTransaction(async (txc) => {
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
        console.log('DB到這裡都完成了');

        //2-2) NEO4j best path graph 查出舊帳並加入新帳更新
        const updateGraphEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMain, debtDetail);
        if (!updateGraphEdgeesult) {
            console.error(updateGraphEdgeesult);
            throw new Error('Internal Server Error');
        }
        console.debug('controoler Neo4j更新線的結果：', updateGraphEdgeesult);
        //TODO:處理沒有MATCH的狀況（不會跳error）

        //3)NEO4j取出所有路徑，並計算出最佳解
        const [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
        if (!debtsForUpdate) {
            console.error(debtsForUpdate);
            throw new Error('Internal Server Error');
        }
        //4)NEO4j更新best path graph
        console.debug('debtsForUpdate:  ', debtsForUpdate);
        const updateGraph = await Graph.updateEdge(txc, neo4j.int(gid), debtsForUpdate);
        if (!updateGraph) {
            console.error(updateGraph);
            throw new Error('Internal Server Error');
        }

        // 5)search update result from dbs just for refernce
        const updateResult = await updatedBalanceGraph(conn, txc, gid); //TODO: 如果前端不需要可拿掉;

        await conn.commit();
        await txc.commit();

        return res.status(200).json({ data: { debtId: debtMainId, detailIds, updateResult } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err });
    } finally {
        conn.release();
        session.close();
    }
    // });
};
const updateDebt = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const debtId = Number(req.params.debtId);
    const debtMainNew = req.body.debt_main;
    const debtDetailNew = req.body.debt_detail;
    console.info('controller: gid, debtId, debtMainNew, debtDetailNew', gid, debtId, debtMainNew, debtDetailNew, req.id);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();
    // await session.writeTransaction(async (txc) => {
    try {
        //0-1) search if debt exist and get previous debt data for balance and best path usage
        const debtMainOld = await Debt.getDebt(conn, debtId);
        if (!debtMainOld) {
            console.error('getDebt fail :', debtMainOld);
            throw new Error('Internal Server Error');
        }
        const debtDetailOld = await Debt.getDebtDetailTrx(conn, debtId);
        if (!debtDetailOld) {
            console.error('getDebtDetailTrx fail :', debtDetailOld);
            throw new Error('Internal Server Error');
        }
        //找不到或已經更新了
        if (debtMainOld.length === 0 || debtDetailOld.length === 0) {
            console.error('mysql getDebt getDebtDetailTrx no match :', debtMainOld.length, debtDetailOld.length);
            conn.rollback();
            return res.status(404).json({ err: 'DebtId not exist' });
        }
        console.info('debtMainOld, debtDetailOld', debtMainOld, debtDetailOld);

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
        console.debug('debtDetailOld: ', debtDetailOld);

        //!!下面是要減掉這個帳，所以不應該弄成反的
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
        console.info('start neo4j');
        const oldEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMainOld[0], debtDetailOld);
        const newEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMainNew, debtDetailNew);
        console.debug('Neo4j更新線的結果：', oldEdgeesult);
        console.debug('Neo4j更新線的結果：', newEdgeesult);

        //3)NEO4j取出所有路徑，並計算出最佳解
        let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
        if (!debtsForUpdate) {
            throw new Error('Internal Server Error');
        }
        //4)NEO4j更新best path graph
        console.debug('debtsForUpdate:  ', debtsForUpdate);
        const updateGraph = Graph.updateEdge(txc, gid, debtsForUpdate);
        if (!updateGraph) {
            throw new Error('Internal Server Error');
        }

        // search update result from dbs just for refernce
        const updateResult = updatedBalanceGraph(conn, txc, gid); //TODO: 如果前端不需要可拿掉;

        await conn.commit();
        await txc.commit();

        return res.status(200).json({ data: { debtId: debtMainId, detailIds, updateResult } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        await txc.rollback();

        return res.status(500).json({ err });
    } finally {
        conn.release();
        session.close();
    }
    // });
};

const deleteDebt = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const debtId = Number(req.params.debtId);
    console.info('controller: gid, debtId:', gid, debtId, req.id);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();
    // await session.writeTransaction(async (txc) => {
    try {
        //0-1) get previous debt data for balance and best path usage
        const debtMain = await Debt.getDebt(conn, debtId);
        if (!debtMain) {
            throw new Error('Internal Server Error');
        }
        const debtDetail = await Debt.getDebtDetailTrx(conn, debtId);
        if (!debtDetail) {
            throw new Error('Internal Server Error');
        }
        //找不到或已經更新了
        if (debtMain.length === 0 || debtDetail.length === 0) {
            console.error('mysql getDebt getDebtDetailTrx no match :', debtMain.length, debtDetail.length);
            conn.rollback();
            return res.status(404).json({ err: 'DebtId not exist' });
        }
        console.log('debtMain, debtDetail: ', debtMain, debtDetail);

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
        console.log('Neo4j更新線的結果：', updateGraphEdgeesult);
        //TODO:處理沒有MATCH的狀況（不會跳error）

        // 3) Neo4j get all path and calculate best path
        let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
        if (!debtsForUpdate) {
            throw new Error('Internal Server Error');
        }
        // 4) Neo4j update best path graph
        console.log('debtsForUpdate:  ', debtsForUpdate);
        const updateGraph = Graph.updateEdge(txc, gid, debtsForUpdate);
        if (!updateGraph) {
            throw new Error('Internal Server Error');
        }

        // search update result from dbs just for refernce
        const updateResult = await updatedBalanceGraph(conn, txc, gid);

        await conn.commit();
        await txc.commit();

        return res.status(200).json({ data: { debtId, updateResult } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err });
    } finally {
        conn.release();
        session.close();
    }
    // });
};

const postSettle = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }

    const uid = req.user.id;
    const gid = Number(req.params.id);
    const { date } = req.body.settle_main;
    console.log('controller: uid, gid, data:', uid, gid, date, req.id);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const txc = session.beginTransaction();
    // await session.writeTransaction(async (txc) => {
    try {
        // 1) get group balance from Neo
        const result = await Graph.getGraph(txc, neo4j.int(gid));
        if (!result) {
            console.error('getGraph fail: ', result);
            throw new Error('Internal Server Error');
        }

        if (result.records.length == 0) {
            console.error('getGraph no match: ', result.records.length);
            //res之前要先把settle鎖拿掉
            const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
            if (!resultSetSetting) {
                console.error('setSettleDone fail: ', resultSetSetting);
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
                    console.error('getUserNames fail: ', userNames);
                    throw new Error('Internal Server Error');
                }
                //因為是還錢所以debtMain的lender值為本來的borrower
                let debtMain = { gid, date, total: amount, lender: borrower, split_method: Mapping.SPLIT_METHOD.full_amount };
                debtMain.title = `Settle Balances Between ${userNames[0].name} ${userNames[1].name}`;
                let debtId = await Debt.createDebt(conn, gid, debtMain);
                if (!debtId) {
                    console.log(debtId);
                    throw new Error('Internal Server Error');
                }
                let debtDetail = [{ borrower: lender, amount }];
                const createDebtDetailResult = await Debt.createDebtDetail(conn, debtId, debtDetail);
                if (!createDebtDetailResult) {
                    console.log(createDebtDetailResult);
                    throw new Error('Internal Server Error');
                }
            }
        }
        // 3) MySql clear balance of this pair
        const deleteDebtBalancesResult = await Debt.deleteDebtBalances(conn, gid);
        if (!deleteDebtBalancesResult) {
            console.error(deleteDebtBalancesResult);
            throw new Error('Internal Server Error');
        }
        // 4) Neo4j delete old edges(debt), nodes remained
        const deleteBestPathResult = await Graph.deleteBestPath(txc, neo4j.int(gid));
        if (!deleteBestPathResult) {
            console.error(deleteBestPathResult);
            throw new Error('Internal Server Error');
        }

        //結束settle, 更新狀態
        const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        if (!resultSetSetting) {
            throw new Error('Internal Server Error');
        }

        await conn.commit();
        await txc.commit();
        return res.status(200).json({ data: null });
    } catch (err) {
        console.log('ERROR: ', err);
        await conn.rollback();
        await txc.rollback();
        return res.status(500).json({ err });
    } finally {
        conn.release();
        session.close();
    }
    // });
};

const postSettlePair = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const { date } = req.body.settle_main;
    // const title = req.body.settle_main.title || 'Settle Balances Between';
    const gid = Number(req.params.id);
    const uid1 = Number(req.params.uid1);
    const uid2 = Number(req.params.uid2);
    const uid = req.user.id;
    console.log('controller: uid, uid1, uid2, gid, data:', uid, uid1, uid2, gid, date, req.id);

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
            console.error('getAllBalances fail: ', balances);
            throw new Error('Internal Server Error');
        }

        // //沒查到代表沒有賬務關係
        // if (balances.length === 0) {
        //     console.error('getAllBalances no match: ', balances.length);
        //     //res之前要先把settle鎖拿掉
        //     const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        //     if (!resultSetSetting) {
        //         console.error('setSettleDone fail: ', resultSetSetting);
        //         throw new Error('Internal Server Error');
        //     }
        //     await conn.commit();
        //     return res.status(400).json({ err: 'No matched result' });
        // }

        // 1-2) find balance of this pair
        console.debug(balances);
        let pairBalance = {};
        for (let i = 0; i < balances.length; i++) {
            if ((balances[i].borrower == uid1 && balances[i].lender == uid2) || (balances[i].borrower == uid2 && balances[i].lender == uid1)) {
                pairBalance = balances[i];
                balances.splice(i, 1); //將balances內該筆刪除，供後面Neo建立graph使用
                break;
            }
        }
        console.debug('pairBalance', pairBalance);

        if (!pairBalance.id || pairBalance.amount === 0) {
            //找不到, 代表沒有債務關係、或目前債務為0
            console.error('pariBalance no match: ', pairBalance);

            //res之前要先把settle鎖拿掉
            const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
            if (!resultSetSetting) {
                console.error('settle done result: ', resultSetSetting);
                throw new Error('Internal Server Error');
            }
            await conn.commit();
            return res.status(404).json({ err: 'Balances not exist.' });
        }

        // 2) MySql create a reverse debt as settle
        let debtMain = { gid, date, total: pairBalance.amount, lender: pairBalance.borrower, split_method: Mapping.SPLIT_METHOD.full_amount }; //因為是還錢所以debtMain的lender值為本來的borrower
        const userNames = await User.getUserNames(conn, pairBalance.lender, pairBalance.borrower); //查user name組title
        if (!userNames) {
            console.error('getUserNames fail: ', userNames);
            throw new Error('Internal Server Error');
        }
        debtMain.title = `Settle Balances Between ${userNames[0].name} ${userNames[1].name}`;
        const debtId = await Debt.createDebt(conn, gid, debtMain);
        if (!debtId) {
            console.log(debtId);
            throw new Error('Internal Server Error');
        }
        let debtDetail = [{ borrower: pairBalance.lender, amount: pairBalance.amount }];
        const createDebtDetailResult = await Debt.createDebtDetail(conn, debtId, debtDetail);
        if (!createDebtDetailResult) {
            console.log(createDebtDetailResult);
            throw new Error('Internal Server Error');
        }
        // 3) MySql clear balance of this pair //也可以是update一筆反向的, 跟刪除結果會是相同
        const deleteDebtBalanceResult = await Debt.deleteDebtBalance(conn, pairBalance.id); //直接把該id的balance帳刪除
        if (!deleteDebtBalanceResult) {
            console.error(deleteDebtBalanceResult);
            throw new Error('Internal Server Error');
        }

        // 4) Neo4j recreate
        // 4-1) Neo4j delete old edges(debt), nodes remained
        const deleteBestPathResult = await Graph.deleteBestPath(txc, neo4j.int(gid));
        if (!deleteBestPathResult) {
            console.error(deleteBestPathResult);
            throw new Error('Internal Server Error');
        }

        // 4-1-1) create group on Neo4j
        // 4-1-1-1) get group users
        // const getGroupUserIds = await Admin.getGroupUserIds(gid);
        // if (!getGroupUserIds) {
        //     console.error(getGroupUserIds);
        //     throw new Error('Internal Server Error');
        // }
        // // 4-1-1-2) create group
        // //Neo4j建立節點
        // let map = [];
        // for (let userId of getGroupUserIds) {
        //     // map.push({ name: neo4j.int(member.toSring()) }); //處理neo4j integer
        //     map.push({ name: neo4j.int(userId) }); //處理neo4j integer
        // }
        // const graphResult = await Graph.createNodes(txc, neo4j.int(gid), map);
        // if (!graphResult) {
        //     return res.status(500).json({ err: 'Internal Server Error' });
        // }

        // 4-2) Neo4j recreate(update) edges
        let newMap = balances.map((balance) => {
            // 這裡的balance已經去除被settle的pair的帳
            // 處理neo的數字
            return {
                borrower: neo4j.int(balance.borrower),
                lender: neo4j.int(balance.lender),
                amount: neo4j.int(balance.amount),
            };
        });
        console.debug('controller: for Neo newMap:   ', newMap);
        const updateGraphEdgeesult = await Graph.updateEdge(txc, neo4j.int(gid), newMap);
        if (!updateGraphEdgeesult) {
            console.error(updateGraphEdgeesult);
            throw new Error('Internal Server Error');
        }
        console.debug('controller Neo4j更新線的結果： ', updateGraphEdgeesult);

        // 5) Neo4j get all path and calculate
        let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
        if (!debtsForUpdate) {
            console.error(debtsForUpdate);
            throw new Error('Internal Server Error');
        }
        // 6) Neo4j update best path graph
        console.debug('controller debtsForUpdate:  ', debtsForUpdate);
        const updateGraph = Graph.updateEdge(txc, gid, debtsForUpdate);
        if (!updateGraph) {
            console.error(updateGraph);
            throw new Error('Internal Server Error');
        }

        //結束settle, 更新狀態
        const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        if (!resultSetSetting) {
            console.error('settle done result: ', resultSetSetting);
            throw new Error('Internal Server Error');
        }
        console.log('settle done result: ', resultSetSetting);

        // 7) search update result from dbs just for refernce
        const updateResult = await updatedBalanceGraph(conn, txc, gid); //TODO: 如果前端不需要可拿掉;
        console.log('graph update result: ', updateResult);

        //全部成功，先commit下面才查得到
        await conn.commit();
        await txc.commit();

        //完後後才能close，不然會噴錯
        conn.release();
        return res.status(200).json({ data: { updateResult } });
    } catch (err) {
        console.error(err);
        await conn.rollback();
        await txc.rollback();
        conn.release();

        return res.status(500).json({ err });
    } finally {
        session.close();
    }
    // });
};
const postSettleDone = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('req.userGroupRole.gid, req.params.id: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const uid = req.user.id;
    const gid = Number(req.params.id);
    console.log('controller: uid, gid:', uid, gid, req.id);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    try {
        //結束settle, 更新狀態
        const resultSetSetting = await Admin.setSettleDone(conn, gid, uid);
        if (!resultSetSetting) {
            console.error('settle done result: ', resultSetSetting);
            throw new Error('Internal Server Error');
        }
        console.log('settle done result: ', resultSetSetting);
        return res.status(200).json({ data: null });
    } catch (err) {
        console.error(err);
        return res.status(500).json({ err });
    } finally {
        conn.release();
    }
};
const postSettlePairAll = async (req, res) => {
    // 1) MySql get balance of this pair
    // 1-1) TODO:get pair balance in all groups
    // TODO: for loop groups
    // 2) MySql create debt as settle
    // 3) MySql clear balance of this pair in all groups
    //TODO: for loop groups
    // 4) Neo4j recreate
    // 4-1) regen Neo4j
    // 4-1-1) create group on Neo4j
    // 4-1-1-1) get group users
    // 4-1-1-2) create group
    // 4-1-2) updateEdge on Neo4j
    // 4-2) get best path
    // 4-3) update Neo4j by best
    // 5) TODO: Neo4j delete old Neo4j graph for all groups
    // 6) 終於完成了回覆client
    // search update result from dbs just for refernce
};

module.exports = { postDebt, updateDebt, deleteDebt, postSettle, postSettlePair, postSettleDone };
