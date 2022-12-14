const { neo4j } = require('../config/neo4j');
const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');

const updatedBalanceGraph = async (conn, txc, gid) => {
    try {
        const balance = await Debt.getAllBalances(conn, gid);
        const resultGetGraph = await Graph.getGraph(txc, neo4j.int(gid));
        const graph = resultGetGraph.records.map((record) => {
            let amount = record.get('amount').toNumber();
            let borrower = record.get('borrower').toNumber();
            let lender = record.get('lender').toNumber();
            return { borrower, lender, amount };
        });
        return { balance, graph };
    } catch (err) {
        console.error('@updatedBalanceGraph handler: err:', req.path, err);
        return err;
    }
};
module.exports = { updatedBalanceGraph };
