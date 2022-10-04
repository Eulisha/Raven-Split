const Graph = require('../models/graph_model');
const { neo4j, driver } = require('../config/neo4j');

const getpreparedDebt = (oldDebt, currDebt) => {
    console.info('model: oldDebt, currDebt: ', oldDebt, currDebt);
    let start = oldDebt.get('start').toNumber();
    let end = oldDebt.get('end').toNumber();
    let originalDebt = oldDebt.get('amount').toNumber();
    let newBalance;
    console.log(start, end, originalDebt);

    // if (start != currDebt.borrower && end != currDebt.borrower) {
    //     return null;
    // }
    if (start == currDebt.borrower) {
        // 原本債務關係和目前一樣 borrower-own->lender
        newBalance = originalDebt + currDebt.amount;
    } else if (end == currDebt.borrower) {
        // 原本債務關係和目前相反 borrower<-own-lender
        newBalance = originalDebt - currDebt.amount;
    } else {
        console.error('!!!!!!!!!錯了');
    }
    const preparedDebt = { start, end, newBalance };
    return preparedDebt;
};
const getpreparedDebtWithNew = (currDebt, lender) => {
    console.info('model: currDebt, lender:', currDebt, lender);
    newBalance = currDebt.amount; //FIXME:這個有可能是負的嗎??
    start = currDebt.borrower;
    end = lender;
    if (newBalance > 0) {
        console.debug('balance5: x+', 'borrower', neo4j.int(currDebt.borrower), 'lender', neo4j.int(lender));
        start = currDebt.borrower;
        end = lender;
    } else {
        console.debug('balance5: x-', 'borrower', neo4j.int(lender), 'lender', neo4j.int(currDebt.borrower));
        start = lender;
        end = currDebt.borrower;
    }
    const preparedDebt = { start, end, newBalance };
    return preparedDebt;
};
const getEdgeToUpdate = async (txc, gid, preparedDebt) => {
    console.info('model: gid, preparedDebt: ', gid, preparedDebt);
    const { start, end, newBalance } = preparedDebt;
    await Graph.deletePath(txc, neo4j.int(gid), neo4j.int(start), neo4j.int(end)); //等於0的時候把線刪除
    let borrower;
    let lender;
    if (newBalance === 0) {
        console.debug('balance: = 0');
        return;
    }

    if (newBalance > 0) {
        // 維持borrower <-own-lender
        console.debug('balance: > 0 ', 'borrower', start, 'lender', end, 'newBalance', newBalance);
        borrower = neo4j.int(start);
        lender = neo4j.int(end);
    } else if (newBalance < 0) {
        // 改為borrower-own->lender
        console.debug('balance: < 0 ', 'borrower', end, 'lender', start, 'newBalance', newBalance);
        borrower = neo4j.int(end);
        lender = neo4j.int(start);
    }
    return { borrower, lender, amount: neo4j.int(Math.abs(newBalance)) };
};

