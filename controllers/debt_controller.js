const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const { getBestPath } = require('../util/getBestPath');
const pool = require('../config/mysql');
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
            let debtId = debtMain.id;
            let ownAmount;
            let isOwned = false;
            const [debtDetailResult] = await Debt.getDebtDetail(debtId, uid);
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
                date: debtMain.debt_date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                lender: debtMain.lender,
                ownAmount,
            };
            debtMainRecords.push(debtMainRecord);
        }
        res.status(200).json(debtMainRecords);
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};

const postDebt = async (req, res) => {
    const debtMain = req.body.debt_main; //{gid, debt_date, title, total, lender, split_method}
    const debtDetail = req.body.debt_detail; //{ [ { borrower, amount} ] }
    let conn;

    try {
        //取得連線
        conn = await pool.getConnection();
        await conn.beginTransaction();
        //MYSQL 新增帳務
        const createDebtResult = await Debt.createDebt(debtMain, debtDetail, conn);
        if (!createDebtResult) {
            throw new Error('Internal Server Error');
        }
        for (let debt of debtDetail) {
            //查原本borrower有欠lender

            const getBalanceResult = await Debt.getBalance(debtMain.gid, debt.borrower, debtMain.lender, conn);
            if (!getBalanceResult) {
                throw new Error('Internal Server Error');
            }

            // console.log('1: ', getBalanceResult);
            if (getBalanceResult.length !== 0) {
                let debtId = getBalanceResult[0].id;
                let originalDebt = getBalanceResult[0].amount;
                let newBalance = originalDebt + debt.amount; //本來就欠再往上加
                const result = await Debt.updateBalance(conn, debtId, debtMain.gid, newBalance);

                if (!result) {
                    throw new Error('Internal Server Error');
                }
            } else {
                //查原本borrower有借錢給lender
                const getBalanceResult = await Debt.getBalance(debtMain.gid, debtMain.lender, debt.borrower, conn);
                if (!getBalanceResult) {
                    throw new Error('Internal Server Error');
                }

                // console.log('2: ', getBalanceResult);
                if (getBalanceResult.length !== 0) {
                    let debtId = getBalanceResult[0].id;
                    let newBalance = getBalanceResult[0].amount - debt.amount; //把本來借出的金額減掉
                    if (newBalance > 0) {
                        //  維持本來的借款欠款關係
                        const result = await Debt.updateBalance(conn, debtId, debtMain.gid, newBalance);
                        if (!result) {
                            throw new Error('Internal Server Error');
                        }
                    } else {
                        // 借款欠款關係需交換
                        const result = await Debt.updateBalance(conn, debtId, debtMain.gid, -newBalance, debtMain.lender, debt.borrower);
                        if (!result) {
                            throw new Error('Internal Server Error');
                        }
                    }
                } else {
                    const result = await Debt.createBalance(debtMain.gid, debt.borrower, debtMain.lender, debt.amount, conn);
                    if (!result) {
                        throw new Error('Internal Server Error');
                    }
                }
            }
        }
        console.log('DB到這裡都完成了：');

        //NEO4j加入新的線
        let borrowers = [];
        for (let debt of debtDetail) {
            if (debt.borrower !== debtMain.lender) {
                borrowers.push(debt);
            }
        }
        const updateGraphEdgeesult = await Graph.updateGraphEdge(debtMain.gid, debtMain.lender, borrowers);
        console.log('更新線的結果：', updateGraphEdgeesult);

        //全部完成，MySQL做commit
        await conn.commit();
        await conn.release();
        //TODO:處理沒有MATCH的狀況（不會跳error）

        //NEO4j取得最佳解GRAPH
        const getBestPathResult = await getBestPath(debtMain.gid);
        if (!getBestPathResult) {
            throw new Error('Internal Server Error');
        }
        res.status(200).json({ data: getBestPathResult });
        //NEO4j更新最佳解
    } catch (err) {
        console.log('error: ', err);
        await conn.rollback();
        await conn.release();
        return res.status(500).json({ err });
    }
};
module.exports = { getDebtMain, postDebt };
