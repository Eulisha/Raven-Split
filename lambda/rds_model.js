const ifProcessingBestGraph = async (conn, gid) => {
  try {
    const sql = 'SELECT hasNewData FROM `groups` WHERE id = ?';
    const data = [gid];
    const [result] = await conn.execute(sql, data);
    return result;
  } catch (err) {
    throw new Error(err);
  }
};

const setProcessingBestGraph = async (conn, gid, bestGraphStatus) => {
  try {
    const sql = 'UPDATE `groups` SET hasNewData = ? WHERE id = ?';
    const data = [bestGraphStatus, gid];
    await conn.execute(sql, data);
    return;
  } catch (err) {
    new Error(err);
  }
};

const setFinishedBestGraph = async (conn, gid, bestGraphStatus) => {
  try {
    const sql = 'UPDATE `groups` SET hasNewData = ? WHERE id = ?';
    const data = [bestGraphStatus, gid];
    await conn.execute(sql, data);
    return;
  } catch (err) {
    new Error(err);
  }
};

module.exports = {
  ifProcessingBestGraph,
  setProcessingBestGraph,
  setFinishedBestGraph,
};
