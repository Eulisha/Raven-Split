const { allNodes, sourceEdge, allPaths } = require('../models/settle_up_model');

const settleUp = async (req, res, group) => {
    console.time('all');
    const graph = {};
    const allNodeList = [];
    const pathsStructure = {};
    const order = [];
    group = req.query.group;
    console.log(group);

    try {
        //查詢圖中所有node
        console.time('db1');
        const allNodesResult = await allNodes(group);
        console.timeEnd('db1');
        allNodesResult.records.forEach((element) => {
            console.log(element.get('name'));
            let name = element.get('name');
            graph[name] = {};
            allNodeList.push(name);
        });

        //查每個source出去的edge數量
        for (let source of allNodeList) {
            console.time('db2');
            const sourceEdgeResult = await sourceEdge(source, group);
            console.timeEnd('db2');
            pathsStructure[source] = { sinksSummary: { sinks: [], qty: 0 }, sinks: {} };
            // pathsStructure[source].sinksSummary.qty = sourceEdgeResult.records.length; //紀錄qty
            sourceEdgeResult.records.forEach((element, index) => {
                pathsStructure[source].sinksSummary.sinks.push(
                    element.get('name') //紀錄所有一步可到的節點
                );
            });
            order.push({ source: source, qty: pathsStructure[source].sinksSummary.qty }); //同步放進order的列表中
        }
        order.sort((a, b) => {
            return b.qty - a.qty; //排序列表供後面決定順序用
        });
    } catch (err) {
        console.log(err);
    }

    ////開始將資料庫資料存進pathsStructure & graph
    //第一層：iterate sources
    for (let source of order) {
        let currentSource = source.source; //當前的source
        console.time('db3');
        const pathsResult = await allPaths(currentSource, group);
        console.timeEnd('db3');
        //第二層：iterate paths in source
        for (let i = 0; i < pathsResult.records.length; i++) {
            const sink = pathsResult.records[i]._fields[0].end.properties.name; //當前path的sink
            if (!pathsStructure[currentSource].sinksSummary.sinks.includes(sink)) {
                continue;
            }
            //第三層：iterate edges in path
            let edges = []; //組成path的碎片陣列
            pathsResult.records[i]._fields[0].segments.forEach((edge) => {
                // // console.log('edge from neo', edge);
                //更新欠款圖graph的debt
                graph[edge.start.properties.name][edge.end.properties.name] = edge.relationship.properties.total.low;
                //將碎片放進陣列中
                edges.push([edge.start.properties.name, edge.end.properties.name]);
                // // console.log('放碎片：', edges);
            });
            //更新路徑表pathsStructure
            if (!pathsStructure[currentSource].sinks[sink]) {
                pathsStructure[currentSource].sinks[sink] = [];
            }
            pathsStructure[currentSource].sinks[sink].push(edges);
            // // console.log('完整碎片組', edges);
        }
    }
    // // console.log('最終存好的graph: ', graph);

    //// 開始進行分帳優化
    console.time('split');
    // 第一層：iterate sources by order
    for (let source of order) {
        // console.log('目前souce: ', source.source);
        //第二層：iterate sinks in source
        // // console.log('所有sinks:', pathsStructure[source.source].sinks);
        Object.keys(pathsStructure[source.source].sinks).forEach((sink) => {
            // console.log('目前sink:', sink);
            let totalFlow = 0;
            //第三層：iterate paths of source->sink
            for (let path of pathsStructure[source.source].sinks[sink]) {
                // console.log('目前path', path);
                let bottleneckValue = 0;
                let pathBlock = false;
                if (path.length !== 1) {
                    //第四層：iterate edges in path
                    // console.log('扣除前：', graph);
                    let debts = [];
                    for (let edge of path) {
                        if (!graph[edge[0]][edge[1]]) {
                            pathBlock = true;
                            break; //當兩點容量已為0或不存在則break
                        }
                        debts.push(graph[edge[0]][edge[1]]); //查表找出debt
                    }
                    if (pathBlock) {
                        continue;
                    }
                    //找出瓶頸edge流量
                    // console.log('debts', debts);
                    bottleneckValue = Math.min.apply(Math, debts);
                    // console.log('扣除量:', bottleneckValue);
                    //將所有edge都減去瓶頸流量
                    path.forEach((edge) => {
                        graph[edge[0]][edge[1]] -= bottleneckValue;
                    });

                    // //找出瓶頸edge的索引號碼
                    bottleneckIndex = debts.indexOf(bottleneckValue);
                    // //將流量加到total
                    totalFlow += bottleneckValue;
                    // console.log('累積ttlflow:', totalFlow);
                    // console.log('扣除後：', graph);
                }
            }
            //將流量加到總和
            if (totalFlow) {
                // console.log('總ttlflow:', totalFlow);
                graph[source.source][sink] += totalFlow;
                // console.log('加流量：', graph);
            }
        });
    }
    console.timeEnd('split');
    console.log(graph);
    console.timeEnd('all');
    res.status(200).json(graph);
};

module.exports = { settleUp };
