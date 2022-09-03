require('dotenv').config();
const { PORT } = process.env;
const port = PORT;

// Express Initialization
const express = require('express');
const apiRoute = require('./routes/api_route');
const app = express();

app.use(express.json());
app.use(express.urlencoded({ extended: true }));

//Routes
app.use('/', express.static('public'));
app.use('/api', apiRoute);

app.get('/', (req, res) => {
    res.send('ok');
});

// Page not found
app.use(function (req, res, next) {
    res.status(404).send('Page Not Found.');
});

// Error handling
app.use(function (err, req, res, next) {
    res.status(500).send('Internal Server Error');
});

app.listen(port, async () => {
    console.log(`Listening on port: ${port}`);
});
