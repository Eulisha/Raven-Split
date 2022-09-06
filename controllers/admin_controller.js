const Admin = require('../models/admin_model');
const Graph = require('../models/graph_model');

const createGroup = async (req, res, next) => {
    const group_name = req.body.group_name;
    const members = req.body.members;
    console.log(req.body);

    //MySql建立group
    const [groupResult, conn] = await Admin.createGroup(group_name, members);
    if (!groupResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    const groupId = groupResult;

    //MySql建立member balance
    //整理members的排列組合
    // let memberCombo = [];
    // for (let i = 0; i < members.length; i++) {
    //     for (let j = 0; j < members.length - 1; j++) {
    //         let x = i + j + 1;
    //         if (x > members.length - 1) {
    //             break;
    //         }
    //         memberCombo.push([members[i], members[x]]);
    //     }
    // }
    // console.log(memberCombo);
    // const balanceResult = await Admin.createDebtBalance(groupId, memberCombo, conn);
    // if (!balanceResult) {
    //     return res.status(500).json({ err: 'Internal Server Error' });
    // }

    //Neo4j建立節點
    const graphResult = await Graph.createGraphNodes(groupId, members, conn);
    if (!graphResult) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: groupId });
};
module.exports = { createGroup };
