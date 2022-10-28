require('dotenv').config();
const { driver, neo4j } = require('../config/neo4j');
const GraphHandler = require('./graph_handler');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');

const updateBestPathGraph = async (gid) => {
    try {
        const session = driver.session();
        const txc = session.beginTransaction();
        const [graph, debtsForUpdate] = await GraphHandler.getBestxPath(txc, gid);
        const updateGraph = await Graph.updateBestPath(txc, neo4j.int(gid), debtsForUpdate);
        await txc.commit();
    } catch (err) {
        console.error(err);
        await txc.rollback();
        return err;
    } finally {
        session.close();
    }
};

updateBestPathGraph(500);
