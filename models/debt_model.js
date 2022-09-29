const pool = require('../config/mysql');

const getDebts = async (gid, pageSize, paging = 0) => {
    console.info('@getDebts: gid: ', gid);
    try {
        const debtMainSql = 'SELECT id, `date`, title, total, lender, split_method FROM debt_main WHERE gid = ?  AND status = 1  ORDER BY `date` DESC, id DESC LIMIT ? OFFSET ?;'; //排序方式為日期+建立順序(id)
        const debtMainResult = await pool.query(debtMainSql, [gid, Number(pageSize), Number(pageSize) * paging]);
        return debtMainResult;
    } catch (err) {
        console.error('ERROR AT getDebts: ', err);
        return false;
    }
};

const getDebtCount = async (gid) => {
    console.info('@getDebtPages: gid: ', gid);
    try {
        const sql = 'SELECT count(id) AS count FROM debt_main WHERE gid = ? AND status =1';
        const data = [gid];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        console.error('ERROR AT getDebtPages: ', err);
        return false;
    }
};
//for update, delete internal back-end usage
const getDebt = async (conn, debtId) => {
    console.info('@getDebt: debtId: ', debtId);
    try {
        const sql = 'SELECT gid, lender FROM debt_main WHERE id = ? AND status = 1 FOR UPDATE;';
        const data = [debtId];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.error('ERROR AT getDebt: ', err);
        return false;
    }
};

const getDebtDetail = async (debtId, uid) => {
    console.info('@getDebtDetail: debtId uid: ', debtId, uid);
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
        console.error('ERROR AT getDebtDetail: ', err);
        return false;
    }
};

const getDebtDetailTrx = async (conn, debtId) => {
    console.info('@getDebtDetailTrx: debtId uid: ', debtId);
    //查該筆帳的所有分帳
    const sql = 'SELECT d.id, d.borrower, d.amount FROM debt_detail AS d LEFT JOIN debt_main AS m ON d.debt_id = m.id WHERE d.debt_id = ? AND m.status = 1';
    const data = [debtId];
    const [result] = await conn.execute(sql, data);
    return result;
};

const createDebt = async (conn, gid, debtMain) => {
    console.info('model: gid,debtMain : ', gid, debtMain);
    try {
        const sql = 'INSERT INTO debt_main SET gid = ?, date = ?, title = ?, total = ?, lender = ?, split_method = ?, status = ?;';
        const data = [gid, debtMain.date, debtMain.title, debtMain.total, debtMain.lender, debtMain.split_method, 1];
        const [result] = await conn.execute(sql, data);
        let debtMainId = result.insertId;
        return debtMainId;
    } catch (err) {
        console.error('ERROR AT createDebt: ', err);
        return false;
    }
};

const createDebtDetail = async (conn, debtMainId, debtDetail) => {
    console.info('@createDebtDetail: debtMainId, debtDetail: ', debtMainId, debtDetail);
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
        console.error('ERROR AT createDebtDetail: ', err);
        return false;
    }
};
const getAllBalances = async (conn, gid) => {
    console.info('@getAllBalances: gid : ', gid);
    try {
        const sql = 'SELECT * from debt_balance WHERE gid = ?';
        const data = [gid];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.error('ERROR AT getAllBalance: ', err);
        return false;
    }
};
const getBalance = async (conn, gid, borrower, lender) => {
    console.info('@getBalance model: gid, borrower, lender : ', gid, borrower, lender);
    try {
        const sql = 'SELECT id, lender, borrower, amount from debt_balance WHERE gid = ? AND lender = ? AND borrower = ?';
        const data = [gid, lender, borrower];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.error('ERROR AT getBalance: ', err);
        return false;
    }
};
const createBalance = async (conn, gid, borrower, lender, debt) => {
    console.info('@createBalance: gid, borrower, lender, debt : ', gid, borrower, lender, debt);
    try {
        const sql = `INSERT INTO debt_balance SET gid = ?, borrower = ?, lender = ?, amount=? `;
        const data = [gid, borrower, lender, debt];
        const result = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.error('ERROR AT createBalance: ', err);
        return false;
    }
};
const updateBalance = async (conn, id, borrower, lender, newBalance) => {
    console.info('@updateBalance: id, borrower, lender, newBalance:', id, borrower, lender, newBalance);
    try {
        const sql = 'UPDATE debt_balance SET borrower = ?, lender = ?, amount=? WHERE id = ?';
        const data = [borrower, lender, newBalance, id];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT updateBalance: ', err);
        return false;
    }
};
const deleteGroupDebts = async (conn, gid) => {
    // WARNING: THIS MODEL IS NOT USED AFTER CHANGING SETTLE FLOW LOGIC
    console.info('@deleteGroupDebts: gid : ', gid);
    try {
        const sql = 'UPDATE debt_main SET status = 0 WHERE gid = ?;';
        const data = [gid];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteDebtMain: ', err);
        return false;
    }
};
const deleteDebt = async (conn, debtId, status) => {
    console.info('@deleteDebt: debtId status: ', debtId, status);
    try {
        const sql = 'UPDATE debt_main SET status = ? WHERE id = ?;'; //customer delete: 0 customer update: -1
        const data = [status, debtId];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteDebt: ', err);
        return false;
    }
};
const deleteDebtBalances = async (conn, gid) => {
    console.info('@deleteDebtBalances: gid : ', gid);
    try {
        const sql = 'DELETE FROM debt_balance WHERE gid = ?;';
        const data = [gid];
        const [result] = await conn.execute(sql, data);
        console.log(result);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteDebtBalances: ', err);
        return false;
    }
};
const deleteDebtBalance = async (conn, balanceId) => {
    console.info('@deleteDebtBalances: balanceId : ', balanceId);
    try {
        const sql = 'DELETE FROM debt_balance WHERE id = ?;';
        const data = [balanceId];
        const [result] = await conn.execute(sql, data);
        console.debug(result);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteDebtBalance: ', err);
        return false;
    }
};
const getUserBalances = async (uid) => {
    console.info(uid);
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
        console.error('ERROR AT getUserBalances: ', err);
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
        console.error('ERROR AT createDebtBalance: ', err);
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
