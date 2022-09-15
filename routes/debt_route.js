const express = require('express');
const { postDebt, deleteDebt, updateDebt, postSettle } = require('../controllers/operate_debt_controller');
const { getDebts, getDebtDetail, getMeberBalances, getSettle } = require('../controllers/get_debt_controller');
const { authentication, authorization } = require('../util/auth');
const debtRoute = express.Router();
// debtRoute.use(authentication, authorization);

debtRoute.get('/debts/:id', authentication, authorization, getDebts);
debtRoute.get('/debts-balances/:id', authentication, authorization, getMeberBalances);
debtRoute.get('/debt-detail/:id', getDebtDetail);
debtRoute.get('/settle/:id', getSettle);
debtRoute.post('/debt', postDebt);
debtRoute.post('/settle', postSettle);
debtRoute.put('/debt', updateDebt);
debtRoute.delete('/debt/:id', deleteDebt);
debtRoute.delete('/pair-debts');
debtRoute.delete('/group-debts/:id');

module.exports = debtRoute;
