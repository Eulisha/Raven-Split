const pool = require('../config/mysql');

const createGroup = async (conn, group_name, members) => {
    console.log('@createGroup: group_name, members: ', group_name, members);
    try {
        console.log(conn);
        //新增group
        const groupSql = 'INSERT INTO `groups` SET name = ?, status = ?';
        const groupData = [group_name, 1];
        const groupResult = await conn.execute(groupSql, groupData);
        const groupId = groupResult[0].insertId;
        //新增mebers
        for (let member of members) {
            const memberSql = 'INSERT INTO group_users SET gid = ?, uid = ?, role = ?, status = ?';
            const memberData = [groupId, member.uid, member.role, 1];
            const memberResult = await conn.execute(memberSql, memberData);
        }
        return groupId;
    } catch (err) {
        console.error('ERROR AT createGroup: ', err);
        return null;
    }
};
const createMember = async (gid, uid, role) => {
    console.log('@createMember: gid, uid, role', gid, uid, role);
    try {
        const sql = 'INSERT INTO group_users SET gid = ?, uid = ?, role = ?, status = ?';
        const data = [gid, uid, role, 1];
        const [result] = await pool.execute(sql, data);
        const memberId = result.insertId;
        return memberId;
    } catch (err) {
        console.error('ERROR AT createMember: ', err);
        return null;
    }
};

const getGroupUsers = async (gid) => {
    console.log('@getGroupUsers: gid:', gid);
    try {
        console.log('gid: ', gid);
        const sql = 'SELECT uid, name FROM group_users LEFT JOIN `users` ON `users`.id = group_users.uid WHERE group_users.gid = ? AND `users`.status = ?;';
        const data = [gid, 1];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result;
    } catch (err) {
        console.error('ERROR AT getGroupUsers: ', err);
        return null;
    }
};

const updateGroup = async (gid, group_name) => {
    console.log('updateGroup: gid, group_name:', gid, group_name);
    try {
        // console.log(group_name);
        const groupSql = 'UPDATE `groups` SET name = ? WHERE id = ?';
        const groupData = [group_name, gid];
        await pool.execute(groupSql, groupData);
        return true;
    } catch (err) {
        console.error('ERROR AT updateGroup: ', err);
        return null;
    }
};
const setSettling = async (gid, uid) => {
    console.log('@setSettling: gid, uid:', gid, uid);
    try {
        const sql = 'UPDATE `group_users` SET is_settling = 1 WHERE gid = ? AND uid = ?';
        const data = [gid, uid];
        await pool.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT setSettler: ', err);
        return null;
    }
};
const deleteMember = async (gid, uid) => {
    console.log('@deleteMember: gid,uid: ', gid, uid);
    try {
        console.log(gid, uid);
        const sql = 'UPDATE group_users SET status = 0 WHERE gid = ? AND uid = ?';
        const data = [gid, uid];
        await pool.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteMember: ', err);
        return null;
    }
};
module.exports = { createGroup, createMember, getGroupUsers, updateGroup, setSettling, deleteMember };