const updateGraphEdge = async (txc, gid, debtMain, debtDetail) => {
    console.debug('gid, debtDetail, debtMain', gid, debtDetail, debtMain);
    try {
        let map = [];
        let debtDetailExcluded = [];
        debtDetail.forEach((debt) => {
            console.debug(debt);
            if (debt.borrower != debtMain.lender && debt.amount != 0) {
                map.push({ name: neo4j.int(debt.borrower), amount: neo4j.int(debt.amount) }); //處理neo4j integer
                debtDetailExcluded.push({ borrower: debt.borrower, amount: debt.amount });
            }
        });
        console.debug('map, debtDetailExcluded: ', map, debtDetailExcluded);
        //上面會需要debtDetail和map兩個的原因是因為一個是要丟進去neo的需要先做數字處理，另一個是拿來比對的不要有數字處理

        //先查出原本的債務線
        const getEdgeResult = await Graph.getCurrEdge(txc, neo4j.int(gid), neo4j.int(debtMain.lender), map);
        let updateArray = [];

        // for (let oldDebt of getEdgeResult.records) {
        const oldDebts = getEdgeResult.records;
        for (let ind = 0; ind < oldDebts.length; ind++) {
            const oldDebt = oldDebts[ind];
            const currDebt = debtDetailExcluded[ind];
            console.log('oldDebt: ', oldDebt);
            console.log('current:', currDebt);
            let preparedDebt;

            //比對neo裡的與req進來的債務關係，計算newBalacne
            preparedDebt = getpreparedDebt(oldDebt, currDebt); // { start, end, balance }
            // //比對失敗找不到, 新增一筆
            // if (!preparedDebt.newBalance) {
            //     preparedDebt = getpreparedDebtWithNew(currDebt, debtMain.lender);
            // }
            console.log('preparedDebt: ', preparedDebt);

            let edgeToUpdate = await getEdgeToUpdate(txc, gid, preparedDebt);
            console.log('edgeToUpdate: ', edgeToUpdate);
            updateArray.push(edgeToUpdate);
        }
        //更新線
        console.log('for Neo updateArray:   ', updateArray);
        const updateGraphEdgeesult = await Graph.updateEdge(txc, neo4j.int(gid), updateArray);
        console.log('updateGraphEdgeesult: ', updateGraphEdgeesult);
        if (!updateGraphEdgeesult) {
            console.error(updateGraphEdgeesult);
            throw new Error('Internal Server Error');
        }
        return updateGraphEdgeesult;
    } catch (err) {
        console.log(err);
        return false;
    }
};
const getBestPath = async (txc, gid) => {
    try {
        const graph = {};
        const allNodeList = [];
        const pathsStructure = {};
        const order = [];
        // console.log('search group:', group);

        // 1) Neo4j get all path
        try {
            // 1-1) 查詢圖中所有node
            console.log('TO Neo allNode:  ', neo4j.int(gid));
            const allNodesResult = await Graph.allNodes(txc, neo4j.int(gid));
            allNodesResult.records.forEach((element) => {
                let name = element.get('name').toNumber();
                graph[name] = {};
                allNodeList.push(name);
            });
            // console.log('allNodeList: ', allNodeList);

            // 1-2) 查每個source出去的edge數量
            for (let source of allNodeList) {
                console.log('To Neo sourceEdge:  ', neo4j.int(gid), neo4j.int(source));
                const sourceEdgeResult = await Graph.sourceEdge(txc, neo4j.int(gid), neo4j.int(source));
                pathsStructure[source] = { sinksSummary: { sinks: [], qty: 0 }, sinks: {} };
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
            console.error('ERROR AT getBestPath Neo4j Search: ', err);
            return false;
        }
        // console.log('order:', order);

        //第一層：iterate sources
        for (let source of order) {
            // console.log('source: ', source.source);
            let currentSource = source.source; //當前的source
            // 1-3) 查所有的路徑
            console.log('To Neo allPath:  ', neo4j.int(gid), neo4j.int(currentSource));
            const pathsResult = await Graph.allPaths(txc, neo4j.int(gid), neo4j.int(currentSource));
            // console.log(pathsResult);
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
                    console.debug(
                        'From neo edge:  ',
                        'start:',
                        edge.start.properties.name.toNumber(),
                        'r: ',
                        edge.relationship.properties.amount.toNumber(),
                        'end:',
                        edge.end.properties.name.toNumber()
                    );
                    //更新欠款圖graph的debt
                    graph[edge.start.properties.name.toNumber()][edge.end.properties.name.toNumber()] = edge.relationship.properties.amount.toNumber(); //TODO:不確定為什麼這邊不需要.toNumber
                    // graph[edge.start.properties.name.toNumber()][edge.end.properties.name.toNumber()] = edge.relationship.properties.amount;
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
        // console.debug(pathsStructure);
        // console.debug('最終存好的graph: ', graph);

        // 3) calculate best path
        // 第一層：iterate sources by order
        const debtsForUpdate = []; //用來存所有被變動的路徑與值
        for (let source of order) {
            // console.log('目前souce: ', source.source);
            //第二層：iterate sinks in source
            // // console.log('所有sinks:', pathsStructure[source.source].sinks);
            for (let sink of Object.keys(pathsStructure[source.source].sinks)) {
                // console.log('目前sink:', sink);
                let totalFlow = 0; //用來存當圈要加到最短sounce-sink的流量
                //第三層：iterate paths of source->sink
                for (let path of pathsStructure[source.source].sinks[sink]) {
                    // console.debug('目前path', path);
                    let bottleneckValue = 0;
                    let pathBlock = false;
                    if (path.length != 1) {
                        //如果等於1代表示source直接到sink的path
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
                        for (let edge of path) {
                            graph[edge[0]][edge[1]] -= bottleneckValue;
                            // debtsForUpdate.push({ borrowerId: edge[0], lenderId: edge[1], adjust: -bottleneckValue });
                            let edgeToUpdate = await getEdgeToUpdate(txc, gid, edge[0], edge[1], graph[edge[0]][edge[1]]);
                            debtsForUpdate.push(edgeToUpdate);
                            // debtsForUpdate.push({ borrower: neo4j.int(edge[0]), lender: neo4j.int(edge[1]), amount: neo4j.int(-bottleneckValue) });
                        }
                        // 3-3) 將流量先暫加到totalFlow
                        totalFlow += bottleneckValue;
                        // console.log('累積ttlflow:', totalFlow);
                        // console.log('扣除後：', graph);
                    }
                }
                // 3-4) 將totalFlow加到最短的邊上
                // console.debug('totalFlow', totalFlow);
                if (totalFlow) {
                    // console.log('總ttlflow:', totalFlow);
                    graph[source.source][sink] += totalFlow;
                    // console.log('TO Neo debtsfor update:  ', 'borrower', neo4j.int(source.source), 'lender', neo4j.int(sink), 'amount', neo4j.int(graph[source.source][sink]));
                    // debtsForUpdate.push({ borrowerId: neo4j.int(source.source), lenderId: neo4j.int(sink), amount: neo4j.int(graph[source.source][sink]) });
                    // console.log('TO Neo debtsfor update:  ', 'borrower', neo4j.int(source.source), 'lender', neo4j.int(sink), 'amount', neo4j.int(totalFlow));
                    let edgeToUpdate = await getEdgeToUpdate(txc, gid, source.source, sink, totalFlow);
                    debtsForUpdate.push(edgeToUpdate);
                    // debtsForUpdate.push({ borrower: neo4j.int(source.source), lender: neo4j.int(sink), amount: neo4j.int(totalFlow) });
                    // console.log('加流量：', graph);
                }
            }
        }
        console.info('handler: best path graph debtsForUpdate:', graph, debtsForUpdate);
        return [graph, debtsForUpdate];
    } catch (err) {
        console.error('ERROR AT getBestPath: ', err);
        return false;
    }
};

module.exports = { updateGraphEdge, getBestPath };
