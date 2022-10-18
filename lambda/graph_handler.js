const Graph = require('./graph_model');
const { neo4j } = require('./config/neo4j');

const getBestPath = async (txc, gid) => {
    try {
        const graph = {};
        const allNodeList = [];
        const pathsStructure = {};
        const order = [];

        // 1) Neo4j get all path
        try {
            // 1-1) 查詢圖中所有node
            const allNodesResult = await Graph.allNodes(txc, neo4j.int(gid));
            allNodesResult.records.forEach((element) => {
                let name = element.get('name').toNumber();
                graph[name] = {};
                allNodeList.push(name);
            });

            // 1-2) 查每個source出去的edge數量
            for (let source of allNodeList) {
                const sourceEdgeResult = await Graph.sourceEdge(txc, neo4j.int(gid), neo4j.int(source));

                pathsStructure[source] = {
                    sinksSummary: { sinks: [], qty: 0 },
                    sinks: {},
                };
                pathsStructure[source].sinksSummary.qty = sourceEdgeResult.records.length; //紀錄qty
                sourceEdgeResult.records.forEach((element, index) => {
                    pathsStructure[source].sinksSummary.sinks.push(element.get('name').toNumber());
                });
                order.push({ source, qty: pathsStructure[source].sinksSummary.qty }); //同步放進order的列表中
            }
            order.sort((a, b) => {
                return b.qty - a.qty; //排序列表供後面決定順序用
            });
        } catch (err) {
            console.error('get all path err: ', err);
            throw new Error(err);
        }

        //第一層：iterate sources
        for (let source of order) {
            let currentSource = source.source; //當前的source
            // 1-3) 查所有的路徑
            const pathsResult = await Graph.allPaths(txc, neo4j.int(gid), neo4j.int(currentSource));

            //第二層：iterate paths in source
            for (let i = 0; i < pathsResult.records.length; i++) {
                const sink = pathsResult.records[i]._fields[0].end.properties.name.toNumber(); //當前path的sink
                if (!pathsStructure[currentSource].sinksSummary.sinks.includes(sink)) {
                    //代表和這個人沒有直接的借貸關係
                    continue;
                }
                //第三層：iterate edges in path
                let edges = []; //組成path的碎片陣列
                let hasZero = false; //判斷是否路徑上有零
                for (let edge of pathsResult.records[i]._fields[0].segments) {
                    if (edge.relationship.properties.amount.toNumber() === 0) {
                        hasZero = true;
                        await Graph.deletePath(txc, neo4j.int(gid), edge.start.properties.name, edge.end.properties.name); //把零的重圖上刪掉
                    }
                    //更新欠款圖graph的debt
                    graph[edge.start.properties.name.toNumber()][edge.end.properties.name.toNumber()] = edge.relationship.properties.amount.toNumber();
                    //將碎片放進陣列中
                    edges.push([edge.start.properties.name.toNumber(), edge.end.properties.name.toNumber()]);
                }
                //如果還沒有建過該sink的array
                if (!pathsStructure[currentSource].sinks[sink]) {
                    pathsStructure[currentSource].sinks[sink] = [];
                }
                //更新路徑表pathsStructure
                if (!hasZero) {
                    pathsStructure[currentSource].sinks[sink].push(edges);
                }
            }
        }

        // 3) calculate best path
        // 第一層：iterate sources by order
        const debtsForUpdate = []; //用來存所有被變動的路徑與值
        for (let source of order) {
            //第二層：iterate sinks in source
            Object.keys(pathsStructure[source.source].sinks).forEach((sink) => {
                let totalFlow = 0; //用來存當圈要加到最短sounce-sink的流量
                //第三層：iterate paths of source->sink
                for (let path of pathsStructure[source.source].sinks[sink]) {
                    let bottleneckValue = 0;
                    let pathBlock = false;
                    if (path.length != 1) {
                        //如果等於1代表示source直接到sink的path
                        //第四層：iterate edges in path
                        let debts = [];

                        // 3-1) 找出路徑上每個edge的debt
                        for (let edge of path) {
                            if (!graph[edge[0]][edge[1]]) {
                                pathBlock = true;
                                break; //當兩點容量已為0或不存在則break
                            }
                            debts.push(graph[edge[0]][edge[1]]);
                        }
                        if (pathBlock) {
                            continue;
                        }

                        // 3-2) 算優化
                        //找出瓶頸edge流量
                        bottleneckValue = Math.min.apply(Math, debts);
                        //將所有edge都減去瓶頸流量
                        path.forEach((edge) => {
                            graph[edge[0]][edge[1]] -= bottleneckValue;
                            // debtsForUpdate.push({ borrowerId: edge[0], lenderId: edge[1], adjust: -bottleneckValue });
                            debtsForUpdate.push({
                                borrower: neo4j.int(edge[0]),
                                lender: neo4j.int(edge[1]),
                                amount: neo4j.int(-bottleneckValue),
                            });
                        });
                        // 3-3) 將流量先暫加到totalFlow
                        totalFlow += bottleneckValue;
                    }
                }
                // 3-4) 將totalFlow加到最短的邊上
                if (totalFlow) {
                    graph[source.source][sink] += totalFlow;
                    debtsForUpdate.push({
                        borrower: neo4j.int(source.source),
                        lender: neo4j.int(sink),
                        amount: neo4j.int(totalFlow),
                    });
                }
            });
        }
        return [graph, debtsForUpdate];
    } catch (err) {
        console.error('getBestPath ERROR: ', err);
        throw new Error(err);
    }
};

module.exports = { getBestPath };
