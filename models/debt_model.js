const pool = require('../config/mysql');

const getDebtMain = async (group, pageSize, paging) => {
    // const debtMainSql = 'SELECT id, date, title, total, lender FROM debt_main WHERE gid = ? ORDER BY date DESC, id ASC LIMIT ?, ?;'; //排序方式為日期+建立順序(id)
    // const [debtMainResult] = await pool.query(debtMainSql, [group, page, pageSize]);
    const debtMainSql = 'SELECT id, `date`, title, total, lender FROM debt_main WHERE gid = ?  AND status = 1 LIMIT ? OFFSET ?;'; //排序方式為日期+建立順序(id)
    const debtMainResult = await pool.query(debtMainSql, [group, pageSize, pageSize * paging]);
    return debtMainResult;
};

const getDebtDetail = async (debtMainId, uid) => {
    if (uid) {
        //查該筆帳某個人的分帳
        const sql = 'SELECT id, borrower, amount, split_method FROM debt_detail WHERE debt_main_id = ? AND borrower = ?';
        const data = [debtMainId, uid];
        const [result] = await pool.execute(sql, data);
        return result;
    } else {
        //查該筆帳的所有分帳
        const sql = 'SELECT id, borrower, amount, split_method FROM debt_detail WHERE debt_main_id = ?';
        const data = [debtMainId];
        const [result] = await pool.execute(sql, data);
        return result;
    }
};

const createDebtMain = async (conn, debtMain) => {
    try {
        const sql = 'INSERT INTO debt_main SET gid = ?, date = ?, title = ?, total = ?, lender = ?, status = ?;';
        const data = [debtMain.gid, debtMain.date, debtMain.title, debtMain.total, debtMain.lender, 1];
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
            const sql = 'INSERT INTO debt_detail SET debt_main_id = ?, borrower =?, amount = ?, split_method = ?';
            const data = [debtMainId, debt.borrower, debt.amount, debt.split_method];
            await conn.execute(sql, data);
            return true;
        }
    } catch (err) {
        console.log('ERROR AT createDebtDetail: ', err);
        return false;
    }
};
const getAllBalances = async (gid) => {
    try {
        console.log('gid: ', gid);
        const sql = 'SELECT * from debt_balance WHERE gid = ?';
        const data = [gid];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result;
    } catch (err) {
        console.log('ERROR AT getAllBalance: ', err);
        return false;
    }
};
const getBalance = async (conn, gid, borrower, lender) => {
    try {
        const sql = 'SELECT id, amount from debt_balance WHERE gid = ? AND lender = ? AND borrower = ?';
        const data = [gid, lender, borrower];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.log('ERROR AT getBalance: ', err);
        return false;
    }
};
const createBalance = async (conn, gid, borrower, lender, debt) => {
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
const updateBalance = async (conn, id, borrower, lender, newBalance) => {
    try {
        const sql = 'UPDATE debt_balance SET borrower = ?, lender = ?, amount=? WHERE id = ?';
        const data = [borrower, lender, newBalance, id];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.log('ERROR AT updateBalance: ', err);
        return false;
    }
};
const deleteGroupDebts = async (conn, gid) => {
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
const deleteDebt = async (conn, debtId, status) => {
    try {
        const sql = 'UPDATE debt_main SET status = ? WHERE id = ?;'; //customer delete: 0 customer update: -1
        const data = [status, debtId];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.log('ERROR AT deleteDebt: ', err);
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

const createBatchBalance = async (gid, memberCombo, conn) => {
    //批次建立, 暫時沒用到
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

module.exports = {
    getDebtMain,
    getDebtDetail,
    createDebtMain,
    createDebtDetail,
    getAllBalances,
    getBalance,
    updateBalance,
    createBalance,
    deleteGroupDebts,
    deleteDebt,
    deleteDebtBalance,
    createBatchBalance,
};
