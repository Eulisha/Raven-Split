const neo4j = require('neo4j-driver');
const host = process.env.NEO4J_HOST;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASS;
const driver = neo4j.driver(host, neo4j.auth.basic(user, password));

module.exports = { driver, neo4j };
