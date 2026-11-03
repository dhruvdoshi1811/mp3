var User = require('../models/user');
var Task = require('../models/task');
var utils = require('./utils');

var httpError = utils.httpError;
var UNASSIGNED = { assignedUser: '', assignedUserName: 'unassigned' };

function readUserBody(body) {
    if (!utils.isNonEmptyString(body.name)) {
        throw httpError(400, 'A user must have a name');
    }
    if (typeof body.email !== 'string' || !/^\S+@\S+$/.test(body.email)) {
        throw httpError(400, 'A user must have a valid email');
    }
    var pendingTasks = body.pendingTasks === undefined ? [] : body.pendingTasks;
    if (!Array.isArray(pendingTasks) || !pendingTasks.every(utils.isValidId)) {
        throw httpError(400, 'pendingTasks must be a list of valid task ids');
    }
    return {
        name: body.name,
        email: body.email,
        pendingTasks: Array.from(new Set(pendingTasks.map(function (id) { return id.toLowerCase(); })))
    };
}

async function saveUser(user, fields) {
    var newIds = fields.pendingTasks;

    if (await User.findOne({ email: fields.email, _id: { $ne: user._id } })) {
        throw httpError(400, 'This email is already used by another user');
    }
    var tasks = await Task.find({ _id: { $in: newIds } });
    if (tasks.length !== newIds.length) {
        throw httpError(404, 'A task in pendingTasks does not exist');
    }
    if (tasks.some(function (task) { return task.completed; })) {
        throw httpError(400, 'A completed task cannot be in pendingTasks');
    }

    var userId = user._id.toString();
    var removedIds = user.pendingTasks.filter(function (id) { return !newIds.includes(id); });

    user.set(fields);
    await user.save();

    await Task.updateMany({ _id: { $in: removedIds } }, UNASSIGNED);
    await User.updateMany(
        { _id: { $ne: user._id }, pendingTasks: { $in: newIds } },
        { $pull: { pendingTasks: { $in: newIds } } }
    );
    await Task.updateMany(
        { $or: [{ _id: { $in: newIds } }, { assignedUser: userId }] },
        { assignedUser: userId, assignedUserName: user.name }
    );
    return user;
}

module.exports = function (router) {

    var usersRoute = router.route('/users');

    usersRoute.get(utils.getCollection(User));

    usersRoute.post(async function (req, res) {
        var fields = readUserBody(req.body || {});
        var user = await saveUser(new User(), fields);
        res.status(201).json({ message: 'User created', data: user });
    });

    var userRoute = router.route('/users/:id');

    userRoute.get(utils.getOne(User));

    userRoute.put(async function (req, res) {
        var user = await utils.findOr404(User, req.params.id);
        var fields = readUserBody(req.body || {});
        await saveUser(user, fields);
        res.status(200).json({ message: 'User updated', data: user });
    });

    userRoute.delete(async function (req, res) {
        var user = await utils.findOr404(User, req.params.id);
        await user.deleteOne();
        await Task.updateMany({ assignedUser: user._id.toString() }, UNASSIGNED);
        res.status(204).send();
    });

    return router;
}
