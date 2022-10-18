const { neo4j } = require('./config/neo4j');

const updateBestPath = async (txc, gid, debtsForUpdate) => {
  console.log('@updateBestPath');
  try {
    const result = await txc.run(
      'MATCH (g:group{name:$gid}) WITH g UNWIND $debts AS debt MATCH (g)<-[:member_of]-(b:person) WHERE b.name = debt.borrower MATCH (l:person)-[:member_of]->(g) WHERE l.name = debt.lender WITH b,l, debt MERGE (b)-[r:own]-> (l) ON CREATE SET r.amount = $empty SET r.amount = r.amount + debt.amount',

      { gid, debts: debtsForUpdate, empty: neo4j.int(0) } //debtsForUpdate已做過neo4j.int處理
    );
    return result.summary.updateStatistics;
  } catch (err) {
    throw new Error(err);
  }
};
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
const allNodes = async (txc, gid) => {
  try {
    const result = await txc.run(
      'MATCH (n:person)-[:member_of]-> (:group{name:$gid}) RETURN n.name AS name',
      { gid }
    );
    return result;
  } catch (err) {
    throw new Error(err);
  }
};

//查每個source出去的edge數量
const sourceEdge = async (txc, gid, source) => {
  try {
    // const result = await session.run(`MATCH (n:person{name:$name})-[r]->(m:person) RETURN m,r`, {
    const result = await txc.run(
      'MATCH (:group{name:$gid})<-[:member_of]-(n:person{name:$lender})-[:own]->(m:person)-[:member_of]->(:group{name:$gid}) RETURN m.name AS name',
      {
        gid,
        lender: source,
      }
    );
    return result;
  } catch (err) {
    throw new Error(err);
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
    return result;
  } catch (err) {
    throw new Error(err);
  }
};

module.exports = { allNodes, sourceEdge, allPaths, updateBestPath, deletePath };
