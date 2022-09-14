const express = require('express');
const { signUp, signIn } = require('../controllers/user_controller');
const { signUpRule, signInRule, validate } = require('../util/validate');
const userRoute = express.Router();

userRoute.post('/signup', signUpRule, validate, signUp);
userRoute.post('/signin', signInRule, validate, signIn);

module.exports = userRoute;
