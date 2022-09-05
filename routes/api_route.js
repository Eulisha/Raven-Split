const express = require('express');
const { createGroup } = require('../controllers/admin_controller');
const { getDebtMain, postDebt } = require('../controllers/debt_controller');
const apiRoute = express.Router();

apiRoute.get('/split-settle');
apiRoute.get('/split-debts', getDebtMain);
apiRoute.post('/split-group', createGroup);
apiRoute.post('/split-debt', postDebt);

module.exports = apiRoute;
