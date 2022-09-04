const pool = require('../config/mysql');

const getDebtMain = async (group, pageSize, paging) => {
    // const debtMainSql = 'SELECT id, debt_date, title, total, lender FROM debt_main WHERE gid = ? ORDER BY debt_date DESC, id ASC LIMIT ?, ?;'; //排序方式為日期+建立順序(id)
    // const [debtMainResult] = await pool.query(debtMainSql, [group, page, pageSize]);
    const debtMainSql = 'SELECT id, debt_date, title, total, lender FROM debt_main WHERE gid = ? LIMIT ? OFFSET ?;'; //排序方式為日期+建立順序(id)
    const debtMainResult = await pool.query(debtMainSql, [group, pageSize, pageSize * paging]);
    return debtMainResult;
};

const getDebtDetail = async (debtId, uid) => {
    if (uid) {
        const debtDetailSql = `SELECT borrower, amount FROM debt_detail WHERE debt_id = ? AND borrower = ?`;
        const debtDetailResult = await pool.execute(debtDetailSql, [debtId, uid]);
        return debtDetailResult;
    }
};
const postDebt = async (debtMain, debtDetail) => {
    const debtMainSql = `INSERT INTO debt_main (gid, debt_date, title, total, borrower, split_method, debt_status) 
    VALUE ?;`;
    const debtMainResult = await pool.execute(debtMainSql, [
        debtMain.gid,
        debtMain.debt_date,
        debtMain.title,
        debtMain.total,
        debtMain.borrower,
        debtMain.split_method,
        debtMain.debt_status,
    ]);
    const debtId = debtDetail[0].insertId;
    for (let debt of debtDetail) {
        const debtDetailSql = `INSERT INTO debt_detail (debt_id, lender, amount) VALUE ?`;
        const debtDetailResult = await pool.execute(debtDetailSql, [debtId, debtDetail.lender, debtDetail.amount]);
    }
};
module.exports = { getDebtMain, getDebtDetail, postDebt };
