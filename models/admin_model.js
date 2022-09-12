const pool = require('../config/mysql');

const createGroup = async (conn, group_name, members) => {
    try {
        console.log(conn);
        //新增group
        const groupSql = 'INSERT INTO `groups` SET name = ?, status = ?';
        const groupData = [group_name, 1];
        const groupResult = await conn.execute(groupSql, groupData);
        const groupId = groupResult[0].insertId;
        //新增mebers
        for (let member of members) {
            const memberSql = 'INSERT INTO members SET gid = ?, uid = ?, role = ?, status = ?';
            const memberData = [groupId, member.uid, member.role, 1];
            const memberResult = await conn.execute(memberSql, memberData);
        }
        return groupId;
    } catch (err) {
        console.log('ERROR AT createGroup: ', err);
        return null;
    }
};
const createMember = async (gid, uid, role) => {
    try {
        const sql = 'INSERT INTO `members` SET gid = ?, uid = ?, role = ?, status = ?';
        const data = [gid, uid, role, 1];
        const [result] = await pool.execute(sql, data);
        const memberId = result.insertId;
        return memberId;
    } catch (err) {
        console.log('ERROR AT createMember: ', err);
        return null;
    }
};
const getUserGroups = async (uid) => {
    try {
        console.log('uid: ', uid);
        const sql = 'SELECT gid, name FROM members LEFT JOIN `groups` ON `groups`.id = members.gid WHERE uid = ? AND `groups`.status = ?;';
        const data = [uid, 1];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result;
    } catch (err) {
        console.log('ERROR AT getUserGroups: ', err);
        return null;
    }
};

const getGroupMembers = async (gid) => {
    try {
        console.log('gid: ', gid);
        const sql = 'SELECT uid, name FROM members LEFT JOIN `users` ON `users`.id = members.uid WHERE members.gid = ? AND `users`.status = ?;';
        const data = [gid, 1];
        const [result] = await pool.execute(sql, data);
        // console.log(result);
        return result;
    } catch (err) {
        console.log('ERROR AT getGroupMembers: ', err);
        return null;
    }
};

const updateGroup = async (gid, group_name) => {
    try {
        // console.log(group_name);
        const groupSql = 'UPDATE `groups` SET name = ? WHERE id = ?';
        const groupData = [group_name, gid];
        await pool.execute(groupSql, groupData);
        return true;
    } catch (err) {
        console.log('ERROR AT updateGroup: ', err);
        return null;
    }
};
const deleteMember = async (gid, uid) => {
    try {
        console.log(gid, uid);
        const sql = 'UPDATE members SET status = 0 WHERE gid = ? AND uid = ?';
        const data = [gid, uid];
        await pool.execute(sql, data);
        return true;
    } catch (err) {
        console.log('ERROR AT deleteMember: ', err);
        return null;
    }
};
module.exports = { createGroup, createMember, getUserGroups, getGroupMembers, updateGroup, deleteMember };
