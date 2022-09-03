const Debt = require('../models/debt_model');
const pageSize = 25;

const getDebtMain = async function (group, uid) {
    const group = req.query.group;
    const uid = req.query.uid;
    const paging = req.query.paging || 0;
    const debtMainRecords = [];
    //撈所有該群組內的帳
    const [debtMainResult] = await Debt.getDebtMain(group, pageSize, paging);
    for (let debtMain of debtMainResult) {
        const debtMainRecord = { date, title, total, borrowor, youBorrow };
        let debtId = debtMain.id;
        //查自己是否有參與這筆分帳
        const [debtDetailResult] = await Debt.getDebtDetail(debtId, uid);
        if (!debtDetailResult) {
            debtMainRecord.youBorrow = NULL;
        } else {
            debtMainRecord.youBorrow = debtDetailResult[0].amount;
        }
        debtMainRecords.push(debtMainRecord);
    }
    return debtMainRecords;
};

module.exports = { getDebtMain };
