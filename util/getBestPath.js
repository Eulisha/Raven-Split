const { allNodes, sourceEdge, allPaths } = require('../models/graph_model.js');

const getBestPath = async (group, session) => {
    try {
        console.time('all');
        const graph = {};
        const allNodeList = [];
        const pathsStructure = {};
        const order = [];
        // console.log('search group:', group);

        // 1) Neo4j get all path
        try {
            // 1-1) 查詢圖中所有node
            console.time('db1');
            const allNodesResult = await allNodes(session, group);
            console.timeEnd('db1');
            allNodesResult.records.forEach((element) => {
                let name = element.get('name').toNumber();
                graph[name] = {};
                allNodeList.push(name);
            });
            // console.log('allNodeList: ', allNodeList);

            // 1-2) 查每個source出去的edge數量
            for (let source of allNodeList) {
                console.time('db2');
                const sourceEdgeResult = await sourceEdge(session, source, group);
                console.timeEnd('db2');
                pathsStructure[source] = { sinksSummary: { sinks: [], qty: 0 }, sinks: {} };
                pathsStructure[source].sinksSummary.qty = sourceEdgeResult.records.length; //紀錄qty
                sourceEdgeResult.records.forEach((element, index) => {
                    pathsStructure[source].sinksSummary.sinks.push(element.get('name').toNumber());
                });
                order.push({ source: source, qty: pathsStructure[source].sinksSummary.qty }); //同步放進order的列表中
            }
            order.sort((a, b) => {
                return b.qty - a.qty; //排序列表供後面決定順序用
            });
        } catch (err) {
            console.log('ERROR AT getBestPath Neo4j Search: ', err);
            return null;
        }
        // console.log('order:', order);

        //第一層：iterate sources
        for (let source of order) {
            // console.log('source: ', source.source);
            let currentSource = source.source; //當前的source
            console.time('db3');
            // 1-3) 查所有的路徑
            const pathsResult = await allPaths(session, currentSource, group);
            // console.log(pathsResult);
            console.timeEnd('db3');
            //第二層：iterate paths in source
            for (let i = 0; i < pathsResult.records.length; i++) {
                const sink = pathsResult.records[i]._fields[0].end.properties.name.toNumber(); //當前path的sink
                // console.log('sink', sink);
                if (!pathsStructure[currentSource].sinksSummary.sinks.includes(sink)) {
                    //代表和這個人沒有直接的借貸關係
                    continue;
                }
                //第三層：iterate edges in path
                let edges = []; //組成path的碎片陣列
                pathsResult.records[i]._fields[0].segments.forEach((edge) => {
                    console.log('edge from neo', edge);
                    console.log(edge.relationship.properties.amount);
                    console.log(edge.end.properties.name);
                    //更新欠款圖graph的debt
                    // graph[edge.start.properties.name.toNumber()][edge.end.properties.name.toNumber()] = edge.relationship.properties.amount.toNumber(); //TODO:不確定為什麼這邊不需要.toNumber
                    graph[edge.start.properties.name.toNumber()][edge.end.properties.name.toNumber()] = edge.relationship.properties.amount;
                    //將碎片放進陣列中
                    edges.push([edge.start.properties.name.toNumber(), edge.end.properties.name.toNumber()]);
                    // console.log('放碎片：', edges);
                });
                //更新路徑表pathsStructure
                if (!pathsStructure[currentSource].sinks[sink]) {
                    pathsStructure[currentSource].sinks[sink] = [];
                }
                pathsStructure[currentSource].sinks[sink].push(edges);
                // console.log('完整碎片組', edges);
            }
        }
        // console.log('最終存好的graph: ', graph);

        // 3) calculate best path
        console.time('split');
        // 第一層：iterate sources by order
        const debtsForUpdate = []; //用來存所有被變動的路徑與值
        for (let source of order) {
            // console.log('目前souce: ', source.source);
            //第二層：iterate sinks in source
            // // console.log('所有sinks:', pathsStructure[source.source].sinks);
            Object.keys(pathsStructure[source.source].sinks).forEach((sink) => {
                // console.log('目前sink:', sink);
                let totalFlow = 0; //用來存當圈要加到最短sounce-sink的流量
                //第三層：iterate paths of source->sink
                for (let path of pathsStructure[source.source].sinks[sink]) {
                    // console.log('目前path', path);
                    let bottleneckValue = 0;
                    let pathBlock = false;
                    if (path.length !== 1) {
                        //第四層：iterate edges in path
                        // console.log('扣除前：', graph);
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
                        // console.log('debts', debts);
                        bottleneckValue = Math.min.apply(Math, debts);
                        // console.log('扣除量:', bottleneckValue);
                        //將所有edge都減去瓶頸流量
                        path.forEach((edge) => {
                            graph[edge[0]][edge[1]] -= bottleneckValue;
                            debtsForUpdate.push({ borrowerId: edge[0], lenderId: edge[1], adjust: -bottleneckValue });
                        });
                        //找出瓶頸edge的索引號碼
                        bottleneckIndex = debts.indexOf(bottleneckValue); //FIXME:好像沒用到
                        // 3-3) 將流量先暫加到totalFlow
                        totalFlow += bottleneckValue;
                        // console.log('累積ttlflow:', totalFlow);
                        // console.log('扣除後：', graph);
                    }
                }
                // 3-4) 將totalFlow加到最短的邊上
                if (totalFlow) {
                    // console.log('總ttlflow:', totalFlow);
                    graph[source.source][sink] += totalFlow;
                    debtsForUpdate.push({ borrowerId: source.source, lenderId: sink, adjust: totalFlow });
                    // console.log('加流量：', graph);
                }
            });
        }
        console.timeEnd('split');
        console.log(graph);
        console.timeEnd('all');
        return [graph, debtsForUpdate];
    } catch (err) {
        console.log('ERROR AT getBestPath: ', err);
        return null;
    }
};
// getBestPath();
module.exports = { getBestPath };
