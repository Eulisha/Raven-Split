const pool = require('../config/mysql');

const getDebtMain = async (group, pageSize, paging) => {
    try {
        const debtMainSql = `SELECT id, date, title, total, borrower FROM debt_main WHERE gid = ? ORDER BY date DESC, id ASC LIMIT ?, ?`; //排序方式為日期+建立順序(id)
        const [debtMainResult] = await pool.execute(debtMainSql, [group, pageSize * paging, pageSize]);
        return debtMainResult;
    } catch (err) {
        console.log('Error At getDebtMain for mySQL select : ', err);
    }
};

const getDebtDetail = async (debtId, uid) => {
    try {
        if (uid) {
            const debtDetailSql = `SELECT lender, amount FROM debt_detail WHERE debt_id = ? AND lender = ?`;
            const [debtDetailResult] = await pool.execute(debtDetailSql, [debtId, uid]);
            return debtDetailResult;
        }
    } catch (err) {
        console.log('Error At getDebtDetail for mySQL select : ', err);
    }
};
module.exports = { getDebtMain, getDebtDetail };
