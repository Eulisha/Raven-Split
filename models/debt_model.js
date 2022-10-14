const pool = require('../config/mysql');

const getDebts = async (gid, pageSize, paging = 0) => {
    try {
        const debtMainSql = 'SELECT id, `date`, title, total, lender, split_method FROM debt_main WHERE gid = ?  AND status = 1  ORDER BY `date` DESC, id DESC LIMIT ? OFFSET ?;'; //排序方式為日期+建立順序(id)
        const debtMainResult = await pool.query(debtMainSql, [gid, Number(pageSize), Number(pageSize) * paging]);
        return debtMainResult;
    } catch (err) {
        return false;
    }
};

const getDebtCount = async (gid) => {
    try {
        const sql = 'SELECT count(id) AS count FROM debt_main WHERE gid = ? AND status =1';
        const data = [gid];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        return false;
    }
};

const getDebt = async (conn, debtId) => {
    try {
        const sql = 'SELECT gid, lender FROM debt_main WHERE id = ? AND status = 1 FOR UPDATE;';
        const data = [debtId];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        return false;
    }
};

const getDebtDetail = async (debtId, uid) => {
    try {
        if (uid) {
            //查該筆帳某個人的分帳
            const sql =
                'SELECT d.id, d.borrower, d.amount FROM debt_detail AS d LEFT JOIN debt_main AS m ON d.debt_id = m.id WHERE d.debt_id = ? AND d.borrower = ? AND m.status = 1';
            const data = [debtId, uid];
            const [result] = await pool.execute(sql, data);
            return result;
        } else {
            //查該筆帳的所有分帳
            const sql = 'SELECT d.id, d.borrower, d.amount FROM debt_detail AS d LEFT JOIN debt_main AS m ON d.debt_id = m.id WHERE d.debt_id = ? AND m.status = 1';
            const data = [debtId];
            const [result] = await pool.execute(sql, data);
            return result;
        }
    } catch (err) {
        return false;
    }
};

const getDebtDetailTrx = async (conn, debtId) => {
    const sql = 'SELECT d.id, d.borrower, d.amount FROM debt_detail AS d LEFT JOIN debt_main AS m ON d.debt_id = m.id WHERE d.debt_id = ? AND m.status = 1';
    const data = [debtId];
    const [result] = await conn.execute(sql, data);
    return result;
};

const createDebt = async (conn, gid, debtMain) => {
    try {
        const sql = 'INSERT INTO debt_main SET gid = ?, date = ?, title = ?, total = ?, lender = ?, split_method = ?, status = ?;';
        const data = [gid, debtMain.date, debtMain.title, debtMain.total, debtMain.lender, debtMain.split_method, 1];
        const [result] = await conn.execute(sql, data);
        let debtMainId = result.insertId;
        return debtMainId;
    } catch (err) {
        return false;
    }
};

const createDebtDetail = async (conn, debtMainId, debtDetail) => {
    try {
        const detailIds = [];
        for (let debt of debtDetail) {
            const sql = 'INSERT INTO debt_detail SET debt_id = ?, borrower =?, amount = ?';
            const data = [debtMainId, debt.borrower, debt.amount];
            const [result] = await conn.execute(sql, data);
            detailIds.push(result.insertId);
        }
        return detailIds;
    } catch (err) {
        return false;
    }
};
const getAllBalances = async (conn, gid) => {
    try {
        const sql = 'SELECT * from debt_balance WHERE gid = ?';
        const data = [gid];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        return false;
    }
};
const getBalance = async (conn, gid, borrower, lender) => {
    try {
        const sql = 'SELECT id, lender, borrower, amount from debt_balance WHERE gid = ? AND lender = ? AND borrower = ?';
        const data = [gid, lender, borrower];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
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
        return false;
    }
};
const deleteGroupDebts = async (conn, gid) => {
    try {
        const sql = 'UPDATE debt_main SET status = 0 WHERE gid = ?;';
        const data = [gid];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
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
        return false;
    }
};
const deleteDebtBalances = async (conn, gid) => {
    try {
        const sql = 'DELETE FROM debt_balance WHERE gid = ?;';
        const data = [gid];
        const [result] = await conn.execute(sql, data);
        return true;
    } catch (err) {
        return false;
    }
};
const deleteDebtBalance = async (conn, balanceId) => {
    try {
        const sql = 'DELETE FROM debt_balance WHERE id = ?;';
        const data = [balanceId];
        const [result] = await conn.execute(sql, data);
        return true;
    } catch (err) {
        return false;
    }
};
const getUserBalances = async (uid) => {
    try {
        const sqlBorrow =
            'SELECT gid, `groups`.name AS group_name, type, lender, `users`.name AS user_name, amount from debt_balance LEFT JOIN `groups` ON debt_balance.gid = `groups`.id LEFT JOIN `users` ON `users`.id = lender WHERE `groups`.status = 1 AND borrower = ? ORDER by lender';
        const dataBorrow = [uid];
        const [resultBorrow] = await pool.execute(sqlBorrow, dataBorrow);
        const sqlLend =
            'SELECT gid, `groups`.name AS group_name, type, borrower, `users`.name AS user_name, amount from debt_balance LEFT JOIN `groups` ON debt_balance.gid = `groups`.id LEFT JOIN `users` ON `users`.id = borrower WHERE `groups`.status = 1 AND lender = ? ORDER by borrower';
        const dataLend = [uid];
        const [resultLend] = await pool.execute(sqlLend, dataLend);
        return [resultBorrow, resultLend];
    } catch (err) {
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
        return null;
    }
};

module.exports = {
    getDebts,
    getDebtCount,
    getDebt,
    getDebtDetail,
    getDebtDetailTrx,
    createDebt,
    createDebtDetail,
    getAllBalances,
    getBalance,
    updateBalance,
    createBalance,
    deleteGroupDebts,
    deleteDebt,
    deleteDebtBalances,
    deleteDebtBalance,
    getUserBalances,
    createBatchBalance,
};
