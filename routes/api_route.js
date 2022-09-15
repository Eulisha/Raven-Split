const express = require('express');
const { createGroup, createMember, getGroupUsers, updateGroup, deleteMember } = require('../controllers/group_controller');
const { postDebt, deleteDebt, updateDebt, postSettle } = require('../controllers/operate_debt_controller');
const { getDebts, getDebtDetail, getMeberBalances, getSettle } = require('../controllers/get_debt_controller');
const apiRoute = express.Router();

apiRoute.get('/group-users/:id', getGroupUsers);
apiRoute.get('/debts', getDebts);
apiRoute.get('/debts-balances/:id', getMeberBalances);
apiRoute.get('/debt-detail/:id', getDebtDetail);
apiRoute.get('/settle/:id', getSettle);
apiRoute.post('/group', createGroup);
apiRoute.post('/member', createMember);
apiRoute.post('/debt', postDebt);
apiRoute.post('/settle', postSettle);
apiRoute.put('/group', updateGroup);
apiRoute.put('/debt', updateDebt);
apiRoute.delete('/debt/:id', deleteDebt);
apiRoute.delete('/pair-debts');
apiRoute.delete('/group-debts/:id');
apiRoute.delete('/member/:gid/:uid', deleteMember);

module.exports = apiRoute;
