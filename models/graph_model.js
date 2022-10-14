const { neo4j, driver } = require('../config/neo4j');

require('dotenv').config();

//建立節點
const createNodes = async (txc, gid, map) => {
    try {
        const result = await txc.run('MERGE (m:group{name:$gid}) WITH m UNWIND $members AS members CREATE (n:person)-[:member_of]->(m) SET n = members RETURN n', {
            gid,
            members: map,
        });
        return true;
    } catch (err) {
        return null;
    }
};
//查欠債關係線
const getCurrEdge = async (txc, gid, lender, map) => {
    try {
        const result = await txc.run(
            'MATCH (lender:person{name:$lender})-[:member_of]->(g:group{name:$gid}) WITH lender, g UNWIND $borrowers AS b MATCH (borrower:person)-[:member_of]->(g:group{name:$gid}) WHERE borrower.name = b.name WITH lender, borrower MERGE (borrower)-[r:own]-(lender) ON CREATE SET r.amount = $empty RETURN startNode(r).name AS start, endNode(r).name AS end, r.amount AS amount',
            { gid, lender, borrowers: map, empty: neo4j.int(0) }
        );
        return result;
    } catch (err) {
        return null;
    }
};
//更新新的線
const updateEdge = async (txc, gid, newMap) => {
    try {
        let map = newMap;
        const result = await txc.run(
            'UNWIND $debts AS debt MATCH (g:group{name:$gid})<-[:member_of]-(b:person) WHERE b.name = debt.borrower MATCH (g:group{name:$gid})<-[:member_of]-(l:person) WHERE l.name = debt.lender WITH b, l, debt MERGE (b)-[r:own]->(l) SET r.amount = debt.amount return b, l, r',
            {
                gid,
                debts: map,
            }
        );
        return true;
    } catch (err) {
        return null;
    }
};
//更新最佳解
const updateBestPath = async (txc, gid, debtsForUpdate) => {
    try {
        const result = await txc.run(
            'MATCH (g:group{name:$gid}) WITH g UNWIND $debts AS debt MATCH (g)<-[:member_of]-(b:person) WHERE b.name = debt.borrower MATCH (l:person)-[:member_of]->(g) WHERE l.name = debt.lender WITH b,l, debt MERGE (b)-[r:own]-> (l) ON CREATE SET r.amount = $empty SET r.amount = r.amount + debt.amount',
            { gid, debts: debtsForUpdate, empty: neo4j.int(0) }
        );
        return true;
    } catch (err) {
        return false;
    }
};
//刪除單一線
const deletePath = async (txc, gid, borrower, lender) => {
    try {
        const result = await txc.run(
            'MATCH (g:group{name:$gid}) WITH g MATCH (n:person)-[:member_of]->(g) WHERE n.name = $borrower MATCH (m:person)-[:member_of]->(g) WHERE m.name = $lender WITH n, m MATCH (n)-[r:own]->(m) DELETE r RETURN r',
            { gid, borrower, lender }
        );
        return true;
    } catch (err) {
        return false;
    }
};
//刪除整個圖(最佳解)
const deleteBestPath = async (txc, gid) => {
    try {
        const result = await txc.run('MATCH (g:group)<-[:member_of]-(n)-[r:own]-(m)-[:member_of]->(g:group) WHERE g.name = $group DELETE r ', { group: gid });
        return true;
    } catch (err) {
        return null;
    }
};

//// BELOW ARE FOR BEST PATH USAGE
//取得圖
const getGraph = async (txc, gid) => {
    try {
        const cypher =
            'MATCH (g:group{name:$name}) WITH g MATCH (g:group)<-[:member_of]-(n:person)-[r:own]->(m:person)-[:member_of]->(g:group)  RETURN n.name AS borrower, r.amount AS amount, m.name AS lender, g.name AS group';
        const data = { name: gid };

        const result = await txc.run(cypher, data);
        return result;
    } catch (err) {
        return false;
    }
};

//查詢圖中所有node
const allNodes = async (txc, gid) => {
    try {
        const result = await txc.run('MATCH (n:person)-[:member_of]-> (:group{name:$gid}) RETURN n.name AS name', { gid });
        return result;
    } catch (err) {
        return false;
    }
};

//查每個source出去的edge數量
const sourceEdge = async (txc, gid, source) => {
    try {
        const result = await txc.run(
            'MATCH (:group{name:$gid})<-[:member_of]-(n:person{name:$lender})-[:own]->(m:person)-[:member_of]->(:group{name:$gid}) RETURN m.name AS name',
            {
                gid,
                lender: source,
            }
        );
        return result;
    } catch (err) {
        return false;
    }
};

//查所有路徑
const allPaths = async (txc, gid, currentSource, sinkNode) => {
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
            //目前暫時沒有用到這個條件
            result = await txc.run(
                `MATCH path = (n:person {name: $name})-[:own*..10]->(m:person{name: $name}) WHERE (n)-[:member_of]-> (:group{name:$gid}) RETURN path`, //查詢資料庫取出該source的所有路徑
                {
                    name: currentSource,
                    gid,
                    name: sinkNode,
                }
            );
        }
        return result;
    } catch (err) {
        return false;
    }
};

module.exports = { allNodes, sourceEdge, allPaths, createNodes, getCurrEdge, updateEdge, updateBestPath, deletePath, deleteBestPath, getGraph };
