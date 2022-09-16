const express = require('express');
const { createGroup, createMember, getGroupUsers, updateGroup, deleteMember } = require('../controllers/group_controller');
const { authentication, authorization } = require('../util/auth');
const groupRoute = express.Router();
// groupRoute.use(authentication, authorization);

groupRoute.get('/group-users/:id', authentication, authorization, getGroupUsers);
groupRoute.post('/group', authentication, authorization, createGroup);
groupRoute.post('/group-user', authentication, authorization, createMember);
groupRoute.put('/group', authentication, authorization, updateGroup);
groupRoute.delete('/group-user/:gid/:uid', authentication, authorization, deleteMember);

module.exports = groupRoute;
