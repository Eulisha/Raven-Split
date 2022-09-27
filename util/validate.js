const { body, validationResult } = require('express-validator');

const signUpRule = [
    body('*').notEmpty().withMessage("Can't Have empty column."),
    body('email').isEmail().withMessage('Incorrect email format.'),
    body('password').isLength({ min: 8, max: 40 }).withMessage('The length of password should londer than 8.'),
    body('cellphone').isLength({ min: 10, max: 10 }).withMessage('Incorrect phone format.'),
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
const validate = (req, res, next) => {
    console.log('validateRule');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ err: errors.array(), provider: 'validator' }); // 增加給前端做判斷的key
    }
    next();
};
module.exports = { signUpRule, signInRule, validate };
