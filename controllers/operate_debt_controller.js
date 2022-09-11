const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const { updateBalance } = require('../util/balance_handler');
const { updateGraphEdge, getBestPath } = require('../util/graph_handler');

const postDebt = async (req, res) => {
    const debtMain = req.body.debt_main; //{gid, date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }
    const data = {};

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();

    try {
        //1) MYSQL 新增raw data
        const debtMainId = await Debt.createDebtMain(conn, debtMain);
        data.debtId = debtMainId;
        if (!debtMainId) {
            throw new Error('Internal Server Error');
        }
        const debtDetailResult = await Debt.createDebtDetail(conn, debtMainId, debtDetail);
        if (!debtDetailResult) {
            throw new Error('Internal Server Error');
        }

        //2-1) MYSQL balance table 加入新的帳
        const updateBalanceResult = await updateBalance(conn, debtMain, debtDetail);
        if (!updateBalanceResult) {
            throw new Error('Internal Server Error');
        }
        console.log('DB到這裡都完成了');

        //2-2) NEO4j best path graph 查出舊帳並加入新帳更新
        const updateGraphEdgeesult = await updateGraphEdge(session, debtMain, debtDetail);
        if (!updateGraphEdgeesult) {
            throw new Error('Internal Server Error');
        }
        console.log('Neo4j更新線的結果：', updateGraphEdgeesult);
        //TODO:處理沒有MATCH的狀況（不會跳error）

        //3)NEO4j取出所有路徑，並計算出最佳解
        const [graph, debtsForUpdate] = await getBestPath(session, debtMain.gid);
        if (!debtsForUpdate) {
            throw new Error('Internal Server Error');
        }
        data.graph = graph;
        //NEO4j更新best path graph
        console.log('debtsForUpdate:  ', debtsForUpdate);
        const updateGraph = Graph.updateBestPath(debtsForUpdate);
        if (!updateGraph) {
            throw new Error('Internal Server Error');
        }

        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        session.close();
        res.status(200).json(data);
    } catch (err) {
        console.log('error: ', err);
        await conn.rollback();
        await conn.release();
        session.close();
        return res.status(500).json({ err });
    }
};
const updateDebt = async (req, res) => {
    const debtId = req.body.debt_Id;
    const debtMainOld = req.body.debt_main_old; //{gid, date, title, total, lender, split_method}
    const debtDetailOld = req.body.debt_detail_old; //{ [ { borrower, amount} ] }
    const debtMainNew = req.body.debt_main_new;
    const debtDetailNew = req.body.debt_detail_new;

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();

    try {
        const status = 0; //custom update, create new one directly

        //1) mysql set previous debt status to 0
        const deleteResult = await Debt.deleteDebt(conn, debtId, status);
        if (!deleteResult) {
            throw new Error('Internal Server Error');
        }

        //2) MYSQL create new raw data
        const debtMainId = await Debt.createDebtMain(conn, debtMainNew);
        if (!debtMainId) {
            throw new Error('Internal Server Error');
        }
        const debtDetailResult = await Debt.createDebtDetail(conn, debtMainId, debtDetailNew);
        if (!debtDetailResult) {
            throw new Error('Internal Server Error');
        }
        console.log(debtDetailOld);
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
        console.log('start neo4j');
        const oldEdgeesult = await updateGraphEdge(session, debtMainOld, debtDetailOld);
        const newEdgeesult = await updateGraphEdge(session, debtMainNew, debtDetailNew);
        console.log('Neo4j更新線的結果：', oldEdgeesult);
        console.log('Neo4j更新線的結果：', newEdgeesult);

        //5)算最佳解
        const [graph, debtsForUpdate] = await getBestPath(session, debtMainNew.gid);
        if (!debtsForUpdate) {
            throw new Error('Internal Server Error');
        }
        //NEO4j更新best path graph
        console.log('debtsForUpdate:  ', debtsForUpdate);
        const updateGraph = Graph.updateBestPath(debtsForUpdate);
        if (!updateGraph) {
            throw new Error('Internal Server Error');
        }

        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        session.close();
        res.status(200).json({ data: { debtId: debtMainId, bestPath: graph } });
    } catch (err) {
        console.log('error: ', err);
        await conn.rollback();
        session.close();
        return res.status(500).json({ err });
    }
};
const deleteDebt = async (req, res) => {
    const debtId = req.body.debt_id;
    const debtMain = req.body.debt_main; //{gid, date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }

    debtDetail.forEach((ele, ind) => {
        debtDetail[ind].amount = -ele.amount;
    });

    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();

    try {
        const status = 4; //customer delete
        //mysql set debt status to 0
        const deleteResult = await Debt.deleteDebt(conn, debtId, status);
        if (!deleteResult) {
            throw new Error('Internal Server Error');
        }
        //set debt amount reversely stand for delete
        debtDetail.forEach((ele, ind) => {
            debtDetail[ind].amount = -ele.amount;
        });
        //mysql update balance
        const updateBalanceResult = await updateBalance(conn, debtMain, debtDetail);
        if (!updateBalanceResult) {
            throw new Error('Internal Server Error');
        }
        //Neo4j update edge
        console.log('start neo4j');
        const updateGraphEdgeesult = await updateGraphEdge(session, debtMain, debtDetail);
        console.log('Neo4j更新線的結果：', updateGraphEdgeesult);

        //calculate best path
        const [graph, debtsForUpdate] = await getBestPath(session, debtMain.gid);
        if (!debtsForUpdate) {
            throw new Error('Internal Server Error');
        }

        //NEO4j更新best path graph
        const updateGraph = Graph.updateBestPath(debtsForUpdate);
        if (!updateGraph) {
            throw new Error('Internal Server Error');
        }
        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        session.close();
        res.status(200).json({ data: graph });
    } catch (err) {
        console.log('error: ', err);
        await conn.rollback();
        return res.status(500).json({ err });
    }
};
const postSettle = async (req, res) => {
    if ((req.query.user1, req.query.user2)) {
        await Debt.deleteGroupPairDebts(conn, gid, uid1, uid2);
        await Debt.getBalance;
        await Graph.deleteBestPath(txc, req.params.id);
        await Graph.createBestPath(txc);
    } else {
        //群組全體結帳的狀況
        await Debt.deleteGroupDebts(conn, gid);
        await Debt.deleteDebtBalance(conn, req.params.id);
        await Graph.deleteBestPath(txc, req.params.id);
    }
};

module.exports = { postDebt, updateDebt, deleteDebt };
