require('dotenv').config();

//logging system
const BG_COLOR = require('./config/mapping');
let log = console.log;
function getMyLog(color) {
    return function () {
        let fnName = arguments.callee.caller ? (arguments.callee.caller.name ? arguments.callee.caller.name : 'anonymous') : '';
        log(new Date().toISOString(), `\x1b[${color}m${fnName}\x1b[0m`, ...arguments);
    };
}
console.log = getMyLog(BG_COLOR.GREEN);
console.info = getMyLog(BG_COLOR.WHITE); //pointer
console.error = getMyLog(BG_COLOR.RED);
console.warn = getMyLog(BG_COLOR.YELLOW);
console.debug = getMyLog(BG_COLOR.CYAN); //db in-out data-result

// Express Initialization
const express = require('express');
const app = express();
const userRoute = require('./routes/user_route');
const groupRoute = require('./routes/group_route');
const debtRoute = require('./routes/debt_route');
const cors = require('cors');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());

//Routes
app.use('/', express.static('public'));
app.use('/api/user', userRoute);
app.use('/api/group', groupRoute);
app.use('/api/debt', debtRoute);

app.use(function (req, res, next) {
    res.status(404).send('Page Not Found.');
});

// Error handling
app.use(function (err, req, res, next) {
    console.log('Catch At app.js: ', err);
    return res.status(500).json({ err: 'Internal Server Error' });
});

app.listen(port, async () => {
    console.log(`Listening on port: ${process.env.PORT}`);
});
