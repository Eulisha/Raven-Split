const pool = require('../config/mysql');

const checkExit = async (email) => {
    try {
        const sql = `SELECT id FROM users WHERE email = ? AND status = 1`;
        const data = [email];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        console.log(err);
        return err;
    }
};

const signUp = async (email, password, name, cellphone, provider) => {
    try {
        const sql = 'INSERT INTO users SET email = ?, password = ?, name = ?, cellphone = ?, provider = ?, status = ?';
        const data = [email, password, name, cellphone, provider, 1];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result.insertId;
    } catch (err) {
        console.log(err);
        return err;
    }
};
const signIn = async (email) => {
    try {
        const sql = `SELECT * FROM users WHERE email = ? AND status = 1`;
        const data = [email];
        const [result] = await pool.execute(sql, data);
        return result;
    } catch (err) {
        console.log(err);
        return err;
    }
};
const getUserGroups = async (uid) => {
    try {
        console.log('uid: ', uid);
        const sql = 'SELECT gid, name, role FROM group_users LEFT JOIN `groups` ON `groups`.id = group_users.gid WHERE uid = ? AND `groups`.status = ?;';
        const data = [uid, 1];
        const [result] = await pool.execute(sql, data);
        console.log(result);
        return result;
    } catch (err) {
        console.log('ERROR AT getUserGroups: ', err);
        return null;
    }
};

module.exports = { signUp, signIn, checkExit, getUserGroups };