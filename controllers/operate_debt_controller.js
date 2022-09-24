const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const Admin = require('../models/admin_model');
const GraphHandler = require('../util/graph_handler');
const { updateBalance } = require('../util/balance_handler');
const { updatedBalanceGraph } = require('../util/bundle_getter');
const Mapping = require('../config/mapping');

const postDebt = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const debtMain = req.body.debt_main; //{date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }
    console.log(debtMain);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
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
            //NEO4j更新best path graph
            console.debug('debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                console.error(updateGraph);
                throw new Error('Internal Server Error');
            }
            // search update result from dbs just for refernce
            const updateResult = await updatedBalanceGraph(conn, txc, gid); //TODO: 如果前端不需要可拿掉;

            //全部成功，MySQL做commit
            await conn.commit();
            await txc.commit();
            conn.release();
            session.close();
            return res.status(200).json({ data: { debtId: debtMainId, detailIds, updateResult } });
        } catch (err) {
            console.error('ERROR: ', err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err });
        }
    });
};
const updateDebt = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const debtId = Number(req.params.debtId);
    const debtMainNew = req.body.debt_main;
    const debtDetailNew = req.body.debt_detail;
    console.info('gid, debtId, debtMainNew, debtDetailNew', gid, debtId, debtMainNew, debtDetailNew);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        try {
            //0) get previous debt data for balance and best path usage
            const [debtMainOld] = await Debt.getDebt(conn, debtId);
            const debtDetailOld = await Debt.getDebtDetailTrx(conn, debtId);
            if (!debtMainOld || !debtDetailOld) {
                throw new Error('Internal Server Error');
            }
            if (debtMainOld.length === 0 || debtDetailOld.length === 0) {
                throw new Error('Previous debt record not found.');
            }
            console.info('debtMainOld, debtDetailOld', debtMainOld, debtDetailOld);

            //1) mysql set previous debt status to 0
            const status = Mapping.DEBT_STATUS.deprach; //custom update, create new one directly
            const deleteResult = await Debt.deleteDebt(conn, debtId, status);
            if (!deleteResult) {
                throw new Error('Internal Server Error');
            }

            //2) MYSQL create new raw data
            const debtMainId = await Debt.createDebt(conn, gid, debtMainNew);
            if (!debtMainId) {
                throw new Error('Internal Server Error');
            }
            const detailIds = await Debt.createDebtDetail(conn, debtMainId, debtDetailNew);
            if (!detailIds) {
                throw new Error('Internal Server Error');
            }
            console.debug('debtDetailOld: ', debtDetailOld);
            //set debt amount reversely stand for delete
            debtDetailOld.forEach((ele, ind) => {
                debtDetailOld[ind].amount = -ele.amount;
            });

            //3) mysql update balance
            const oldBalanceResult = await updateBalance(conn, gid, debtMainOld, debtDetailOld);
            if (!oldBalanceResult) {
                throw new Error('Internal Server Error');
            }
            const newBalanceResult = await updateBalance(conn, gid, debtMainNew, debtDetailNew);
            if (!newBalanceResult) {
                throw new Error('Internal Server Error');
            }

            //4)Neo4j update edge
            console.info('start neo4j');
            const oldEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMainOld, debtDetailOld);
            const newEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMainNew, debtDetailNew);
            console.debug('Neo4j更新線的結果：', oldEdgeesult);
            console.debug('Neo4j更新線的結果：', newEdgeesult);

            //5)算最佳解
            let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
            if (!debtsForUpdate) {
                throw new Error('Internal Server Error');
            }
            //NEO4j更新best path graph
            console.debug('debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                throw new Error('Internal Server Error');
            }

            //全部成功，MySQL做commit
            await conn.commit();
            await txc.commit();
            conn.release();
            session.close();

            // search update result from dbs just for refernce
            const updateResult = updatedBalanceGraph(conn, txc, gid); //TODO: 如果前端不需要可拿掉;
            return res.status(200).json({ data: { debtId: debtMainId, detailIds, updateResult } });
        } catch (err) {
            console.error('ERROR: ', err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err });
        }
    });
};

const deleteDebt = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const debtId = Number(req.params.debtId);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        try {
            // 1) search db to get debt info
            const debtMain = await Debt.getDebt(conn, debtId);
            console.log('debtMain: ', debtMain);
            if (!debtMain) {
                throw new Error('Internal Server Error');
            }
            const debtDetail = await Debt.getDebtDetailTrx(conn, debtId);
            if (!debtDetail) {
                throw new Error('Internal Server Error');
            }
            console.log('debtDetail: ', debtDetail);

            // 2) mysql set debt status to customer delete
            const status = Mapping.DEBT_STATUS.customer_deleted; //customer delete
            const deleteResult = await Debt.deleteDebt(conn, debtId, status);
            if (!deleteResult) {
                throw new Error('Internal Server Error');
            }
            //set debt amount reversely stand for delete
            debtDetail.forEach((ele, ind) => {
                debtDetail[ind].amount = -ele.amount;
            });
            // 3-1) mysql update balance
            const updateBalanceResult = await updateBalance(conn, gid, debtMain[0], debtDetail); //這裡的debtDetail已經是amount為負的
            if (!updateBalanceResult) {
                throw new Error('Internal Server Error');
            }

            // 3-2) Neo4j update edge
            const updateGraphEdgeesult = await GraphHandler.updateGraphEdge(txc, gid, debtMain[0], debtDetail);
            if (!updateGraphEdgeesult) {
                throw new Error('Internal Server Error');
            }
            console.log('Neo4j更新線的結果：', updateGraphEdgeesult);
            //TODO:處理沒有MATCH的狀況（不會跳error）

            // 4) Neo4j get all path and calculate best path
            let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
            if (!debtsForUpdate) {
                throw new Error('Internal Server Error');
            }
            // 5) Neo4j update best path graph
            console.log('debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                throw new Error('Internal Server Error');
            }

            //全部成功，MySQL做commit
            await conn.commit();
            await txc.commit();
            conn.release();
            session.close();

            // search update result from dbs just for refernce
            const updateResult = await updatedBalanceGraph(debtMain[0].gid);
            return res.status(200).json({ data: { debtId, updateResult } });
        } catch (err) {
            console.error('ERROR: ', err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err });
        }
    });
};

