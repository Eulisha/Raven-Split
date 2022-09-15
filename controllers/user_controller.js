const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const jwtSecret = process.env['JWT_SECRET_KEY'];
const jwtExpire = process.env['JWT_EXPIRE'];
const User = require('../models/user_model');

const signUp = async (req, res) => {
    console.log('sign-up body: ', req.body);

    const { email, password, name, cellphone, provider } = req.body;

    //確認email是否存在
    const checkExitResult = await User.checkExit(email);
    if (!checkExitResult) {
        return res.status(500).json({ err: checkExitResult });
    }
    if (checkExitResult.length !== 0) {
        return res.status(403).json({ err: 'email already existed.' });
    }

    // 儲存前先hash密碼
    const hash = await bcrypt.hash(password, 10);

    // 儲存使用者
    const userId = await User.signUp(email, hash, name, cellphone, provider);
    console.log(userId);
    // 生成token

    const user = {
        id: userId,
        email,
        name,
        cellphone,
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
    console.log('sign-in body :', req.body);

    const { email, password, provider } = req.body;

    //確認email是否存在
    const [signInResult] = await User.signIn(email);

    if (!signInResult) {
        return res.status(500).json({ err });
    }
    if (signInResult === 0) {
        return res.status(403).json({ msg: 'email not existed.' });
    }

    // hash密碼來驗證
    try {
        const hash = await bcrypt.compare(password, signInResult.password);
        if (!hash) {
            return res.status(403).json({ msg: 'Password incorrect.' });
        }
    } catch (err) {
        return res.status(500).json({ msg: 'hash fail.' });
    }

    // get user-groups and roles
    const userGroups = await User.getUserGroups(signInResult.id);
    if (!userGroups) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }

    //調整格式
    const user = {
        id: signInResult.id,
        email: signInResult.email,
        name: signInResult.name,
        cellphone: signInResult.cellphone,
        picture: signInResult.picture,
        provider: signInResult.provider,
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

const getUserProfile = async (req, res) => {
    //user info 從 authenticate 解 JWT token 得出
    res.status(200).json({ data: req.user });
};
const getUserGroups = async (req, res) => {
    let uid = req.user.id;
    const groups = await User.getUserGroups(uid);
    if (!groups) {
        return res.status(500).json({ err: 'Internal Server Error' });
    }
    res.status(200).json({ data: groups });
};

module.exports = { signUp, signIn, getUserProfile, getUserGroups };
