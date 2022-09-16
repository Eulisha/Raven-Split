const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const { updateBalance } = require('../util/balance_handler');
const { updateGraphEdge, getBestPath } = require('../util/graph_handler');
const Mapping = require('../config/mapping');
const { updated_balance_graph } = require('../util/bundle_getter');

const postDebt = async (req, res) => {
    if (req.userGroupRole.gid !== req.body.debt_main.gid || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }

    const debtMain = req.body.debt_main; //{gid, date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }
    console.log(debtMain);

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();

    try {
        //1) MYSQL 新增raw data
        const debtMainId = await Debt.createDebt(conn, debtMain);
        if (!debtMainId) {
            throw new Error('Internal Server Error');
        }
        const detailIds = await Debt.createDebtDetail(conn, debtMainId, debtDetail);
        if (!detailIds) {
            throw new Error('Internal Server Error');
        }

        //2-1) MYSQL balance table 加入新的帳
        const updateBalanceResult = await updateBalance(conn, debtMain, debtDetail);
        if (!updateBalanceResult) {
            throw new Error('Internal Server Error');
        }
        console.log('DB到這裡都完成了');

        await session.writeTransaction(async (txc) => {
            //2-2) NEO4j best path graph 查出舊帳並加入新帳更新
            const updateGraphEdgeesult = await updateGraphEdge(txc, debtMain, debtDetail);
            if (!updateGraphEdgeesult) {
                throw new Error('Internal Server Error');
            }
            console.log('Neo4j更新線的結果：', updateGraphEdgeesult);
            //TODO:處理沒有MATCH的狀況（不會跳error）

            //3)NEO4j取出所有路徑，並計算出最佳解
            const [graph, debtsForUpdate] = await getBestPath(txc, debtMain.gid);
            if (!debtsForUpdate) {
                throw new Error('Internal Server Error');
            }
            //NEO4j更新best path graph
            console.log('debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                throw new Error('Internal Server Error');
            }
        });
        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        session.close();

        // search update result from dbs just for refernce
        const updateResult = await updated_balance_graph(debtMain.gid);

        res.status(200).json({ data: { debtId: debtMainId, detailIds, updateResult } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        await conn.release();
        session.close();
        return res.status(500).json({ err });
    }
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

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();

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
        const debtMainId = await Debt.createDebt(conn, debtMainNew);
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
        const oldBalanceResult = await updateBalance(conn, debtMainOld, debtDetailOld);
        if (!oldBalanceResult) {
            throw new Error('Internal Server Error');
        }
        const newBalanceResult = await updateBalance(conn, debtMainNew, debtDetailNew);
        if (!newBalanceResult) {
            throw new Error('Internal Server Error');
        }

        //4)Neo4j update edge
        console.info('start neo4j');
        await session.writeTransaction(async (txc) => {
            const oldEdgeesult = await updateGraphEdge(txc, debtMainOld, debtDetailOld);
            const newEdgeesult = await updateGraphEdge(txc, debtMainNew, debtDetailNew);
            console.debug('Neo4j更新線的結果：', oldEdgeesult);
            console.debug('Neo4j更新線的結果：', newEdgeesult);

            //5)算最佳解
            const [graph, debtsForUpdate] = await getBestPath(txc, debtMainNew.gid);
            if (!debtsForUpdate) {
                throw new Error('Internal Server Error');
            }
            //NEO4j更新best path graph
            console.debug('debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                throw new Error('Internal Server Error');
            }
        });
        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        session.close();

        // search update result from dbs just for refernce
        const updateResult = updated_balance_graph(debtMainOld.gid);
        res.status(200).json({ data: { debtId: debtMainId, detailIds, updateResult } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        session.close();
        return res.status(500).json({ err });
    }
};

const deleteDebt = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const debtId = Number(req.params.debtId);

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();

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
        const updateBalanceResult = await updateBalance(conn, debtMain[0], debtDetail); //這裡的debtDetail已經是amount為負的
        if (!updateBalanceResult) {
            throw new Error('Internal Server Error');
        }

        let debtsForUpdate;
        await session.writeTransaction(async (txc) => {
            // 3-2) Neo4j update edge
            const updateGraphEdgeesult = await updateGraphEdge(txc, debtMain[0], debtDetail);
            if (!updateGraphEdgeesult) {
                throw new Error('Internal Server Error');
            }
            console.log('Neo4j更新線的結果：', updateGraphEdgeesult);
            //TODO:處理沒有MATCH的狀況（不會跳error）

            // 4) Neo4j get all path and calculate best path
            [graph, debtsForUpdate] = await getBestPath(txc, debtMain[0].gid);
            if (!debtsForUpdate) {
                throw new Error('Internal Server Error');
            }
            // 5) Neo4j update best path graph
            console.log('debtsForUpdate:  ', debtsForUpdate);
            const updateGraph = Graph.updateBestPath(txc, debtsForUpdate);
            if (!updateGraph) {
                throw new Error('Internal Server Error');
            }
        });

        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        session.close();

        // search update result from dbs just for refernce
        const updateResult = await updated_balance_graph(debtMain[0].gid);
        res.status(200).json({ data: { debtId, updateResult } });
    } catch (err) {
        console.error('ERROR: ', err);
        await conn.rollback();
        await conn.release();
        session.close();
        return res.status(500).json({ err });
    }
};

const postSettle = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['administer']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    console.log('req body', req.body);
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    const gid = Number(req.params.id);
    const { date, title } = req.body?.settle_main;
    //群組全體結帳的狀況
    try {
        const result = await Graph.getGraph(gid);
        if (result.records.length === 0) {
            return res.status(400).json({ err: 'No matched result' });
        }
        for (let record of result.records) {
            let amount = record.get('amount').toNumber();
            let borrower = record.get('borrower').toNumber();
            let lender = record.get('lender').toNumber();
            let debtMain = { gid, date, title, total: amount, lender, split_method: Mapping.SPLIT_METHOD.full_amount };
            let debtId = await Debt.createDebt(conn, debtMain);
            if (!debtId) {
                throw new Error('Internal Server Error');
            }
            let debtDetail = [{ borrower, amount }];
            await Debt.createDebtDetail(conn, debtId, debtDetail);
        }
        await Debt.deleteDebtBalance(conn, gid);
        await Graph.deleteBestPath(session, gid);
        res.status(200).json({ data: null });
        await conn.commit();
        await conn.release();
        session.close();
    } catch (err) {
        console.log(err);
        await conn.rollback();
        res.status(500).json({ err });
    }
};

module.exports = { postDebt, updateDebt, deleteDebt, postSettle };
