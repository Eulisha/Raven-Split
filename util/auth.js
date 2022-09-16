const jwt = require('jsonwebtoken');
const User = require('../models/user_model');
const { JWT_SECRET_KEY } = process.env;

const verifyJwt = async (jwt, token, jwtSecret) => {
    return new Promise((resolve, reject) => {
        jwt.verify(token, jwtSecret, (err, decode) => {
            if (err) {
                reject({ err: 'JWT validate failed.' });
            } else {
                resolve(decode);
            }
        });
    });
};

const authentication = async (req, res, next) => {
    console.log('token: ', req.get('Authorization'));
    let accessToken = req.get('Authorization');
    if (!accessToken) {
        return res.status(401).json({ err: 'Unauthorized' });
    }

    accessToken = accessToken.replace('Bearer ', '');
    if (accessToken == 'null') {
        return res.status(401).json({ err: 'Unauthorized' });
    }

    // verify JWT
    try {
        const decodedUserInfo = await verifyJwt(jwt, accessToken, JWT_SECRET_KEY);
        console.log('token decoded id: ', decodedUserInfo.id);
        if (!decodedUserInfo) {
            return res.status(403).json({ err: 'Forbidden' });
        }
        req.user = decodedUserInfo;
        return next();
    } catch (err) {
        console.log(err);
        return res.status(403).json({ err: 'Forbidden' });
    }
};

const authorization = async (req, res, next) => {
    // get user-groups and roles
    const uid = req.user.id;
    const gid = Number(req.params.id);
    console.log('uid, gid: ', uid, gid);
    const [userGroupRole] = await User.getUserGroupRole(uid, gid); //{uid, name, role}
    if (!userGroupRole) {
        return res.status(500).json({ error: 'Internal Server Error' });
    }
    req.userGroupRole = userGroupRole;
    console.debug(userGroupRole);
    next();
};

module.exports = { authentication, authorization };
