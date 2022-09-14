const { body, validationResult } = require('express-validator');

const userValidateRule = [
    body(['*', 'order.*', 'order.*.*', 'order.*.*.*']).notEmpty().withMessage('Have empty column in API'),
    body('email').isEmail().withMessage('Incorrect email format.'),
    body('password').isLength({ min: 8, max: 40 }).withMessage('The length of password should londer than 8.'),
    body('cellphone').isLength({ min: 10, max: 10 }).withMessage('Incorrect phone format.'),
    body(['name', 'email']).isLength({ max: 40 }).withMessage('The length should not londer than 40.'),
];
const validate = (req, res, next) => {
    // userValidateRule();
    console.log('validateRule');
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
        return res.status(400).json({ errors: errors.array() });
    }
    next();
};
module.exports = { userValidateRule, validate };
