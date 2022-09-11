const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const pageSize = process.env.PAGE_SIZE;

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
                gid: group,
                date: debtMain.date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                lender: debtMain.lender,
                split_method: debtMain.split_method,
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
const getDebtDetail = async (req, res) => {
    try {
        const debtMainId = req.params.id;
        const result = await Debt.getDebtDetail(debtMainId);
        res.status(200).json({ data: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getMeberBalances = async (req, res) => {
    try {
        const gid = req.params.id;
        const result = await Debt.getAllBalances(gid);
        return res.status(200).json({ data: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getSettle = async (req, res) => {
    const groupId = req.params.id;
    const result = await Graph.getGraph(groupId);
    if (result.records.length !== 0) {
    }
    const graph = result.records.map((record) => {
        let amount = record.get('amount').toNumber();
        let borrower = record.get('borrower').toNumber();
        let lender = record.get('lender').toNumber();
        return { borrower, lender, amount };
    });
    res.status(200).json({ data: graph });
};
module.exports = { getDebtMain, getDebtDetail, getDebtDetail, getMeberBalances, getSettle };
