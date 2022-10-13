const pool = require('../config/mysql');

const checkExist = async (email) => {
    try {
        const sql = `SELECT id, name FROM users WHERE email = ? AND status = 1`;
        const data = [email];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        return err;
    }
};

const signUp = async (email, password, name, cellphone, provider) => {
    try {
        const sql = 'INSERT INTO users SET email = ?, password = ?, name = ?, cellphone = ?, provider = ?, status = ?';
        const data = [email, password, name, cellphone, provider, 1];
        const [result] = await pool.execute(sql, data);
        return result.insertId;
    } catch (err) {
        return err;
    }
};
const signIn = async (email) => {
    try {
        const sql = 'SELECT * FROM users WHERE email = ? AND status = 1';
        const data = [email];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        return err;
    }
};
const getUserGroupRole = async (uid, gid) => {
    try {
        const sql = 'SELECT gid, role FROM group_users LEFT JOIN `groups` ON `groups`.id = group_users.gid WHERE uid = ? AND gid = ? AND `groups`.status = ?;';
        const data = [uid, gid, 1];
        const result = await pool.execute(sql, data);
        return result;
    } catch (err) {
        return null;
    }
};

const getUserGroups = async (uid) => {
    try {
        const sql = 'SELECT gid, name, type, role FROM group_users LEFT JOIN `groups` ON `groups`.id = group_users.gid WHERE uid = ? AND `groups`.status = ?;';
        const data = [uid, 1];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        return null;
    }
};

const getUserNames = async (conn, uid1, uid2) => {
    try {
        const sql = 'SELECT id, name FROM `users` WHERE id IN (?,?) AND status = ?';
        const data = [uid1, uid2, 1];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        return null;
    }
};

module.exports = { signUp, signIn, checkExist, getUserGroupRole, getUserGroups, getUserNames };
