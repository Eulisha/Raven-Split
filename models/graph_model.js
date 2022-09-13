const { neo4j, driver } = require('../config/neo4j');

require('dotenv').config();

//建立節點
const createNodes = async (gid, members, conn) => {
    const session = driver.session();
    try {
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

//查欠債關係線
const getCurrEdge = async (session, gid, lender, map) => {
    console.log('@ model getCurrEdge @');
    try {
        return await session.writeTransaction(async (txc) => {
            let map1 = map;
            console.log('i am map ', map1, gid);
            // console.log('map:',map1);
            const result = await txc.run(
                'MATCH (lender:person{name:$lender})-[:member_of]->(g:group{name:$gid}) WITH lender, g UNWIND $borrowers AS b MATCH (borrower:person)-[:member_of]->(g:group{name:$gid}) WHERE borrower.name = b.name WITH lender, borrower MERGE (borrower)-[r:own]-(lender) ON CREATE SET r.amount = $empty RETURN startNode(r).name AS start, endNode(r).name AS end, r.amount AS amount',
                { gid, lender, borrowers: map1, empty: neo4j.int(0) }
            );
            console.log('getedge: ', result.summary.updateStatistics);
            return result;
        });
    } catch (err) {
        console.log('ERROR AT getCurrEdge: ', err);
        return null;
    }
};

//更新新的線
const updateEdge = async (session, gid, newMap) => {
    console.log('@ model updateEdge @');
    try {
        return await session.writeTransaction(async (txc) => {
            let map = newMap;
            console.log('i am map ', map, gid);
            const result = await txc.run(
                'UNWIND $debts AS debt MATCH (g:group{name:$gid})<-[:member_of]-(b:person) WHERE b.name = debt.borrower MATCH (g:group{name:$gid})<-[:member_of]-(l:person) WHERE l.name = debt.lender WITH b, l MERGE (b)-[r:own]->(l) SET r.amount = debt.amount return b, l, r',
                // 'MATCH (g:group{name:$gid}) WITH g UNWIND $debts AS debt MATCH (g)<-[:member_of]-(borrower:person)-[r:own]->(lender:person)-[:member_of]->(g) WHERE lender.name = debt.lender AND borrower.name = debt.borrower SET r.amount = debt.amount RETURN r',
                // 'UNWIND $debts AS debt MATCH (lender:person)-[:member_of]->(g:group{name:$gid}) WHERE lender.name = debt.lender with lender, g, debt MATCH (borrower:person)-[:member_of]->(g) WHERE borrower.name = debt.borrower WITH lender, borrower, debt MATCH (borrower)-[r:own]->(lender) SET r.amount = debt.amount RETURN r',
                // 'MATCH (lender:person{name:$lender})-[:member_of]->(g:group{name:$gid}) WITH lender,g UNWIND $borrowers AS b MATCH (m:person)-[:member_of]->(g) WHERE m.name = b.name MERGE (m)-[r:own]->(lender) SET r.amount = r.amount + b.amount'
                {
                    gid, //已做過neo4j.int處理
                    debts: map, //已做過neo4j.int處理
                }
            );
            console.log('updateedge: ', result.records);
            console.log('updateedge: ', result.summary.updateStatistics);
            return true;
        });
    } catch (err) {
        console.log('ERROR AT updateGraphEdge: ', err);
        return null;
    }
};

//刪除路徑
const deletePath = async (gid, borrower, lender) => {
    try {
        const session = driver.session();
        return await session.writeTransaction(async (txc) => {
            const result = await txc.run(
                'MATCH (g:group{name:$gid}) WITH g MATCH (n:person)-[:member_of]->(g) WHERE n.name = borrower MATCH (m:person)-[:member_of]->(g) WHERE m.name = lender WITH n, m MATCH (n)-[r:own]->(m) DELETE r RETURN r',
                // 'MATCH (g:group{name:$gid}) WITH g MATCH (g)<-[:member_of]-(n:person)-[r:own]->(m:person)-[:member_of]->(g) WHERE n.name = $borrower AND m.name = lender DELETE r RETURN r',
                { gid, borrower, lender }
            );
            console.log('deletePath: ', result.records);
            console.log('deletePath: ', result.summary.updateStatistics);
        });
    } catch (err) {
        console.log('ERROR AT deletePath: ', err);
        return false;
    }
};

//更新最佳解
const updateBestPath = async (debtsForUpdate) => {
    try {
        const session = driver.session();
        console.log('i am map ', debtsForUpdate);
        return await session.writeTransaction(async (txc) => {
            const result = await txc.run(
                'UNWIND $debts AS debt MATCH (n:person)-[r:own]->(m:person) WHERE n.name = debt.borrower AND m.name = debt.lender SET r.amount = debt.amount', //改成直接算好set值
                // 'UNWIND $debts AS debt MATCH (n:person)-[r:own]->(m:person) WHERE n.name = debt.borrower AND m.name = debt.lender SET r.amount = r.amount + debt.amount',
                { debts: debtsForUpdate } //debtsForUpdate已做過neo4j.int處理
            );
            console.log('updatebestpath: ', result.summary.updateStatistics);
            console.log('updatebestpath: ', result.records);
            // await session.close();
            return true;
        });
    } catch (err) {
        console.log('ERROR AT updateGraphBestPath: ', err);
        return false;
    }
};

//刪除最佳解
const deleteBestPath = async (session, groupId) => {
    const result = await session.run('MATCH (g:group)<-[:member_of]-(n)-[r:own]-(m)-[:member_of]->(g:group) WHERE g.name = $group DELETE r ', { group: neo4j.int(groupId) });
    console.log(result.summary.updateStatistics);
    return true;
};

//TODO:重建最佳解
const createBestPath = async () => {
    '';
};

//取得圖
const getGraph = async (gid) => {
    const session = driver.session();
    try {
        console.log(gid);
        const cypher =
            'MATCH (g:group{name:$name}) WITH g MATCH (g:group)<-[:member_of]-(n:person)-[r:own]->(m:person)-[:member_of]->(g:group)  RETURN n.name AS borrower, r.amount AS amount, m.name AS lender, g.name AS group';
        const data = { name: neo4j.int(gid) };
        return await session.readTransaction(async (txc) => {
            const result = await txc.run(cypher, data);
            return result;
        });
    } catch (err) {
        console.log('ERROR AT getGraph: ', err);
        return null;
    } finally {
        session.close();
    }
};
// TODO: [優化] 可以改成 MATCH (m:person) <- [:own] - (n:person) - [:member_of] -> (:group{name:31}) RETURN n, m 整併兩個query
//查詢圖中所有node
const allNodes = async (session, gid) => {
    try {
        return await session.writeTransaction(async (txc) => {
            const result = await txc.run('MATCH (n:person)-[:member_of]-> (:group{name:$gid}) RETURN n.name AS name', { gid });
            // await session.close();
            return result;
        });
    } catch (err) {
        console.log('ERROR AT allNodes: ', err);
        return false;
    }
};

//查每個source出去的edge數量
const sourceEdge = async (session, gid, source) => {
    try {
        return await session.writeTransaction(async (txc) => {
            // const result = await session.run(`MATCH (n:person{name:$name})-[r]->(m:person) RETURN m,r`, {
            const result = await txc.run(
                'MATCH (:group{name:$gid})<-[:member_of]-(n:person{name:$lender})-[:own]->(m:person)-[:member_of]->(:group{name:$gid}) RETURN m.name AS name',
                {
                    gid,
                    lender: source,
                }
            );
            return result;
        });
        // console.log(result.records[0]);
        // await session.close();
    } catch (err) {
        console.log('ERROR AT sourceEdge: ', err);
        return false;
    }
};

//查所有路徑
const allPaths = async (session, gid, currentSource, sinkNode) => {
    try {
        // const session = driver.session();
        return await session.writeTransaction(async (txc) => {
            let result;
            if (!sinkNode) {
                result = await txc.run(
                    `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person) WHERE (n)-[:member_of]-> (:group{name:$gid}) RETURN path`, //查詢資料庫取出該source的所有路徑
                    {
                        name: currentSource,
                        gid,
                    }
                );
            } else {
                result = await txc.run(
                    `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person{name: $name}) WHERE (n)-[:member_of]-> (:group{name:$gid}) RETURN path`, //查詢資料庫取出該source的所有路徑
                    {
                        name: currentSource,
                        gid,
                        name: sinkNode,
                    }
                );
            }
            // await session.close();
            return result;
        });
    } catch (err) {
        console.log('ERROR AT allPaths: ', err);
        return false;
    }
};

module.exports = { allNodes, sourceEdge, allPaths, createNodes, getCurrEdge, updateEdge, updateBestPath, deleteBestPath, deletePath, getGraph };
