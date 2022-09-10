const express = require('express');
const { createGroup, getUserGroups, createMember, getGroupMembers, updateGroup, deleteMember } = require('../controllers/admin_controller');
const { getDebtMain, postDebt, getDebtDetail, getMeberBalances, getSettle, deleteDebt } = require('../controllers/debt_controller');
const apiRoute = express.Router();

apiRoute.get('/settle/:id', getSettle);
apiRoute.get('/user-groups/:id', getUserGroups);
apiRoute.get('/group-members/:id', getGroupMembers);
apiRoute.get('/debts', getDebtMain);
apiRoute.get('/debts-balances/:id', getMeberBalances);
apiRoute.get('/debt-detail/:id', getDebtDetail);
apiRoute.post('/group', createGroup);
apiRoute.post('/member', createMember);
apiRoute.post('/debt', postDebt);
apiRoute.put('/group', updateGroup);
apiRoute.delete('/debt', deleteDebt);
apiRoute.delete('/pair-debts');
apiRoute.delete('/group-debts/:id');
apiRoute.delete('/member/:gid/:uid', deleteMember);

module.exports = apiRoute;
