const express = require('express');
const { postDebt, deleteDebt, updateDebt, postSettle, postSettlePair } = require('../controllers/operate_debt_controller');
const { getDebts, getDebtDetail, getMeberBalances, getSettle, getUserBalances } = require('../controllers/get_debt_controller');
const { authentication, authorization } = require('../util/auth');
const debtRoute = express.Router();

debtRoute.get('/debts/:id', authentication, authorization, getDebts);
debtRoute.get('/balances/:id', authentication, authorization, getMeberBalances);
debtRoute.get('/detail/:id/:debtId', authentication, authorization, getDebtDetail);
debtRoute.get('/settle/:id', authentication, authorization, getSettle);
debtRoute.post('/debt/:id', authentication, authorization, postDebt);
debtRoute.post('/settle/:id', authentication, authorization, postSettle);
debtRoute.post('/settle/:id/:uid1/:uid2', authentication, authorization, postSettlePair);
debtRoute.put('/debt/:id/:debtId', authentication, authorization, updateDebt);
debtRoute.delete('/debt/:id/:debtId', authentication, authorization, deleteDebt);
debtRoute.delete('/pair-debts');
debtRoute.delete('/group-debts/:id');
debtRoute.get('/user-balances', authentication, getUserBalances);

module.exports = debtRoute;
