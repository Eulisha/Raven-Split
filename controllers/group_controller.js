const { neo4j, driver } = require('../config/neo4j');
const Admin = require('../models/admin_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');
const Mapping = require('../config/mapping');

const createGroup = async (req, res) => {
    const group_name = req.body.group_name;
    const group_type = req.body.group_type;
    const groupUsers = req.body.groupUsers;
    const uid = req.user.id;

    if (groupUsers.length < 2) {
        console.error('@createGroup: 400: ', groupUsers.length);
        return res.status(400).json({ err: 'A Group should have at least two members.' });
    }

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        //MySql建立group
        try {
            const members = groupUsers.map((user) => {
                return user.uid === uid ? { uid: user.uid, role: Mapping.USER_ROLE.owner } : { uid: user.uid, role: Mapping.USER_ROLE.administer };
            });
            const groupResult = await Admin.createGroup(conn, group_name, group_type, members);
            if (!groupResult) {
                console.error('@createGroup: db createGroup fail:', groupResult);
                throw new Error('Internal Server Error');
            }
            const gid = groupResult;
            const memberIds = groupUsers.map((user) => {
                return user.uid;
            });

            //Neo4j建立節點
            let map = [];
            for (let memberId of memberIds) {
                map.push({ name: neo4j.int(memberId) }); //處理neo4j integer
            }
            const graphResult = await Graph.createNodes(txc, neo4j.int(gid), map);
            if (!graphResult) {
                console.error('@createGroup: neo4j createNodes fail:', graphResult);
                throw new Error('Internal Server Error');
            }

            conn.commit();
            await txc.commit();
            conn.release();
            session.close();
            return res.status(200).json({ data: { gid } });
        } catch (err) {
            console.error('@createGroup: err: ', err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err: 'Internal Server Error' });
        }
    });
};
const getGroupUsers = async (req, res) => {
    const gid = Number(req.params.id);
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['viewer']) {
        console.error('@getGroupUsers: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const members = await Admin.getGroupUsers(gid);
    if (!members) {
        console.error('getGroupUsers fail: ', members);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    return res.status(200).json({ data: members });
};
const updateGroup = async (req, res) => {
    if (req.userGroupRole.gid != Number(req.params.id) || req.userGroupRole.role < Mapping.USER_ROLE['editor']) {
        console.error('@updateGroup: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const gid = Number(req.params.id);
    const group_name = req.body.group_name;
    const groupUsers = req.body.groupUsers;

    //取得MySql&Neo連線並開始transaction
    const conn = await pool.getConnection();
    await conn.beginTransaction();
    const session = driver.session();
    await session.writeTransaction(async (txc) => {
        try {
            const result = await Admin.updateGroup(gid, group_name);
            if (!result) {
                console.error('@updateGroup: db updateGroup fail: ', result);
                return res.status(500).json({ err: 'Internal Server Error' });
            }

            let groupUserIds = [];
            let map = [];
            for (let i = 0; i < req.body.groupUsers.length; i++) {
                const uid = groupUsers[i].uid;
                const role = Mapping.USER_ROLE.administer;
                const insertId = await Admin.createMember(conn, gid, uid, role);
                if (!insertId) {
                    console.error('@updateGroup: db createMember fail: ', insertId);
                    throw new Error('Internal Server Error');
                }
                groupUserIds.push(insertId);
                map.push({ name: neo4j.int(uid) }); //處理neo4j integer
            }
            const graphResult = Graph.createNodes(txc, gid, map);
            if (!graphResult) {
                console.error('@updateGroup: neo4j createNodes fail: ', debtsForUpdate);
                throw new Error('Internal Server Error');
            }

            await conn.commit();
            await txc.commit();
            conn.release();
            session.close();
            return res.status(200).json({ data: groupUserIds });
        } catch (err) {
            console.error('@updateGroup: err: ', err);
            await conn.rollback();
            await txc.rollback();
            conn.release();
            session.close();
            return res.status(500).json({ err: 'Internal Server Error' });
        }
    });
};
const deleteMember = async (req, res) => {
    if (req.userGroupRole.gid != req.params.gid || req.userGroupRole.role < Mapping.USER_ROLE['administer']) {
        console.error('@deleteMember: 403: ', req.userGroupRole.gid, req.params.id, req.id);
        return res.status(403).json({ err: 'No authorization.' });
    }
    const groupId = req.params.gid;
    const userId = req.params.uid;

    try {
        const result = await Admin.deleteMember(groupId, userId);
        if (!result) {
            return res.status(500).json({ err: 'Internal Server Error' });
        }
        return res.status(200).json({ data: null });
    } catch (err) {
        console.error('@deleteMember: err: ', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
};

module.exports = { createGroup, getGroupUsers, updateGroup, deleteMember };
