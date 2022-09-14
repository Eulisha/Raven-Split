const jwt = require('jsonwebtoken');
const bcrypt = require('bcrypt');
const jwtSecret = process.env['JWT_SECRET_KEY'];
const jwtExpire = process.env['JWT_EXPIRE'];
const User = require('../models/user_model');

const signUp = async (req, res) => {
    console.log('sign-up body: ', req.body);

    const { email, password, name, cellphone, provider } = req.body;

    //確認email是否存在
    const checkExitResult = await User.checkUserExist(email);
    if (!checkExitResult) {
        return res.status(500).json({ err });
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

    const token = jwt.sign({ email }, jwtSecret, {
        expiresIn: jwtExpire,
    });

    // 拋回前端
    return res.json({
        data: {
            access_token: token,
            access_expired: jwtExpire,
            user: {
                uid: userId,
                name,
                email,
                cellphone,
                provider,
                picture: '',
            },
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

    //調整回傳API格式
    // user.provider = req.body.provider;
    delete signInResult.password;
    console.log(signInResult);

    // 生成token
    const token = jwt.sign({ email }, jwtSecret, {
        expiresIn: jwtExpire,
    });
    // 拋回前端
    return res.json({
        data: {
            access_token: token,
            access_expired: jwtExpire,
            user: signInResult,
        },
    });
};

////User Profile API////
const proileSearch = async (req, res) => {
    console.log('@profileSearch');
    if (req.authCode === 401 || req.authCode === 403) {
        return res.status(req.authCode).json(req.authResult);
    }
    //<sql>:查詢使用者資料
    try {
        let sql = 'SELECT * FROM user WHERE id = ?';
        console.log(req.decode);
        const [userInfo] = await promisePool.execute(sql, [req.decode.id]);

        //調整格式拋回前端
        delete userInfo[0].id;
        delete userInfo[0].password;
        let data = {};
        data = userInfo[0];
        return data;
    } catch (err) {
        // return res.status(500).json({ msg: err });
    }
};

module.exports = { signUp, signIn, proileSearch };
