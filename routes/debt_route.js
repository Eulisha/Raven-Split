const express = require('express');
const { postDebt, deleteDebt, updateDebt, postSettle, postSettlePair, postSettleDone } = require('../controllers/operate_debt_controller');
const { getDebts, getDebtDetail, getMeberBalances, getSettle, getUserBalances, getDebtPages } = require('../controllers/get_debt_controller');
const { authentication, authorization } = require('../util/auth');
const { checkIfOnSettling } = require('../util/onSettleLock');
const debtRoute = express.Router();

debtRoute.get('/debts/:id', authentication, authorization, getDebts);
debtRoute.get('/balances/:id', authentication, authorization, getMeberBalances);
debtRoute.get('/detail/:id/:debtId', authentication, authorization, getDebtDetail);
debtRoute.get('/pages/:id', authentication, authorization, getDebtPages);
debtRoute.get('/settle/:id', authentication, checkIfOnSettling, authorization, getSettle);
debtRoute.post('/debt/:id', authentication, checkIfOnSettling, authorization, postDebt);
debtRoute.post('/settle/:id', authentication, checkIfOnSettling, authorization, postSettle);
debtRoute.post('/settle-pair/:id/:uid1/:uid2', authentication, checkIfOnSettling, authorization, postSettlePair);
debtRoute.post('/settle-done/:id', authentication, checkIfOnSettling, authorization, postSettleDone);
debtRoute.put('/debt/:id/:debtId', authentication, checkIfOnSettling, authorization, updateDebt);
debtRoute.delete('/debt/:id/:debtId', authentication, checkIfOnSettling, authorization, deleteDebt);
debtRoute.delete('/pair-debts');
debtRoute.delete('/group-debts/:id');
debtRoute.get('/user-balances', authentication, getUserBalances);

module.exports = debtRoute;
