module.exports = function (app, router) {
    require('./users.js')(router);
    require('./tasks.js')(router);
    app.use('/api', require('./home.js')(router));

    app.use(function (req, res) {
        res.status(404).json({ message: 'Not found', data: {} });
    });

    app.use(function (err, req, res, next) {
        if (err.isApiError) {
            res.status(err.status).json({ message: err.message, data: {} });
        } else if (err.code === 11000) {
            res.status(400).json({ message: 'This email is already used by another user', data: {} });
        } else if (err.status >= 400 && err.status < 500) {
            res.status(err.status).json({ message: 'The request is invalid', data: {} });
        } else {
            console.error(err);
            res.status(500).json({ message: 'Something went wrong on the server', data: {} });
        }
    });
};
