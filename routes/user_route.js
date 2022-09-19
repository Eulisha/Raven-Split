const express = require('express');
const { signUp, signIn, getUserGroups, checkUserExist, getUserInfo } = require('../controllers/user_controller');
const { signUpRule, signInRule, validate } = require('../util/validate');
const { authentication } = require('../util/auth');
const userRoute = express.Router();

userRoute.post('/signup', signUpRule, validate, signUp);
userRoute.post('/signin', signInRule, validate, signIn);
userRoute.get('/user-info', authentication, getUserInfo);
userRoute.get('/groups', authentication, getUserGroups);
userRoute.get('/user-exist', authentication, checkUserExist);

module.exports = userRoute;
