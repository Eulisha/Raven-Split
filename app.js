require('dotenv').config();
const { PORT } = process.env;
const port = PORT;

const BG_COLOR = {
    RED: '41',
    GREEN: '42',
    YELLOW: '43',
};

let log = console.log;
function mylog() {}
function getMyLog(color) {
    return function () {
        let fnName = arguments.callee.caller.name ? arguments.callee.caller.name : 'anonymous';
        log(new Date().toISOString(), `\x1b[${color}m${fnName}\x1b[0m`, ...arguments);
    };
}
console.log = getMyLog(BG_COLOR.GREEN);
console.error = getMyLog(BG_COLOR.RED);
console.warn = getMyLog(BG_COLOR.YELLOW);

// Express Initialization
const express = require('express');
const userRoute = require('./routes/user_route');
const groupRoute = require('./routes/group_route');
const debtRoute = require('./routes/debt_route');
const app = express();
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
    res.status(500).send('Internal Server Error');
});

app.listen(port, async () => {
    console.log(`Listening on port: ${port}`);
});
