var express = require('express'),
    router = express.Router(),
    mongoose = require('mongoose');

require('dotenv').config();

var app = express();

var port = process.env.PORT || 3000;

mongoose.connect(process.env.MONGODB_URI).catch(function (err) { console.error('MongoDB connection error:', err.message); });

var allowCrossDomain = function (req, res, next) {
    res.header("Access-Control-Allow-Origin", "*");
    res.header("Access-Control-Allow-Headers", "X-Requested-With, X-HTTP-Method-Override, Content-Type, Accept");
    res.header("Access-Control-Allow-Methods", "POST, GET, PUT, DELETE, OPTIONS");
    next();
};
app.use(allowCrossDomain);

app.use(express.urlencoded({ extended: true }));
app.use(express.json());

require('./routes')(app, router);

app.listen(port);
console.log('Server running on port ' + port);
