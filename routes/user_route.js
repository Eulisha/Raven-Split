const express = require('express');
const { signUp, signIn, getUserProfile, getUserGroups } = require('../controllers/user_controller');
const { signUpRule, signInRule, validate } = require('../util/validate');
const userRoute = express.Router();

userRoute.post('/signup', signUpRule, validate, signUp);
userRoute.post('/signin', signInRule, validate, signIn);
userRoute.get('/profile', getUserProfile);
userRoute.get('/user-groups/:id', getUserGroups);

module.exports = userRoute;
