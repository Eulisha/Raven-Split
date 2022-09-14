const Debt = require('../models/debt_model');
const Graph = require('../models/graph_model');

const updated_balance_graph = async (gid) => {
    const balance = await Debt.getAllBalances(gid);
    const resultGetGraph = await Graph.getGraph(gid);
    const graph = resultGetGraph.records.map((record) => {
        let amount = record.get('amount').toNumber();
        let borrower = record.get('borrower').toNumber();
        let lender = record.get('lender').toNumber();
        return { borrower, lender, amount };
    });
    return { balance, graph };
};
module.exports = { updated_balance_graph };
