const { checkGroupStatus } = require('../models/admin_model');

const checkIfOnSettling = async (req, res, next) => {
    const gid = Number(req.params.id);
    let uid = req.user.id;
    console.info('gid, uid, req.path: ', gid, uid, req.path);
    const [result] = await checkGroupStatus(gid);

    console.log('ifOnSettle result:', result);

    if (!result) {
        return res.status(500).json({ err: 'Internal Server Error.' });
    }
    if (result.length > 0) {
        //setting, only allow settler operate at settle related route
        if (uid !== result[0].uid || !req.path.includes('settle')) {
            return res.status(503).json({ err: `Sorry, since ${result[0].name} is settling now, please wait a litte bit.` });
        }
    }
    next();
};

module.exports = { checkIfOnSettling };
