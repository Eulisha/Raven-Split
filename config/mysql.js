const dotenv = require('dotenv').config();
const mysql = require('mysql2');

// console.log(process.env.RDS_HOST, process.env.RDS_PORT, process.env.RDS_USER, process.env.RDS_PASS, process.env.RDS_NAME);

const connection = mysql.createPool({
    host: process.env.DB_HOST,
    port: process.env.DB_PORT,
    user: process.env.DB_USER,
    password: process.env.DB_PASS,
    database: process.env.DB_NAME,
    dateStrings: 'date',
});
// RDS本地目前還連不上
// const connection = mysql.createPool({
//     host: process.env.RDS_HOST,
//     port: process.env.RDS_PORT,
//     user: process.env.RDS_USER,
//     password: process.env.RDS_PASS,
//     database: process.env.RDS_NAME,
//     dateStrings: 'date',
// });
const pool = connection.promise();

module.exports = pool;
