const express = require('express');
const { getDebtMain } = require('../controllers/debt_controller');
const settleUp = require('../controllers/settle_up_controller');
const apiRoute = express.Router();

apiRoute.get('/settle', settleUp);
apiRoute.post('/debt', getDebtMain);

module.exports = apiRoute;
