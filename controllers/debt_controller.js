const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const { getBestPath } = require('../util/getBestPath');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const pageSize = 25;

const getDebtMain = async (req, res) => {
    const group = Number(req.query.group);
    const uid = Number(req.query.uid);
    const paging = Number(req.query.paging) || 0;
    const debtMainRecords = [];
    //撈所有該群組內的帳
    try {
        const [debtMainResult] = await Debt.getDebtMain(group, pageSize, paging);
        console.log('debtMain:', debtMainResult);
        //查借貸明細
        for (let debtMain of debtMainResult) {
            let debtMainId = debtMain.id;
            let ownAmount;
            let isOwned = false;
            const [debtDetailResult] = await Debt.getDebtDetail(debtMainId, uid);
            console.log('debtDetail:', debtDetailResult);

            //自己沒有參與這筆帳
            if (!debtDetailResult) {
                ownAmount = 0;
            }
            //自己是付錢的人
            if (uid === debtMain.lender) {
                isOwned = true;
                ownAmount = debtMain.total - debtDetailResult.amount;
            }
            const debtMainRecord = {
                id: debtMain.id,
                date: debtMain.debt_date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                lender: debtMain.lender,
                ownAmount: debtDetailResult.amount,
            };
            debtMainRecords.push(debtMainRecord);
        }
        res.status(200).json({ data: debtMainRecords });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};

const postDebt = async (req, res) => {
    const debtMain = req.body.debt_main; //{gid, debt_date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }
    const data = {};

    const conn = await pool.getConnection();
    await conn.beginTransaction();

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
        //2-1-1) 拉出pair本來的借貸並更新
        for (let debt of debtDetail) {
            // 原本是本次的borrower-own->lender
            const getBalanceResult = await Debt.getBalance(conn, debtMain.gid, debt.borrower, debtMain.lender);
            if (!getBalanceResult) {
                throw new Error('Internal Server Error');
            }
            if (getBalanceResult.length !== 0) {
                let debtId = getBalanceResult[0].id;
                let originalDebt = getBalanceResult[0].amount;
                let newBalance = originalDebt + debt.amount; //add more debt
                const result = await Debt.updateBalance(conn, debtId, debt.borrower, debtMain.lender, newBalance);

                if (!result) {
                    throw new Error('Internal Server Error');
                }
            } else {
                //原本是本次的borrower <-own-lender
                const getBalanceResult = await Debt.getBalance(conn, debtMain.gid, debtMain.lender, debt.borrower);
                if (!getBalanceResult) {
                    throw new Error('Internal Server Error');
                }

                // console.log('2: ', getBalanceResult);
                if (getBalanceResult.length !== 0) {
                    let debtId = getBalanceResult[0].id;
                    let originalDebt = getBalanceResult[0].amount;
                    let newBalance = originalDebt - debt.amount; //pay back
                    if (newBalance > 0) {
                        //  維持borrower <-own-lender
                        const result = await Debt.updateBalance(conn, debtId, debtMain.lender, debt.borrower, newBalance);
                        if (!result) {
                            throw new Error('Internal Server Error');
                        }
                    } else {
                        // 改為borrower-own->lender
                        const result = await Debt.updateBalance(conn, debtId, debt.borrower, debtMain.lender, -newBalance);
                        if (!result) {
                            throw new Error('Internal Server Error');
                        }
                    }
                } else {
                    const result = await Debt.createBalance(conn, debtMain.gid, debt.borrower, debtMain.lender, debt.amount);
                    if (!result) {
                        throw new Error('Internal Server Error');
                    }
                }
            }
        }
        console.log('DB到這裡都完成了');

        //2-2) NEO4j best path graph加入新的帳
        const session = driver.session();
        neo4j.int(10);
        let borrowers = [];
        for (let debt of debtDetail) {
            if (debt.borrower !== debtMain.lender) {
                borrowers.push(debt);
            }
        }
        const updateGraphEdgeesult = await Graph.updateEdge(session, debtMain.gid, debtMain.lender, borrowers);
        console.log('Neo4j更新線的結果：', updateGraphEdgeesult);

        //全部成功，MySQL做commit
        await conn.commit();
        await conn.release();
        //TODO:處理沒有MATCH的狀況（不會跳error）

        //3)NEO4j取出所有路徑，並計算出最佳解
        const [graph, debtsForUpdate] = await getBestPath(session, debtMain.gid);
        if (!debtsForUpdate) {
            throw new Error('Internal Server Error');
        }
        data.graph = graph;
        //NEO4j更新best path graph
        const updateGraph = Graph.updateBestPath(debtsForUpdate);
        if (!updateGraph) {
            throw new Error('Internal Server Error');
        }
        res.status(200).json(data);
    } catch (err) {
        console.log('error: ', err);
        await conn.rollback();
        await conn.release();
        return res.status(500).json({ err });
    }
};

const getDebtDetail = async (req, res) => {
    try {
        await getDebtDetail(debtId);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};

const deleteGroupDebts = async (req, res) => {
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    try {
        const gid = req.params.id;
        if ((req.query.user1, req.query.user2)) {
            //FIXME: 群組內兩兩結帳的狀況 不知道要怎麼算@@
            await Debt.deleteGroupPairDebts(conn, gid, uid1, uid2);
            await Debt.updateBalance;
            await Debt.getBalance;
            await Graph.deleteBestPath(txc, req.params.id);
            await Graph.createBestPath(txc);
        } else {
            //群組全體結帳的狀況
            await Debt.deleteGroupDebts(conn, gid);
            await Debt.deleteDebtBalance(conn, req.params.id);
            await Graph.deleteBestPath(txc, req.params.id);
        }
        await conn.commit();
        await session.close();
    } catch (err) {
        console.log('error: ', err);
        await conn.rollback();
        return res.status(500).json({ err });
    } finally {
        await conn.release();
    }
};

const createBatchBalance = async (req, res) => {
    //批次建立建立member balance, 暫時沒用到
    //整理members的排列組合
    let memberCombo = [];
    for (let i = 0; i < members.length; i++) {
        for (let j = 0; j < members.length - 1; j++) {
            let x = i + j + 1;
            if (x > members.length - 1) {
                break;
            }
            memberCombo.push([members[i], members[x]]);
        }
    }
    console.log(memberCombo);
    const balanceResult = await Admin.createBatchBalance(groupId, memberCombo, conn);
    if (!balanceResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
module.exports = { getDebtMain, getDebtDetail, postDebt, deleteGroupDebts };
