const neo4j = require('neo4j-driver');
const uri = 'neo4j://localhost:7687';
const user = 'neo4j';
const password = '5ps93';
const driver = neo4j.driver(uri, neo4j.auth.basic(user, password));
const session = driver.session();

const a = async () => {
  console.time('all');
  const graph = {};
  const allNodeList = [];
  const pathsStructure = {};
  const order = [];
  const group = 'c';
  try {
    //查詢圖中所有node

    console.time('db1');
    const allNodesResult = await session.run(
      `MATCH (n:person)-[:belong_to]-> (:group{name:$group}) RETURN n.name`,
      { group: group }
      // `MATCH (n) RETURN n.name`
    );
    console.timeEnd('db1');
    allNodesResult.records.forEach((element) => {
      graph[element._fields[0]] = {};
      allNodeList.push(element._fields[0]);
    });

    //查每個source出去的edge數量
    for (let node of allNodeList) {
      console.time('db2');
      const nodesResult = await session.run(
        // `MATCH (:person{name:$name})-[]->(n) RETURN n`,
        `MATCH (m:person{name:$name})-[:own]->(n) WHERE (m)-[:belong_to]-> (:group{name:$group}) RETURN n`,
        // `MATCH (:group{name:$group})<-[:belong_to]-(m:person{name:$name})-[:own]->(n) RETURN n`,
        {
          name: node,
          group: group,
        }
      );
      console.timeEnd('db2');
      pathsStructure[node] = { sinksSummary: { sinks: [], qty: 0 }, sinks: {} };
      pathsStructure[node].sinksSummary.qty = nodesResult.records.length; //紀錄qty
      nodesResult.records.forEach((element, index) => {
        pathsStructure[node].sinksSummary.sinks.push(
          element._fields[0].properties.name //紀錄所有一步可到的節點
        );
      });
      order.push({ node: node, qty: pathsStructure[node].sinksSummary.qty }); //同步放進order的列表中
    }
    order.sort((a, b) => {
      return b.qty - a.qty; //排序列表供後面決定順序用
    });
  } catch (err) {
    // console.log(err);
  }

  ////開始將資料庫資料存進pathsStructure & graph
  //第一層：iterate sources
  for (let source of order) {
    let currentSource = source.node; //當前的source
    console.time('db3');
    const pathsResult = await session.run(
      // `MATCH path = (:person {name: $name})-[*]->(leaf) RETURN path`,
      `MATCH path = (m:person {name: $name})-[:own*..10]->(leaf:person) WHERE (m)-[:belong_to]-> (:group{name:$group}) RETURN path`, //查詢資料庫取出該source的所有路徑
      // `MATCH path = (:group{name:$group})<-[:belong_to]-(m:person {name: $name})-[:own]->(leaf:person) RETURN path`, //查詢資料庫取出該source的所有路徑
      {
        name: currentSource,
        group: group,
      }
    );
    console.timeEnd('db3');
    //第二層：iterate paths in source
    for (let i = 0; i < pathsResult.records.length; i++) {
      const sink = pathsResult.records[i]._fields[0].end.properties.name; //當前path的sink
      // console.log(
      //   'currentSource: ',
      //   currentSource,
      //   'sinks: ',
      //   pathsStructure[currentSource].sinksSummary.sinks
      // );
      if (!pathsStructure[currentSource].sinksSummary.sinks.includes(sink)) {
        continue;
      }
      //第三層：iterate edges in path
      let edges = []; //組成path的碎片陣列
      pathsResult.records[i]._fields[0].segments.forEach((edge) => {
        // console.log('edge from neo', edge);
        //更新欠款圖graph的debt
        graph[edge.start.properties.name][edge.end.properties.name] =
          edge.relationship.properties.total.low;
        //將碎片放進陣列中
        edges.push([edge.start.properties.name, edge.end.properties.name]);
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

  //// 開始進行分帳優化
  console.time('split');
  // 第一層：iterate sources by order
  for (let source of order) {
    console.log('目前souce: ', source.node);
    //第二層：iterate sinks in source
    // console.log('所有sinks:', pathsStructure[source.node].sinks);
    Object.keys(pathsStructure[source.node].sinks).forEach((sink) => {
      console.log('目前sink:', sink);
      let totalFlow = 0;
      //第三層：iterate paths of source->sink
      for (let path of pathsStructure[source.node].sinks[sink]) {
        console.log('目前path', path);
        let bottleneckValue = 0;
        let pathBlock = false;
        if (path.length !== 1) {
          //第四層：iterate edges in path
          console.log('扣除前：', graph);
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
          console.log('debts', debts);
          bottleneckValue = Math.min.apply(Math, debts);
          console.log('扣除量:', bottleneckValue);
          //將所有edge都減去瓶頸流量
          path.forEach((edge) => {
            graph[edge[0]][edge[1]] -= bottleneckValue;
          });

          // //找出瓶頸edge的索引號碼
          bottleneckIndex = debts.indexOf(bottleneckValue);
          // //將流量加到total
          totalFlow += bottleneckValue;
          console.log('累積ttlflow:', totalFlow);
          console.log('扣除後：', graph);
        }
      }
      //將流量加到總和
      if (totalFlow) {
        console.log('總ttlflow:', totalFlow);
        graph[source.node][sink] += totalFlow;
        console.log('加流量：', graph);
      }
    });
  }
  console.timeEnd('split');
  console.log(graph);
  console.timeEnd('all');

  await session.close();
  // await driver.close();
};
a();

// const list = [
//   // A, B, C, D, E, F, G
//  A [0, 0, 0, 0, 0, 0, 0],
//  B [0, 0, 40, 0, 0, 0, 0],
//  C [0, 0, 0, 20, 0, 0, 0],
//  D [0, 0, 0, 0, 50, 0, 0],
//  E [0, 0, 0, 0, 0, 0, 0],
//  F [0, 10, 10, 10, 10, 0, 0],
//  G [0, 30, 0, 10, 0, 0, 0],
// ];
// for (let row = 0; row < list.length; row++) {
//   // // console.log('row:', row);
//   for (let rItem = 0; rItem < list[row].length; rItem++) {
//     // // // console.log('a');
//     if (list[row][rItem]) {
//       // // console.log(`${row} - ${rItem}`, list[row][rItem]);
//       // if ()
//     }
//   }
// }
