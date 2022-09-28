const { neo4j, driver } = require('../config/neo4j');

require('dotenv').config();

//建立節點
const createNodes = async (txc, gid, map) => {
    console.info('graph model: gid, members: ', gid, map);
    try {
        const result = await txc.run('MERGE (m:group{name:$gid}) WITH m UNWIND $members AS members CREATE (n:person)-[:member_of]->(m) SET n = members RETURN n', {
            gid,
            members: map,
        });
        console.debug('createNodes: ', result.summary.updateStatistics);
        return true;
    } catch (err) {
        console.error('ERROR AT createNodes: ', err);
        return null;
    }
};
//查欠債關係線
const getCurrEdge = async (txc, gid, lender, map) => {
    console.info('graph model: gid, lender, map: ', gid, lender, map);
    try {
        let map1 = map;
        // console.log('map:',map1);
        const result = await txc.run(
            'MATCH (lender:person{name:$lender})-[:member_of]->(g:group{name:$gid}) WITH lender, g UNWIND $borrowers AS b MATCH (borrower:person)-[:member_of]->(g:group{name:$gid}) WHERE borrower.name = b.name WITH lender, borrower MERGE (borrower)-[r:own]-(lender) ON CREATE SET r.amount = $empty RETURN startNode(r).name AS start, endNode(r).name AS end, r.amount AS amount',
            { gid, lender, borrowers: map1, empty: neo4j.int(0) }
        );
        console.debug('getedge: ', result.summary.updateStatistics);
        return result;
    } catch (err) {
        console.error('ERROR AT getCurrEdge: ', err);
        return null;
    }
};
//更新新的線
const updateEdge = async (txc, gid, newMap) => {
    console.info('graph model: gid, newMap: ', gid, newMap);
    try {
        let map = newMap;
        const result = await txc.run(
            'UNWIND $debts AS debt MATCH (g:group{name:$gid})<-[:member_of]-(b:person) WHERE b.name = debt.borrower MATCH (g:group{name:$gid})<-[:member_of]-(l:person) WHERE l.name = debt.lender WITH b, l, debt MERGE (b)-[r:own]->(l) SET r.amount = debt.amount return b, l, r',
            // 'MATCH (g:group{name:$gid}) WITH g UNWIND $debts AS debt MATCH (g)<-[:member_of]-(borrower:person)-[r:own]->(lender:person)-[:member_of]->(g) WHERE lender.name = debt.lender AND borrower.name = debt.borrower SET r.amount = debt.amount RETURN r',
            // 'UNWIND $debts AS debt MATCH (lender:person)-[:member_of]->(g:group{name:$gid}) WHERE lender.name = debt.lender with lender, g, debt MATCH (borrower:person)-[:member_of]->(g) WHERE borrower.name = debt.borrower WITH lender, borrower, debt MATCH (borrower)-[r:own]->(lender) SET r.amount = debt.amount RETURN r',
            // 'MATCH (lender:person{name:$lender})-[:member_of]->(g:group{name:$gid}) WITH lender,g UNWIND $borrowers AS b MATCH (m:person)-[:member_of]->(g) WHERE m.name = b.name MERGE (m)-[r:own]->(lender) SET r.amount = r.amount + b.amount'
            {
                gid, //已做過neo4j.int處理
                debts: map, //已做過neo4j.int處理
            }
        );
        // console.log('updateedge: ', result.records);
        console.debug('updateedge: ', result.summary.updateStatistics);
        return true;
    } catch (err) {
        console.error('ERROR AT updateGraphEdge: ', err);
        return null;
    }
};
//更新最佳解
const updateBestPath = async (txc, debtsForUpdate) => {
    console.info('graph model: debtsForUpdate: ', debtsForUpdate);
    try {
        const result = await txc.run(
            // 'UNWIND $debts AS debt MATCH (n:person)-[r:own]->(m:person) WHERE n.name = debt.borrower AND m.name = debt.lender SET r.amount = debt.amount', //改成直接算好set值
            //FIXME:這邊沒帶gid可能會錯？？
            'UNWIND $debts AS debt MATCH (n:person)-[r:own]->(m:person) WHERE n.name = debt.borrower AND m.name = debt.lender SET r.amount = r.amount + debt.amount',

            { debts: debtsForUpdate } //debtsForUpdate已做過neo4j.int處理
        );
        console.debug('updatebestpath: ', result.summary.updateStatistics);
        return true;
    } catch (err) {
        console.error('ERROR AT updateGraphBestPath: ', err);
        return false;
    }
};
//刪除單一線
const deletePath = async (txc, gid, borrower, lender) => {
    console.info('graph model: gid, borrower, lender:  ', gid, borrower, lender);
    try {
        const result = await txc.run(
            'MATCH (g:group{name:$gid}) WITH g MATCH (n:person)-[:member_of]->(g) WHERE n.name = $borrower MATCH (m:person)-[:member_of]->(g) WHERE m.name = $lender WITH n, m MATCH (n)-[r:own]->(m) DELETE r RETURN r',
            // 'MATCH (g:group{name:$gid}) WITH g MATCH (g)<-[:member_of]-(n:person)-[r:own]->(m:person)-[:member_of]->(g) WHERE n.name = $borrower AND m.name = lender DELETE r RETURN r',
            { gid, borrower, lender }
        );
        // console.log('deletePath: ', result.records);
        console.debug('deletePath: ', result.summary.updateStatistics);
        return true;
    } catch (err) {
        console.error('ERROR AT deletePath: ', err);
        return false;
    }
};
//刪除整個圖(最佳解)
const deleteBestPath = async (txc, gid) => {
    console.info('graph model: gid:', gid);
    try {
        const result = await txc.run('MATCH (g:group)<-[:member_of]-(n)-[r:own]-(m)-[:member_of]->(g:group) WHERE g.name = $group DELETE r ', { group: gid });
        console.debug('deleteBestPath: ', result.summary.updateStatistics);
        return true;
    } catch (err) {
        console.error('ERROR AT deleteBestPath: ', err);
        return null;
    }
};

