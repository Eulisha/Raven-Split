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
            //自己是借款人
            if (uid === debtMain.borrower) {
                isOwned = true;
                ownAmount = debtMain.total - debtDetailResult.amount;
            }
            const debtMainRecord = {
                date: debtMain.debt_date,
                title: debtMain.title,
                total: debtMain.total,
                isOwned,
                borrower: debtMain.borrower,
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

module.exports = { getDebtMain, postGroup };
