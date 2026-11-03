var User = require('../models/user');
var Task = require('../models/task');
var utils = require('./utils');

var httpError = utils.httpError;

function readTaskBody(body) {
    if (!utils.isNonEmptyString(body.name)) {
        throw httpError(400, 'A task must have a name');
    }
    var deadline = new Date(body.deadline);
    if (!['string', 'number'].includes(typeof body.deadline) || isNaN(deadline)) {
        throw httpError(400, 'A task must have a valid deadline');
    }

    var description = body.description === undefined ? '' : body.description;
    if (typeof description !== 'string') {
        throw httpError(400, 'description must be a string');
    }

    var completed = body.completed === undefined ? false : body.completed;
    if (completed === 'true' || completed === 'false') {
        completed = completed === 'true';
    }
    if (typeof completed !== 'boolean') {
        throw httpError(400, 'completed must be true or false');
    }

    var assignedUser = body.assignedUser === undefined ? '' : body.assignedUser;
    if (assignedUser !== '' && !utils.isValidId(assignedUser)) {
        throw httpError(400, 'assignedUser must be a valid user id');
    }
    var assignedUserName = body.assignedUserName === undefined ? '' : body.assignedUserName;
    if (typeof assignedUserName !== 'string') {
        throw httpError(400, 'assignedUserName must be a string');
    }

    return {
        name: body.name,
        description: description,
        deadline: deadline,
        completed: completed,
        assignedUser: assignedUser,
        assignedUserName: assignedUserName
    };
}

async function saveTask(task, fields) {
    var user = null;
    if (fields.assignedUser !== '') {
        user = await User.findById(fields.assignedUser);
        if (!user) {
            throw httpError(404, 'The assigned user does not exist');
        }
    }
    var expectedName = user ? user.name : 'unassigned';
    if (fields.assignedUserName !== '' && fields.assignedUserName !== expectedName) {
        throw httpError(400, 'assignedUserName does not match assignedUser');
    }
    fields.assignedUser = user ? user._id.toString() : '';
    fields.assignedUserName = expectedName;

    var taskId = task._id.toString();
    var previousUser = task.assignedUser;

    task.set(fields);
    await task.save();

    if (previousUser && previousUser !== fields.assignedUser) {
        await User.updateOne({ _id: previousUser }, { $pull: { pendingTasks: taskId } });
    }
    if (user) {
        var change = task.completed ? { $pull: { pendingTasks: taskId } } : { $addToSet: { pendingTasks: taskId } };
        await User.updateOne({ _id: user._id }, change);
    }
    return task;
}

module.exports = function (router) {

    var tasksRoute = router.route('/tasks');

    tasksRoute.get(utils.getCollection(Task, 100));

    tasksRoute.post(async function (req, res) {
        var fields = readTaskBody(req.body || {});
        var task = await saveTask(new Task(), fields);
        res.status(201).json({ message: 'Task created', data: task });
    });

    var taskRoute = router.route('/tasks/:id');

    taskRoute.get(utils.getOne(Task));

    taskRoute.put(async function (req, res) {
        var task = await utils.findOr404(Task, req.params.id);
        var fields = readTaskBody(req.body || {});
        await saveTask(task, fields);
        res.status(200).json({ message: 'Task updated', data: task });
    });

    taskRoute.delete(async function (req, res) {
        var task = await utils.findOr404(Task, req.params.id);
        await task.deleteOne();
        if (task.assignedUser) {
            await User.updateOne({ _id: task.assignedUser }, { $pull: { pendingTasks: task._id.toString() } });
        }
        res.status(204).send();
    });

    return router;
}
