require('dotenv').config();
const { PORT } = process.env;
const port = PORT;

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
