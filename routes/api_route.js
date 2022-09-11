const express = require('express');
const { createGroup, getUserGroups, createMember, getGroupMembers, updateGroup, deleteMember } = require('../controllers/admin_controller');
const { postDebt, deleteDebt, updateDebt } = require('../controllers/operate_debt_controller');
const { getDebts, getDebtDetail, getMeberBalances, getSettle } = require('../controllers/get_debt_controller');
const apiRoute = express.Router();

apiRoute.get('/settle/:id', getSettle);
apiRoute.get('/user-groups/:id', getUserGroups);
apiRoute.get('/group-members/:id', getGroupMembers);
apiRoute.get('/debts', getDebts);
apiRoute.get('/debts-balances/:id', getMeberBalances);
apiRoute.get('/debt-detail/:id', getDebtDetail);
apiRoute.post('/group', createGroup);
apiRoute.post('/member', createMember);
apiRoute.post('/debt', postDebt);
apiRoute.put('/group', updateGroup);
apiRoute.put('/debt', updateDebt);
apiRoute.delete('/debt', deleteDebt);
apiRoute.delete('/pair-debts');
apiRoute.delete('/group-debts/:id');
apiRoute.delete('/member/:gid/:uid', deleteMember);

module.exports = apiRoute;