const postSettle = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['administer']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    console.log('controller: body:', req.body);

    const gid = Number(req.params.id);
    const { date, title } = req.body.settle_main;

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        try {
            const result = await Graph.getGraph(neo4j.int(gid));
            if (result.records.length === 0) {
                await conn.release();
                session.close();
                return res.status(400).json({ err: 'No matched result' });
            }
            for (let record of result.records) {
                let amount = record.get('amount').toNumber();
                let borrower = record.get('borrower').toNumber();
                let lender = record.get('lender').toNumber();
                //因為是還錢所以debtMain的lender值為本來的borrower
                let debtMain = { gid, date, title, total: amount, lender: borrower, split_method: Mapping.SPLIT_METHOD.full_amount };
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
            const deleteDebtBalancesResult = await Debt.deleteDebtBalances(conn, gid);
            if (!deleteDebtBalancesResult) {
                console.error(deleteDebtBalancesResult);
                throw new Error('Internal Server Error');
            }

            const deleteBestPathResult = await Graph.deleteBestPath(txc, neo4j.int(gid));
            if (!deleteBestPathResult) {
                console.error(deleteBestPathResult);
                throw new Error('Internal Server Error');
            }

            await conn.commit();
            await txc.commit();
            conn.release();
            session.close();
            return res.status(200).json({ data: null });
        } catch (err) {
            console.log(err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err });
        }
    });
};

const postSettlePair = async (req, res) => {
    const { date, title } = req.body.settle_main;
    const gid = Number(req.params.id);
    const uid1 = Number(req.params.uid1);
    const uid2 = Number(req.params.uid2);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        try {
            // 1) MySql get balance of this pair
            let balances = await Debt.getAllBalances(conn, gid);
            if (!balances) {
                throw new Error('Internal Server Error');
            }
            // 1-1) get pair balance
            console.debug(balances);
            let pairBalance = {};
            for (let i = 0; i < balances.length; i++) {
                // console.log(`第${i}圈`);
                // console.debug(balances[i].borrower, balances[i].lender, uid1, uid2);
                // console.debug(balances[i].borrower === uid1, balances[i].lender === uid2);
                // console.debug(balances[i].borrower === uid2, balances[i].lender === uid1);

                if ((balances[i].borrower === uid1 && balances[i].lender === uid2) || (balances[i].borrower === uid2 && balances[i].lender === uid1)) {
                    pairBalance = balances[i];
                    balances.splice(i, 1); //將balances內該筆刪除，供後面Neo建立graph使用
                    break;
                }
            }
            console.debug('pairBalance', pairBalance);

            if (!pairBalance.id) {
                //找不到, 代表沒有債務關係
                console.error(pairBalance);
                await conn.release();
                session.close();
                return res.status(400).json({ data: 'No Debt Relationship.' });
            }

            // 2) MySql create debt as settle
            let debtMain = { gid, date, title, total: pairBalance.amount, lender: pairBalance.borrower, split_method: Mapping.SPLIT_METHOD.full_amount }; //因為是還錢所以debtMain的lender值為本來的borrower
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
            // 3) MySql clear balance of this pair
            const deleteDebtBalanceResult = await Debt.deleteDebtBalance(conn, pairBalance.id); //直接把該id的balance帳刪除
            if (!deleteDebtBalanceResult) {
                console.error(deleteDebtBalanceResult);
                throw new Error('Internal Server Error');
            }

            // 5) Neo4j delete edges in Neo4j graph of this group
            const deleteBestPathResult = await Graph.deleteBestPath(txc, neo4j.int(gid));
            if (!deleteBestPathResult) {
                console.error(deleteBestPathResult);
                throw new Error('Internal Server Error');
            }

            // 4) Neo4j recreate
            // 4-1) regen Neo4j
            // 4-1-1) create group on Neo4j
            // 4-1-1-1) get group users
            const getGroupUserIds = await Admin.getGroupUserIds(gid); //TODO: 需要select for update?
            if (!getGroupUserIds) {
                console.error(getGroupUserIds);
                throw new Error('Internal Server Error');
            }
            // 上面只會刪除關係線，所以不需要建新群組
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

            // 4-1-2) updateEdge on Neo4j
            // 把前面已經刪除settle完pair balance剩下的balances拿去畫圖
            // 先處理neo的數字
            let newMap = balances.map((balance) => {
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
            // 4-2) get best path
            // call graph handler
            let [graph, debtsForUpdate] = await GraphHandler.getBestPath(txc, gid);
            if (!debtsForUpdate) {
                console.error(debtsForUpdate);
                throw new Error('Internal Server Error');
            }
            // 4-3) update Neo4j by best
            console.debug('controller debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                console.error(updateGraph);
                throw new Error('Internal Server Error');
            }

            // search update result from dbs just for refernce
            const updateResult = await updatedBalanceGraph(conn, txc, gid); //TODO: 如果前端不需要可拿掉;

            //全部成功，MySQL做commit
            await conn.commit();
            await txc.commit();
            conn.release();
            session.close();
            return res.status(200).json({ data: { updateResult } });
        } catch (err) {
            console.error(err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err });
        }
    });
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

module.exports = { postDebt, updateDebt, deleteDebt, postSettle, postSettlePair };
