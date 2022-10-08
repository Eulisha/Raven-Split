const pool = require('../config/mysql');

const createGroup = async (conn, group_name, group_type, members) => {
    console.log('@createGroup: group_name, members: ', group_name, group_type, members);
    try {
        //新增group
        const groupSql = 'INSERT INTO `groups` SET name = ?, type = ?, status = ?';
        const groupData = [group_name, group_type, 1];
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
const createMember = async (conn, gid, uid, role) => {
    console.log('@createMember: gid, uid, role', gid, uid, role);
    try {
        const sql = 'INSERT INTO group_users SET gid = ?, uid = ?, role = ?, status = ?';
        const data = [gid, uid, role, 1];
        const [result] = await conn.execute(sql, data);
        const insertId = result.insertId;
        return insertId;
    } catch (err) {
        console.error('ERROR AT createMember: ', err);
        return null;
    }
};

const getGroupUserIds = async (gid) => {
    console.log('@getGroupUserIds: gid:', gid);
    try {
        const sql = 'SELECT uid FROM group_users LEFT JOIN `users` ON `users`.id = group_users.uid WHERE group_users.gid = ? AND `users`.status = ?;';
        const data = [gid, 1];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result;
    } catch (err) {
        console.error('ERROR AT getGroupUsers: ', err);
        return null;
    }
};

const getGroupUsers = async (gid) => {
    console.log('model: gid:', gid);
    try {
        const sql = 'SELECT uid, name, email FROM group_users LEFT JOIN `users` ON `users`.id = group_users.uid WHERE group_users.gid = ? AND `users`.status = ?;';
        const data = [gid, 1];
        const [result] = await pool.execute(sql, data);
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
const setSettleDone = async (conn, gid, uid) => {
    console.log('@setSettling: gid, uid:', gid, uid);
    try {
        const sql = 'UPDATE `group_users` SET is_settling = 0 WHERE gid = ? AND uid = ?';
        const data = [gid, uid];
        await conn.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT setSettler: ', err);
        return null;
    }
};
const deleteMember = async (gid, uid) => {
    console.log('@deleteMember: gid,uid: ', gid, uid);
    try {
        const sql = 'UPDATE group_users SET status = 0 WHERE gid = ? AND uid = ?';
        const data = [gid, uid];
        await pool.execute(sql, data);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteMember: ', err);
        return null;
    }
};
const checkGroupStatus = (gid) => {
    console.log('gid: ', gid);
    try {
        const sql = 'SELECT uid, name FROM `group_users` LEFT JOIN `users` ON `group_users`.uid = `users`.id WHERE gid = ? AND is_settling = 1';
        const data = [gid];
        const result = pool.execute(sql, data);
        return result;
    } catch (err) {
        console.error('ERROR AT checkGroupStatus: ', err);
        return null;
    }
};

const getNewDataAmount = async (conn, gid) => {
    try {
        const sql = 'SELECT hasNewData FROM `groups` WHERE id = ?';
        const data = [gid];
        const [result] = await conn.execute(sql, data);
        return result;
    } catch (err) {
        console.error('getNewDataAmount err: ', err);
        throw new Error({
            source: 'mysql',
            table: 'groups',
            querytype: 'SEARCH',
            callfunction: 'getNewDataAmount',
            msg: err,
        });
    }
};
const addNewDataAmount = async (conn, gid) => {
    try {
        const sql = 'UPDATE `groups` SET hasNewData = hasNewData + 1 WHERE id = ?';
        const data = [gid];
        const result = await conn.execute(sql, data);
        console.log('ifBestGraphOnSetting result', result);
        return result;
    } catch (err) {
        console.error('ifBestGraphOnSetting err: ', err);
        throw new Error({
            source: 'mysql',
            table: 'groups',
            querytype: 'UPDATE',
            callfunction: 'addHasNewData',
            msg: err,
        });
    }
};

const setProcessingBestGraph = async (conn, gid, bestGraphStatus) => {
    try {
        const sql = 'UPDATE `groups` SET hasNewData = ? WHERE id = ?';
        const data = [bestGraphStatus, gid];
        await conn.execute(sql, data);
        return;
    } catch (err) {
        console.error('setProcessingBestGraph err: ', err);

        throw new Error({
            source: 'mysql',
            table: 'groups',
            querytype: 'UPDATE',
            callfunction: 'setProcessingBestGraph',
            msg: err,
        });
    }
};

const setFinishedBestGraph = async (conn, gid, bestGraphStatus) => {
    try {
        const sql = 'UPDATE `groups` SET hasNewData = ? WHERE id = ?';
        const data = [bestGraphStatus, gid];
        await conn.execute(sql, data);
        return;
    } catch (err) {
        console.error('setFinishedBestGraph err: ', err);
        throw new Error({
            source: 'mysql',
            table: 'groups',
            querytype: 'UPDATE',
            callfunction: 'setFinishedBestGraph',
            msg: err,
        });
    }
};

module.exports = {
    createGroup,
    createMember,
    getGroupUsers,
    getGroupUserIds,
    updateGroup,
    setSettling,
    setSettleDone,
    deleteMember,
    checkGroupStatus,
    addNewDataAmount,
    getNewDataAmount,
    setProcessingBestGraph,
    setFinishedBestGraph,
};
