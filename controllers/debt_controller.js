const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
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

const postGroup = async (req, res) => {
    //TODO: Insert mysql & get uid, gid
    //TODO:轉成指定json格式
    // {
    //     "props": [
    //         {
    //             "name": 3
    //         },
    //         {
    //             "name": 10
    //         }
    //     ],
    //     "gid": 3
    // }

    const map = req.body.props;
    const gid = req.body.gid;
    try {
        await Graph.createNode(map, gid);
        return res.status(200).json({ data: 'create success.' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const postDebt = async (req, res) => {
    const debtMain = req.body.debt_main;
    const debtDetail = req.body.debt_detail;

    //BEGIN TRANS
    const conn = await pool.getConnection();
    try {
        //INSET MYSQL
        const postDbResult = await Debt.postDebt(debtMain, debtDetail);
        //SELECT DEBT
        //TRANS TO LEAST COMBO
        let arr = ['a', 'b', 'c', 'd', 'e'];
        let arr1 = [];
        for (let i = 0; i < arr.length; i++) {
            console.log(i);
            for (let j = 0; j < arr.length - 1; j++) {
                let x = i + j + 1;
                if (x > arr.length - 1) {
                    break;
                }
                console.log('pair:', i, x);
                console.log(j);
                arr1.push([arr[i], arr[x]]);
            }
        }
        console.log(arr1);

        //INSRT NEO4j
        let lender = req.body.debt.debt_main.lender;
        let borrowers = req.body.debt.debt_detail;
        const result = updateGraph(lender, borrowers);
        //TODO:處理沒有MATCH的狀況（不會跳error）
        if (result.length === 0) {
        }
        //UPDATE GRAPH

        //COMMIT
        await conn.query('COMMIT');
    } catch (error) {
        await conn.query('ROLLBACK');
        return { error };
    } finally {
        conn.release();
    }
};
module.exports = { getDebtMain, postGroup, postDebt };
