const { body, validationResult } = require('express-validator');

const signUpRule = [
    body('*').notEmpty().withMessage("Can't Have empty column."),
    body('email').isEmail().withMessage('Incorrect email format.'),
    body('password').isLength({ min: 8, max: 40 }).withMessage('The length of password should londer than 8.'),
    body(['name', 'email']).isLength({ max: 40 }).withMessage('The length of name and email should not londer than 40.'),
    body('provider').isIn(['native']).withMessage('Invalid provider'),
];
const signInRule = [
    body('*').notEmpty().withMessage("Can't Have empty column."),
    body('email').isEmail().withMessage('Incorrect email format.'),
    body('email').isLength({ max: 40 }).withMessage('The length should not londer than 40.'),
    body('password').isLength({ min: 8, max: 40 }).withMessage('The length of password should londer than 8.'),
    body('provider').isIn(['native']).withMessage('Invalid provider'),
];
const debtFormSubmitRule = [
    body('*.*').notEmpty().withMessage("Can't Have empty column."),
    body('debt_main.date').isAfter('2000-01-01').isBefore('2050-01-01').withMessage('Out of supported date range.'),
    body('debt_main.split_method').isIn(['1', '2']).withMessage('Incorrect split method.'),
    body(['debt_main.total', 'debt_detail.*.amount']).isInt({ min: 1, max: 100000000 }).withMessage('Amount should not less than 1 or greater than 100000000.'),
    body('debt_main.total').custom((value, { req }) => {
        let splitTotal = 0;
        Object.values(req.body.debt_detail).map((detail) => {
            splitTotal += Number(detail.amount);
        });
        if (value != splitTotal) {
            throw new Error('Total mismatch with expense spliting.');
        }
        return true;
    }),
];
const settleFormSubmitRule = [
    body('settle_main.date').notEmpty().withMessage("Can't Have empty column."),
    body('settle_main.date').isAfter('2000-01-01').isBefore('2050-01-01').withMessage('Out of supported date range.'),
];
const groupFormSubmitRule = [body('group_name').notEmpty().withMessage("Can't Have empty column.")];

const validate = (req, res, next) => {
    const errors = validationResult(req);

    if (!errors.isEmpty()) {
        console.error('@vaildate: fail: ', req.path, errors.array());
        return res.status(400).json({ err: errors.array(), provider: 'validator' }); // provider是用來給前端做判斷的key
    }
    next();
};
module.exports = { signUpRule, signInRule, debtFormSubmitRule, settleFormSubmitRule, groupFormSubmitRule, validate };
