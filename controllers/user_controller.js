const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const jwtSecret = process.env['JWT_SECRET_KEY'];
const jwtExpire = process.env['JWT_EXPIRE'];
const User = require('../models/user_model');

const signUp = async (req, res) => {
    const { email, password, name, provider } = req.body;

    //確認email是否存在
    const checkExistResult = await User.checkExist(email);
    if (!checkExistResult) {
        console.error('@signUp: db checkExistResult fail: 500: ', checkExistResult);
        return res.status(500).json({ err: 'Internal Server Error.' });
    }
    if (checkExistResult.length != 0) {
        console.error('@signUp: db checkExistResult fail: 403: ', checkExistResult);
        return res.status(403).json({ err: 'Email already existed.' });
    }

    // 儲存前先hash密碼
    const hash = await bcrypt.hash(password, 10);

    // 儲存使用者
    const userId = await User.signUp(email, hash, name, provider);

    // 生成token
    const user = {
        id: userId,
        email,
        name,
        picture: null,
        provider,
    };
    const token = jwt.sign(user, jwtSecret, {
        expiresIn: jwtExpire,
    });

    // 拋回前端
    return res.json({
        data: {
            accessToken: token,
            accessExpired: jwtExpire,
            user,
            userGroups: [],
        },
    });
};

const signIn = async (req, res) => {
    const { email, password, provider } = req.body;

    //確認email是否存在
    const signInResult = await User.signIn(email);

    if (!signInResult) {
        console.error('@signIn: signInResult fail: 500: ', signInResult);
        return res.status(500).json({ err: 'Internal Server Eroor.' });
    }
    if (signInResult.length == 0) {
        console.error('@signIn: signInResult fail: 403: ', signInResult);
        return res.status(403).json({ err: 'Please check e-mail and password are correct.' });
    }

    // hash密碼來驗證
    try {
        const hash = await bcrypt.compare(password, signInResult[0].password);
        if (!hash) {
            console.error('@signIn: fail: 403: ', hash);
            return res.status(403).json({ err: 'Please check e-mail and password are correct.' });
        }
    } catch (err) {
        console.error('@signIn: fail: 500: ', err);
        return res.status(500).json({ err: 'Internal Server Error' });
    }

    // get user-groups and roles
    const userGroups = await User.getUserGroups(signInResult[0].id);
    if (!userGroups) {
        console.error('@signIn: db userGroups fail: 500: ', hash);
        return res.status(500).json({ error: 'Internal Server Error' });
    }

    //調整格式
    const user = {
        id: signInResult[0].id,
        email: signInResult[0].email,
        name: signInResult[0].name,
        picture: signInResult[0].picture,
        provider: signInResult[0].provider,
    };

    // 生成token
    const token = jwt.sign(user, jwtSecret, {
        expiresIn: jwtExpire,
    });

    // 拋回前端
    return res.json({
        data: {
            accessToken: token,
            accessExpired: jwtExpire,
            user,
            userGroups,
        },
    });
};

const getUserInfo = async (req, res) => {
    //JWT解出的token
    let email = req.user.email;

    //確認使用者是否存在(與signIn共用function)
    const signInResult = await User.signIn(email);

    if (!signInResult) {
        console.error('@getUserInfo: db signIn fail: ', signInResult);
        return res.status(500).json({ err: 'Internal Server Eroor.' });
    }
    if (signInResult.length == 0) {
        console.error('@getUserInfo: 403');
        return res.status(403).json({ err: 'JWT invalid.' });
    }

    // get user-groups and roles
    const userGroups = await User.getUserGroups(signInResult[0].id);
    if (!userGroups) {
        console.error('@getUserInfo: db getUserGroups fail: ', userGroups);
        return res.status(500).json({ error: 'Internal Server Error' });
    }

    //調整格式
    const user = {
        id: signInResult[0].id,
        email: signInResult[0].email,
        name: signInResult[0].name,
        picture: signInResult[0].picture,
        provider: signInResult[0].provider,
    };

    res.status(200).json({ data: req.user });
};
const getUserGroups = async (req, res) => {
    let uid = req.user.id;
    const groups = await User.getUserGroups(uid);
    if (!groups) {
        console.error('@getUserGroups: db getUserGroups fail', groups);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: groups });
};
const checkUserExist = async (req, res) => {
    const email = req.query.email;
    if (!email || email == '') {
        console.error('@checkUserExist: 400');
        return res.status(400).json({ err: 'No email input.' });
    }
    const checkExistResult = await User.checkExist(email);
    if (!checkExistResult) {
        console.error('@checkUserExist: 500: db checkExist fail:', checkExistResult);
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    if (checkExistResult.length == 0) {
        console.error('@checkUserExist: 404:', checkExistResult);
        return res.status(404).json({ err: 'User not exist.' });
    }
    res.status(200).json({ data: checkExistResult[0] });
};
module.exports = { signUp, signIn, getUserInfo, getUserGroups, checkUserExist };
