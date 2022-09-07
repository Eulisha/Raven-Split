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
        const debtDetailSql = 'SELECT borrower, amount FROM debt_detail WHERE debt_id = ? AND borrower = ?';
        const debtDetailResult = await pool.execute(debtDetailSql, [debtId, uid]);
        return debtDetailResult;
    }
};

const createDebtMain = async (conn, debtMain) => {
    try {
        const sql = 'INSERT INTO debt_main SET gid = ?, debt_date = ?, title = ?, total = ?, lender = ?, split_method = ?, status = ?;';
        const data = [debtMain.gid, debtMain.debt_date, debtMain.title, debtMain.total, debtMain.lender, debtMain.split_method, 1];
        const [result] = await conn.execute(sql, data);
        let debtMainId = result.insertId;
        return debtMainId;
    } catch (err) {
        console.log('ERROR AT createDebtMain: ', err);
        return false;
    }
};

const createDebtDetail = async (conn, debtMainId, debtDetail) => {
    try {
        for (let debt of debtDetail) {
            const sql = 'INSERT INTO debt_detail SET debt_id = ?, borrower =?, amount = ?';
            const data = [debtMainId, debt.borrower, debt.amount];
            await conn.execute(sql, data);
            return true;
        }
    } catch (err) {
        console.log('ERROR AT createDebtDetail: ', err);
        return false;
    }
};
const createDebtBalance = async (gid, memberCombo, conn) => {
    try {
        //新增balance, 初始借貸為0
        for (let pair of memberCombo) {
            const sql = `INSERT INTO debt_balance (gid, lender, borrower, amount) VALUES (?,?,?,?)`;
            const data = [gid, pair[0], pair[1], 0];
            await conn.execute(sql, data);
        }
        return true;
    } catch (err) {
        console.log('ERROR AT createDebtBalance: ', err);
        return null;
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
const deleteDebts = async (conn, gid) => {
    try {
        console.log('groupId:', gid);
        const sql = 'UPDATE debt_main SET status = 0 WHERE gid = ?;';
        const data = [gid];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.log('ERROR AT deleteDebtMain: ', err);
        return false;
    }
};
const deleteDebtBalance = async (conn, gid) => {
    try {
        console.log('groupId:', gid);
        const sql = 'DELETE FROM debt_balance WHERE gid = ?;';
        const data = [gid];
        const [result] = await conn.execute(sql, data);
        console.log(result);
        return true;
    } catch (err) {
        console.log('ERROR AT deleteDebtBalance: ', err);
        return false;
    }
};

module.exports = { getDebtMain, getDebtDetail, createDebtMain, createDebtDetail, createDebtBalance, getBalance, updateBalance, createBalance, deleteDebts, deleteDebtBalance };
