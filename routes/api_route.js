const express = require('express');
const { createGroup } = require('../controllers/admin_controller');
const { getDebtMain, postDebt, getDebtDetail, deleteDebts } = require('../controllers/debt_controller');
const apiRoute = express.Router();

apiRoute.get('/settle');
apiRoute.get('/debts', getDebtMain);
apiRoute.get('/debt-detail', getDebtDetail);
apiRoute.post('/group', createGroup);
apiRoute.post('/debt', postDebt);
apiRoute.delete('/debts/:id', deleteDebts);

module.exports = apiRoute;
