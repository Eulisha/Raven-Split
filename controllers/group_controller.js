const { neo4j, driver } = require('../config/neo4j');
const Admin = require('../models/admin_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const Mapping = require('../config/mapping');

const createGroup = async (req, res) => {
    const group_name = req.body.group_name;
    const group_type = req.body.group_type;
    const groupUsers = req.body.groupUsers;
    console.info('req body', group_name, group_type, groupUsers);

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        //MySql建立group
        try {
            const groupResult = await Admin.createGroup(conn, group_name, group_type, groupUsers);
            if (!groupResult) {
                console.error(groupResult);
                throw new Error('Internal Server Error');
            }
            const gid = groupResult;
            const memberIds = groupUsers.map((user) => {
                return user.uid;
            });
            console.debug('to Neo:   ', gid, memberIds);

            //Neo4j建立節點
            let map = [];
            for (let memberId of memberIds) {
                // map.push({ name: neo4j.int(member.toSring()) }); //處理neo4j integer
                map.push({ name: neo4j.int(memberId) }); //處理neo4j integer
            }
            const graphResult = await Graph.createNodes(txc, neo4j.int(gid), map);
            if (!graphResult) {
                console.error(graphResult);
                throw new Error('Internal Server Error');
            }
            //全部成功了，commit
            conn.commit();
            await txc.commit();
            conn.release();
            session.close();
            return res.status(200).json({ data: { gid } });
        } catch (err) {
            console.error('ERROR: ', err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err });
        }
    });
};
const getGroupUsers = async (req, res) => {
    console.log('@control getGroupUsers');
    if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const members = await Admin.getGroupUsers(Number(req.params.id));
    if (!members) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    return res.status(200).json({ data: members });
};
const updateGroup = async (req, res) => {
    const gid = Number(req.params.id);
    const group_name = req.body.group_name;
    const group_type = req.body.group_type;
    const groupUsers = req.body.groupUsers;
    console.info('req body', group_name, group_type, groupUsers);

    try {
        if (req.userGroupRole.gid !== Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['administer']) {
            return res.status(403).json({ err: 'No authorization.' });
        }

        const result = await Admin.updateGroup(gid, group_name);
        if (!result) {
            return res.status(500).json({ err: 'Internal Server Error' });
        }

        let groupUserIds = [];
        for (let i = 0; i < req.body.groupUsers.length; i++) {
            const uid = groupUsers[i].uid;
            const role = groupUsers[i].role;
            console.log(uid, role);
            const insertId = await Admin.createMember(gid, uid, role);
            if (!insertId) {
                return res.status(500).json({ err: 'Internal Server Error' });
            }
            console.log(insertId);
            groupUserIds.push(insertId);
        }

        return res.status(200).json({ data: groupUserIds });
    } catch (err) {
        console.log(err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};
const deleteMember = async (req, res) => {
    if (req.userGroupRole.gid !== req.params.gid || req.userGroupRole.role < Mapping.USER_ROLE['administer']) {
        return res.status(403).json({ err: 'No authorization.' });
    }
    const groupId = req.params.gid;
    const userId = req.params.uid;
    const result = await Admin.deleteMember(groupId, userId);
    if (!result) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    return res.status(200).json({ data: null });
};

// 併到update裡面
// const createMember = async (req, res) => {
//     if (req.userGroupRole.gid !== req.params.gid || req.userGroupRole.role < Mapping.USER_ROLE['administer']) {
//         return res.status(403).json({ err: 'No authorization.' });
//     }
//     const groupId = req.params.gid;
//     const uid = req.body.uid;
//     const memberId = await Admin.createMember(groupId, uid, role);
//     if (!memberId) {
//         return res.status(500).json({ err: 'Internal Server Error' });
//     }
//     res.status(200).json({ data: { memberId } });
// };

module.exports = { createGroup, getGroupUsers, updateGroup, deleteMember };
