const pool = require('../config/mysql');

const createGroup = async (group_name, members, conn) => {
    try {
        // console.log(group_name);
        //新增group
        const groupSql = `INSERT INTO groups (group_name, status) VALUES (?, ?)`;
        const groupData = [group_name, 1];
        const groupResult = await conn.execute(groupSql, groupData);
        const groupId = groupResult[0].insertId;
        //新增mebers
        for (let member of members) {
            const memberSql = `INSERT INTO members (gid, uid, status) VALUES (?,?,?);`;
            const memberData = [groupId, member, 1];
            const memberResult = await conn.execute(memberSql, memberData);
        }
        return groupId;
    } catch (err) {
        console.log('ERROR AT createGroup: ', err);
        return null;
    }
};
const getUserGroups = async (uid) => {
    try {
        console.log(uid);
        const sql = 'SELECT gid, name FROM members LEFT JOIN `groups` ON `groups`.id = members.gid WHERE uid = ? AND `groups`.status = 1;';
        const data = [uid];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result;
    } catch (err) {
        console.log('ERROR AT getGroups: ', err);
        return null;
    }
};

module.exports = { createGroup, getUserGroups };
