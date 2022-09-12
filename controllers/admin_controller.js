const Admin = require('../models/admin_model');
const Graph = require('../models/graph_model');
const pool = require('../config/mysql');

const createGroup = async (req, res) => {
    const group_name = req.body.group_name;
    const members = req.body.members;
    console.log(req.body);

    //取得MySql連線
    const conn = await pool.getConnection();
    await conn.beginTransaction();

    //MySql建立group
    const groupResult = await Admin.createGroup(conn, group_name, members);
    if (!groupResult) {
        await conn.rollback();
        await conn.release();
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    const gid = groupResult;
    const memberIds = members.map((member) => {
        return member.uid;
    });
    console.log('to Neo:   ', gid, memberIds);
    //Neo4j建立節點
    const graphResult = await Graph.createNodes(gid, memberIds);
    if (!graphResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    conn.commit();
    res.status(200).json({ data: { gid } });
};
const createMember = async (req, res) => {
    const groupId = req.body.gid;
    const uid = req.body.uid;
    const memberId = await Admin.createMember(groupId, uid, role);
    if (!memberId) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: { memberId } });
};
const getUserGroups = async (req, res) => {
    let uid = req.params.id;
    const groups = await Admin.getUserGroups(uid);
    if (!groups) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: groups });
};
const getGroupUsers = async (req, res) => {
    let gid = req.params.id;
    const members = await Admin.getGroupUsers(gid);
    if (!members) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: members });
};
const updateGroup = async (req, res) => {
    console.log(req.body);
    let gid = req.body.gid;
    let group_name = req.body.group_name;
    result = await Admin.updateGroup(gid, group_name);
    if (!result) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: null });
};
const deleteMember = async (req, res) => {
    const groupId = req.params.gid;
    const userId = req.params.uid;
    const result = await Admin.deleteMember(groupId, userId);
    if (!result) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: null });
};
module.exports = { createGroup, createMember, getUserGroups, getGroupUsers, updateGroup, deleteMember };
