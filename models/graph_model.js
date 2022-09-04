require('dotenv').config();
const neo4j = require('neo4j-driver');
const host = process.env.NEO4J_HOST;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASS;
const driver = neo4j.driver(host, neo4j.auth.basic(user, password));

const updateGraph = async () => {};

//查詢圖中所有node
const allNodes = async (group) => {
    const session = driver.session();
    const result = await session.run(`MATCH (n:person)-[:belong_to]-> (:group{name:$group}) RETURN n.name AS name`, { group: group });
    await session.close();
    return result;
};

//查每個source出去的edge數量
const sourceEdge = async (source, group) => {
    const session = driver.session();
    const result = await session.run(`MATCH (:group{name:$group})<-[:belong_to]-(n:person{name:$name})-[:own]->(m:person) RETURN m.name AS name`, {
        name: source,
        group: group,
    });
    await session.close();
    return result;
};

const allPaths = async (currentSource, group, sinkNode) => {
    const session = driver.session();
    let result;
    if (!sinkNode) {
        result = await session.run(
            `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person) WHERE (n)-[:belong_to]-> (:group{name:$group}) RETURN path`, //查詢資料庫取出該source的所有路徑
            {
                name: currentSource,
                group: group,
            }
        );
    } else {
        result = await session.run(
            `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person{name: $name}) WHERE (n)-[:belong_to]-> (:group{name:$group}) RETURN path`, //查詢資料庫取出該source的所有路徑
            {
                name: currentSource,
                group: group,
                name: sinkNode,
            }
        );
    }
    await session.close();
    return result;
};

//建立節點
const createNode = async (map, gid) => {
    const session = driver.session();
    //TODO:處理數字轉換問題，現在neo會是3.0
    const result = await session.writeTransaction(async (txc) => {
        const result = await txc.run('MERGE (m:group{name:$gid}) WITH m UNWIND $props AS map CREATE (n)-[:member_of]->(m) SET n = map RETURN n', { gid: gid, props: map });
        // console.log(result.summary.updateStatistics);
        return result;
    });
};
module.exports = { allNodes, sourceEdge, allPaths, createNode };