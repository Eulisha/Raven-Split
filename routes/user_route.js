const express = require('express');
const { signUp, signIn } = require('../controllers/user_controller');
const { userValidateRule, validate } = require('../util/validate');
const userRoute = express.Router();

userRoute.post('/signup', userValidateRule, validate, signUp);
userRoute.post('/signin', signIn);

module.exports = userRoute;
