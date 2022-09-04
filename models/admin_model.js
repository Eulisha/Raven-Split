const pool = require('../config/mysql');

const createGroup = async (group_name, members) => {
    let conn;
    try {
        conn = await pool.getConnection();
        await conn.beginTransaction();
        // console.log(group_name);
        //新增group
        const groupSql = `INSERT INTO split_group (group_name, valid_status) VALUES (?, ?)`;
        const groupData = [group_name, 1];
        const groupResult = await conn.execute(groupSql, groupData);
        const groupId = groupResult[0].insertId;
        //新增mebers
        for (let member of members) {
            const memberSql = `INSERT INTO split_member (gid, uid, valid_status) VALUES (?,?,?);`;
            const memberData = [groupId, member, 1];
            const memberResult = await conn.execute(memberSql, memberData);
        }
        return [groupId, conn];
    } catch (err) {
        console.log('ERROR AT createGroup: ', err);
        await conn.rollback();
        await conn.release();
        return null;
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
        await conn.rollback();
        return null;
    } finally {
        await conn.release();
    }
};

module.exports = { createGroup, createDebtBalance };
