const express = require('express');
const { createGroup, createMember, getGroupUsers, updateGroup, deleteMember } = require('../controllers/group_controller');
const { authentication, authorization } = require('../util/auth');
const groupRoute = express.Router();
// groupRoute.use(authentication, authorization);

groupRoute.get('/users/:id', authentication, authorization, getGroupUsers);
groupRoute.post('/', authentication, createGroup);
groupRoute.post('/user', authentication, authorization, createMember);
groupRoute.put('/', authentication, authorization, updateGroup);
groupRoute.delete('/user/:gid/:uid', authentication, authorization, deleteMember);

module.exports = groupRoute;
