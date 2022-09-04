const express = require('express');
const { getDebtMain, postGroup } = require('../controllers/debt_controller');
const settleUp = require('../controllers/settle_up_controller');
const apiRoute = express.Router();

apiRoute.get('/split-settle', settleUp);
apiRoute.get('/split-debts', getDebtMain);
apiRoute.post('/split-group', postGroup);

module.exports = apiRoute;
