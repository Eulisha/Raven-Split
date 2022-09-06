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

const createDebt = async (debtMain, debtDetail, conn) => {
    try {
        const debtMainSql = 'INSERT INTO debt_main SET gid = ?, debt_date = ?, title = ?, total = ?, lender = ?, split_method = ?, status = ?;';
        const debtMainData = [debtMain.gid, debtMain.debt_date, debtMain.title, debtMain.total, debtMain.lender, debtMain.split_method, 1];
        const [debtMainResult] = await conn.execute(debtMainSql, debtMainData);
        let debtMainId = debtMainResult.insertId;
        for (let debt of debtDetail) {
            const debtDetailSql = 'INSERT INTO debt_detail SET debt_id = ?, borrower =?, amount = ?';
            const debtDetailData = [debtMainId, debt.borrower, debt.amount];
            await conn.execute(debtDetailSql, debtDetailData);
        }
        return true;
    } catch (err) {
        console.log('ERROR AT createDebt: ', err);
        return false;
    }
};

const getBalance = async (gid, borrower, lender, conn) => {
    try {
        const sql = 'SELECT id, amount from debt_balance WHERE  gid = ? AND lender = ? AND borrower = ?';
        const data = [gid, lender, borrower];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.log('ERROR AT getBalance: ', err);
        return false;
    }
};
const createBalance = async (gid, borrower, lender, debt, conn) => {
    try {
        const sql = `INSERT INTO debt_balance SET gid = ?, borrower = ?, lender = ?, amount=? `;
        const data = [gid, borrower, lender, debt];
        const result = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.log('ERROR AT createBalance: ', err);
        return false;
    }
};
const updateBalance = async (conn, id, gid, newBalances, borrower, lender) => {
    try {
        if ((borrower, lender)) {
            //需要交換借貸關係
            const sql = 'UPDATE debt_balance SET gid = ?, borrower = ?, lender = ?, amount=? WHERE id = ?';
            const data = [gid, lender, borrower, newBalances, id]; //交換
            await conn.execute(sql, data);
        } else {
            const sql = 'UPDATE debt_balance SET gid = ?, amount=? WHERE id = ?';
            const data = [gid, newBalances, id];
            await conn.execute(sql, data);
        }
        return true;
    } catch (err) {
        console.log('ERROR AT updateBalance: ', err);
        return false;
    }
};
module.exports = { getDebtMain, getDebtDetail, createDebt, getBalance, updateBalance, createBalance };
