const pool = require('../config/mysql');

const checkUserExist = async (email) => {
    try {
        const sql = `SELECT id, password FROM users WHERE email = ?`;
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
        return result.insertId;
    } catch (err) {
        console.log(err);
        return err;
    }
};
module.exports = { checkUserExist, signUp };
