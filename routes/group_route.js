const express = require('express');
const { createGroup, createMember, getGroupUsers, updateGroup, deleteMember } = require('../controllers/group_controller');
const { authentication, authorization } = require('../util/auth');
const { validate, groupFormSubmitRule } = require('../util/validate');
const groupRoute = express.Router();

groupRoute.get('/users/:id', authentication, authorization, getGroupUsers);
groupRoute.post('/group', groupFormSubmitRule, validate, authentication, createGroup);
// groupRoute.post('/user', authentication, authorization, createMember); //併到update裡面
groupRoute.put('/group/:id', groupFormSubmitRule, validate, authentication, authorization, updateGroup);
groupRoute.delete('/user/:gid/:uid', authentication, authorization, deleteMember);

module.exports = groupRoute;