//// BELOW ARE FOR BEST PATH USAGE
//取得圖
const getGraph = async (txc, gid) => {
    console.info('graph model: gid:', gid);
    try {
        const cypher =
            'MATCH (g:group{name:$name}) WITH g MATCH (g:group)<-[:member_of]-(n:person)-[r:own]->(m:person)-[:member_of]->(g:group)  RETURN n.name AS borrower, r.amount AS amount, m.name AS lender, g.name AS group';
        const data = { name: gid };

        const result = await txc.run(cypher, data);
        console.debug('getGraph: ', result.summary.updateStatistics);
        return result;
    } catch (err) {
        console.error('ERROR AT getGraph: ', err);
        return false;
    }
};
// TODO: [優化] 可以改成 MATCH (m:person) <- [:own] - (n:person) - [:member_of] -> (:group{name:31}) RETURN n, m 整併兩個query
//查詢圖中所有node
const allNodes = async (txc, gid) => {
    console.info('graph model: gid: ', gid);
    try {
        const result = await txc.run('MATCH (n:person)-[:member_of]-> (:group{name:$gid}) RETURN n.name AS name', { gid });
        console.debug('allNodes: ', result.summary.updateStatistics);
        return result;
    } catch (err) {
        console.error('ERROR AT allNodes: ', err);
        return false;
    }
};

//查每個source出去的edge數量
const sourceEdge = async (txc, gid, source) => {
    console.info('graph model: gid, source:', gid, source);
    try {
        // const result = await session.run(`MATCH (n:person{name:$name})-[r]->(m:person) RETURN m,r`, {
        const result = await txc.run(
            'MATCH (:group{name:$gid})<-[:member_of]-(n:person{name:$lender})-[:own]->(m:person)-[:member_of]->(:group{name:$gid}) RETURN m.name AS name',
            {
                gid,
                lender: source,
            }
        );
        console.debug('sourceEdge: ', result.summary.updateStatistics);
        return result;
    } catch (err) {
        console.error('ERROR AT sourceEdge: ', err);
        return false;
    }
};

//查所有路徑
const allPaths = async (txc, gid, currentSource, sinkNode) => {
    console.info('grapgh model: gid, currentSource, sinkNode(optional): ', gid, currentSource, sinkNode);
    try {
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
            //目前沒有用到這個條件
            result = await txc.run(
                `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person{name: $name}) WHERE (n)-[:member_of]-> (:group{name:$gid}) RETURN path`, //查詢資料庫取出該source的所有路徑
                {
                    name: currentSource,
                    gid,
                    name: sinkNode,
                }
            );
        }
        console.debug('allPaths: ', result.summary.updateStatistics);
        return result;
    } catch (err) {
        console.error('ERROR AT allPaths: ', err);
        return false;
    }
};

module.exports = { allNodes, sourceEdge, allPaths, createNodes, getCurrEdge, updateEdge, updateBestPath, deletePath, deleteBestPath, getGraph };
