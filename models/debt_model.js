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
const postDebt = async (debtMain, debtDetail, conn) => {
    try {
        const debtMainSql = `INSERT INTO debt_main (gid, debt_date, title, total, lender, split_method, debt_status) 
    VALUE (?,?,?,?,?,?,?);`;
        const debtMainData = [debtMain.gid, debtMain.debt_date, debtMain.title, debtMain.total, debtMain.lender, debtMain.split_method, 1];
        const debtMainResult = await conn.execute(debtMainSql, debtMainData);
        const debtId = debtMainResult[0].insertId;
        for (let debt of debtDetail) {
            const debtDetailSql = `INSERT INTO debt_detail (debt_id, borrower, amount) VALUE (?,?,?)`;
            const debtDetailData = [debtId, debt.borrower, debt.amount];
            await conn.execute(debtDetailSql, debtDetailData);
        }
        return true;
    } catch (err) {
        console.log('ERROR AT postDebt: ', err);
        return null;
    }
};

const getBalance = async (gid, lender, conn) => {
    try {
        const sql = `SELECT * from debt_balance WHERE  gid = ? AND lender = ? OR ? = borrower`;
        const data = [gid, lender, lender];
        const result = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.log('ERROR AT createGroup: ', err);
        return null;
    }
};
const updateBalance = async (newBalances, conn) => {
    try {
        for (let newbalance of newBalances) {
            const sql = `INSERT INTO debt_balance (gid, lender, borrower, amount) VALUES (?, ?, ? ,?)`;
            const data = [newbalance.gid, newbalance.lender, newbalance.borrower, newbalance.amount];
            await conn.execute(sql, data);
        }
        return true;
    } catch (err) {
        console.log('ERROR AT createGroup: ', err);
        return null;
    }
};
module.exports = { getDebtMain, getDebtDetail, postDebt, getBalance, updateBalance };
