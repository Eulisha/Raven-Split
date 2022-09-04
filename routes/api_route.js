const express = require('express');
const { getDebtMain } = require('../controllers/debt_controller');
const settleUp = require('../controllers/settle_up_controller');
const { createGroup } = require('../models/admin_model');
const apiRoute = express.Router();

apiRoute.get('/split-settle', settleUp);
apiRoute.get('/split-debts', getDebtMain);
apiRoute.post('/split-group', createGroup);
//format {group_name:'',members:[id1, id2]}

module.exports = apiRoute;
