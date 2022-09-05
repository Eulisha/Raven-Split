require('dotenv').config();
const neo4j = require('neo4j-driver');
const host = process.env.NEO4J_HOST;
const user = process.env.NEO4J_USER;
const password = process.env.NEO4J_PASS;
const driver = neo4j.driver(host, neo4j.auth.basic(user, password));

//建立節點
const createGraphNodes = async (gid, members, conn) => {
    try {
        const session = driver.session();
        let map = [];

        for (let member of members) {
            // map.push({ name: neo4j.int(member.toSring()) }); //處理neo4j integer
            map.push({ name: neo4j.int(member) }); //處理neo4j integer
        }
        return await session.writeTransaction(async (txc) => {
            const result = await txc.run('MERGE (m:group{name:$gid}) WITH m UNWIND $members AS members CREATE (n:person)-[:member_of]->(m) SET n = members RETURN n', {
                gid: neo4j.int(gid),
                // gid: neo4j.int(toString(gid)),
                members: map,
            });
            return true;
        });
    } catch (err) {
        console.log('ERROR AT createGraphNodes: ', err);
        return null;
    }
};

//更新新的線
const updateGraphEdge = async (gid, lender, borrowers) => {
    try {
        const session = driver.session();
        let map = [];
        for (let borrower of borrowers) {
            map.push({ name: neo4j.int(borrower.borrower), amount: neo4j.int(borrower.amount) }); //處理neo4j integer
        }

        return await session.writeTransaction(async (txc) => {
            const result = await txc.run(
                'MATCH (lender:person{name:$lender})-[:member_of]->(g:group{name:$gid}) WITH lender,g UNWIND $borrowers AS b MATCH (m:person)-[:member_of]->(g) WHERE m.name = b.name CREATE (m)-[r:own]->(lender) SET r.amount = b.amount',
                {
                    gid: neo4j.int(gid),
                    lender: neo4j.int(lender),
                    borrowers: map,
                }
            );
            console.log('結果：', result.summary.updateStatistics);
            return true;
        });
    } catch (err) {
        console.log('ERROR AT updateGraphEdge: ', err);
        return null;
    }
};

//更新最佳解
const updateGraphSettle = async (gid) => {};

// MATCH (m:person) <- [:own] - (n:person) - [:member_of] -> (:group{name:31}) RETURN n, m 整併兩個query
//查詢圖中所有node
const allNodes = async (group) => {
    const session = driver.session();
    return await session.writeTransaction(async (txc) => {
        const result = await txc.run(`MATCH (n:person)-[:member_of]-> (:group{name:$group}) RETURN n.name AS name`, { group: neo4j.int(group) });
        // await session.close();
        return result;
    });
};

//查每個source出去的edge數量
const sourceEdge = async (source, group) => {
    console.log(source, group);
    const session = driver.session();
    // const result = await session.run(`MATCH (:group{name:$group})<-[:member_of]-(n:person{name:$name})-[:own]->(m:person) RETURN m.name AS name`, {
    const result = await session.run(`MATCH (n:person{name:$name})-[r]->(m:person) RETURN m,r`, {
        group: neo4j.int(group),
        name: neo4j.int(source),
    });
    console.log(result.records[0]);
    await session.close();
    return result;
};

//查所有路徑
const allPaths = async (currentSource, group, sinkNode) => {
    const session = driver.session();
    let result;
    if (!sinkNode) {
        result = await session.run(
            `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person) WHERE (n)-[:member_of]-> (:group{name:$group}) RETURN path`, //查詢資料庫取出該source的所有路徑
            {
                name: neo4j.int(currentSource),
                group: neo4j.int(group),
            }
        );
    } else {
        result = await session.run(
            `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person{name: $name}) WHERE (n)-[:member_of]-> (:group{name:$group}) RETURN path`, //查詢資料庫取出該source的所有路徑
            {
                name: neo4j.int(currentSource),
                group: neo4j.int(group),
                name: neo4j.int(sinkNode),
            }
        );
    }
    await session.close();
    return result;
};
module.exports = { allNodes, sourceEdge, allPaths, createGraphNodes, updateGraphEdge, updateGraphSettle };
