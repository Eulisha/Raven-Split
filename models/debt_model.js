const pool = require('../config/mysql');

const getDebtMain = async (group, pageSize, paging) => {
    // const debtMainSql = 'SELECT id, debt_date, title, total, borrower FROM debt_main WHERE gid = ? ORDER BY debt_date DESC, id ASC LIMIT ?, ?;'; //排序方式為日期+建立順序(id)
    // const [debtMainResult] = await pool.query(debtMainSql, [group, page, pageSize]);
    const debtMainSql = 'SELECT id, debt_date, title, total, borrower FROM debt_main WHERE gid = ? LIMIT ? OFFSET ?;'; //排序方式為日期+建立順序(id)
    const debtMainResult = await pool.query(debtMainSql, [group, pageSize, pageSize * paging]);
    return debtMainResult;
};

const getDebtDetail = async (debtId, uid) => {
    if (uid) {
        const debtDetailSql = `SELECT lender, amount FROM debt_detail WHERE debt_id = ? AND lender = ?`;
        const debtDetailResult = await pool.execute(debtDetailSql, [debtId, uid]);
        return debtDetailResult;
    }
};
module.exports = { getDebtMain, getDebtDetail };
