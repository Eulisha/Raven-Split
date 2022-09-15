const express = require('express');
const { createGroup, createMember, getGroupUsers, updateGroup, deleteMember } = require('../controllers/group_controller');
const { authentication, authorization } = require('../util/auth');
const groupRoute = express.Router();
// groupRoute.use(authentication, authorization);

groupRoute.get('/group-users/:id', authentication, authorization, getGroupUsers);
groupRoute.post('/group', createGroup);
groupRoute.post('/group-user', createMember);
groupRoute.put('/group', updateGroup);
groupRoute.delete('/group-user/:gid/:uid', deleteMember);

module.exports = groupRoute;
