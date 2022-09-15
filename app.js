require('dotenv').config();
const { PORT } = process.env;
const port = PORT;

// Express Initialization
const express = require('express');
const apiRoute = require('./routes/api_route');
const userRoute = require('./routes/user_route');
const app = express();
const cors = require('cors');

app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(cors());
//Routes
app.use('/', express.static('public'));
app.use('/api', apiRoute);
app.use('/api/user', userRoute);

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
