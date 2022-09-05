const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const { getBestPath } = require('../util/getBestPath');
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
        await Graph.createGraphNodes(map, gid);
        return res.status(200).json({ data: 'create success.' });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const postDebt = async (req, res) => {
    const debtMain = req.body.debt_main;
    const debtDetail = req.body.debt_detail;
    //MYSQL 新增帳務
    const postDbResult = await Debt.postDebt(debtMain, debtDetail);
    if (!postDbResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    const conn = postDbResult[1];
    //MySql撈目前的balance
    const [getBalanceResult] = await Debt.getBalance(debtMain.gid, debtMain.lender, conn);
    if (!getBalanceResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    console.log('balance: ', getBalanceResult);
    //計算新的balance
    let newBalances = [];
    for (let pair of getBalanceResult) {
        let newBalance;
        if (pair.lender === debtMain.lender) {
            newBalance = debtMain.total + pair.amount;
            newBalances.push({ gid: pair.gid, lender: pair.lender, borrower: pair.borrower, amount: newBalance });
        } else if (pair.borrower === debtMain.lender) {
            newBalance = debtMain.total - pair.amount;
            newBalances.push({ gid: pair.gid, lender: pair.lender, borrower: pair.borrower, amount: newBalance });
        }
    }
    console.log(newBalances);

    //MySql存回新balance
    const updateBalanceResult = await Debt.updateBalance(newBalances, conn);
    if (!updateBalanceResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    console.log('DB到這裡都完成了：', updateBalanceResult);

    //TODO:要從這裡開始測試
    //NEO4j加入新的線
    let borrowers = [];
    for (let debt of debtDetail) {
        if (debt.borrower !== debtMain.lender) {
            borrowers.push(debt);
        }
    }
    console.log(borrowers);
    const updateGraphEdgeesult = await Graph.updateGraphEdge(debtMain.gid, debtMain.lender, borrowers, conn);
    console.log('更新線的結果：', updateGraphEdgeesult);
    //TODO:處理沒有MATCH的狀況（不會跳error）

    //NEO4j取得最佳解GRAPH
    const getBestPathResult = getBestPath(debtMain.gid);
    if (!getBestPathResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    //NEO4j更新最佳解
};
module.exports = { getDebtMain, postGroup, postDebt };
