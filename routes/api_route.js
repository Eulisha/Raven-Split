const express = require('express');
const { createGroup } = require('../controllers/admin_controller');
const { getDebtMain } = require('../controllers/debt_controller');
const settleUp = require('../controllers/settle_up_controller');
const apiRoute = express.Router();

apiRoute.get('/split-settle', settleUp);
apiRoute.get('/split-debts', getDebtMain);
apiRoute.post('/split-group', createGroup);

module.exports = apiRoute;
