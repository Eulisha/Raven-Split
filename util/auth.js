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
    let accessToken = req.get('authorization');
    if (!accessToken) {
        console.error('@authentication: 401: ', req.path, accessToken);
        return res.status(401).json({ err: 'Unauthorized' });
    }

    accessToken = accessToken.replace('Bearer ', '');
    if (accessToken == 'null') {
        console.error('@authentication: 401: ', req.path, accessToken);
        return res.status(401).json({ err: 'Unauthorized' });
    }

    // verify JWT
    try {
        const decodedUserInfo = await verifyJwt(jwt, accessToken, JWT_SECRET_KEY);
        if (!decodedUserInfo) {
            console.error('@authentication: 403: ', req.path, decodedUserInfo);
            return res.status(403).json({ err: 'Authorization failed' });
        }
        req.user = decodedUserInfo;
        return next();
    } catch (err) {
        console.error('@authentication: 403: ', req.path, err);
        return res.status(403).json({ err: 'Authorization failed' });
    }
};

const authorization = async (req, res, next) => {
    // get user-groups and roles
    const uid = req.user.id;
    const gid = Number(req.params.id);
    try {
        const [userGroupRole] = await User.getUserGroupRole(uid, gid); //{uid, name, role}
        if (!userGroupRole) {
            console.error('@authorization: db getUserGroupRole fail:', req.path, userGroupRole);
            return res.status(500).json({ error: 'Internal Server Error' });
        }
        //沒查到role, 沒權限
        if (userGroupRole.length === 0) {
            console.error('@authorization: 403:', req.path, userGroupRole);
            return res.status(403).json({ err: 'No authorization.' });
        }
        req.userGroupRole = userGroupRole[0];
        next();
    } catch (err) {
        console.error('@authorization: err:', req.path, err);
        return res.status(500).json({ err: 'Internal Server Error.' });
    }
};

module.exports = { authentication, authorization };
