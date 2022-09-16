const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const { neo4j, driver } = require('../config/neo4j');
const Admin = require('../models/admin_model');
const pageSize = process.env.PAGE_SIZE;
const Mapping = require('../config/mapping');

const getDebts = async (req, res) => {
    console.log('@getDebts control:', req.params);
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }

    const gid = Number(req.params.id);
    const uid = req.user.id;
    const paging = Number(req.query.paging) || 0;
    const debtMainRecords = [];
    //撈所有該群組內的帳
    try {
        const [debtMainResult] = await Debt.getDebts(gid, pageSize, paging);
        if (!debtMainResult) {
            res.status(500).json({ err: 'Internal Server Error' });
        }
        console.log('debtMain:', debtMainResult);
        //查借貸明細
        for (let debtMain of debtMainResult) {
            let debtMainId = debtMain.id;
            let ownAmount;
            let isOwned = false;
            let [debtDetailResult] = await Debt.getDebtDetail(debtMainId, uid);
            console.log('debtDetail:', debtDetailResult);

            //自己沒有參與這筆帳
            if (!debtDetailResult) {
                debtDetailResult = {};
                debtDetailResult.amount = 0;
            }
            //自己是付錢的人
            if (uid === debtMain.lender) {
                isOwned = true;
                ownAmount = debtMain.total - debtDetailResult.amount;
            } else {
                ownAmount = debtDetailResult.amount;
            }

            const debtMainRecord = {
                id: debtMain.id,
                gid,
                date: debtMain.date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                lender: debtMain.lender,
                split_method: debtMain.split_method,
                ownAmount,
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
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    try {
        const debtMainId = req.params.debtId;
        const result = await Debt.getDebtDetail(debtMainId);
        res.status(200).json({ data: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getMeberBalances = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    try {
        const gid = Number(req.params.id);
        const result = await Debt.getAllBalances(gid);
        return res.status(200).json({ data: result });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
const getSettle = async (req, res) => {
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const uid = req.user.id;
    try {
        const resultGetGraph = await Graph.getGraph(gid);
        console.warn(resultGetGraph);
        if (!resultGetGraph) {
            throw new Error('Internal Server Error');
        }
        if (!resultGetGraph === 0) {
            return res.status(400).json({ err: 'no matched result' }); //FIXME:status code & err msg fine-tune
        }
        const graph = resultGetGraph.records.map((record) => {
            let amount = record.get('amount').toNumber();
            let borrower = record.get('borrower').toNumber();
            let lender = record.get('lender').toNumber();
            return { borrower, lender, amount };
        });
        const resultSetSetting = await Admin.setSettling(gid, uid);
        if (!resultSetSetting) {
            throw new Error('Internal Server Error');
        }
        console.error(graph);
        await res.status(200).json({ data: graph });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err });
    }
};
module.exports = { getDebts, getDebtDetail, getDebtDetail, getMeberBalances, getSettle };
