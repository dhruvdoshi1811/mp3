function httpError(status, message) {
    var err = new Error(message);
    err.status = status;
    err.isApiError = true;
    return err;
}

function isValidId(id) {
    return typeof id === 'string' && /^[0-9a-fA-F]{24}$/.test(id);
}

function isNonEmptyString(value) {
    return typeof value === 'string' && value.trim() !== '';
}

async function findOr404(Model, id) {
    var doc = isValidId(id) ? await Model.findById(id) : null;
    if (!doc) {
        throw httpError(404, Model.modelName + ' not found');
    }
    return doc;
}

function parseJson(query, name) {
    if (query[name] === undefined) {
        return undefined;
    }
    try {
        return JSON.parse(query[name]);
    } catch (err) {
        throw httpError(400, 'The ' + name + ' parameter is not valid JSON');
    }
}

function parseObject(query, name, allowedValues) {
    var value = parseJson(query, name);
    if (value === undefined) {
        return undefined;
    }
    var isObject = value !== null && typeof value === 'object' && !Array.isArray(value);
    if (!isObject || (allowedValues && !Object.values(value).every(function (v) { return allowedValues.includes(v); }))) {
        throw httpError(400, 'The ' + name + ' parameter has an invalid value');
    }
    return value;
}

function parseWholeNumber(query, name) {
    var value = parseJson(query, name);
    if (value !== undefined && (!Number.isInteger(value) || value < 0)) {
        throw httpError(400, 'The ' + name + ' parameter must be a non-negative integer');
    }
    return value;
}

async function runQuery(query) {
    try {
        return await query;
    } catch (err) {
        if (['CastError', 'Error', 'MongoServerError'].includes(err.name)) {
            throw httpError(400, 'The query parameters are invalid');
        }
        throw err;
    }
}

function getCollection(Model, defaultLimit) {
    return async function (req, res) {
        var where = parseObject(req.query, 'where');
        var sort = parseObject(req.query, 'sort', [1, -1]);
        var select = parseObject(req.query, 'select', [0, 1]);
        var skip = parseWholeNumber(req.query, 'skip');
        var limit = parseWholeNumber(req.query, 'limit');
        var count = parseJson(req.query, 'count');
        if (count !== undefined && typeof count !== 'boolean') {
            throw httpError(400, 'The count parameter must be true or false');
        }

        var query = count ? Model.countDocuments(where) : Model.find(where).sort(sort).select(select);
        if (skip !== undefined) {
            query = query.skip(skip);
        }
        if (limit !== undefined) {
            query = query.limit(limit);
        } else if (defaultLimit !== undefined && !count) {
            query = query.limit(defaultLimit);
        }

        res.status(200).json({ message: 'OK', data: await runQuery(query) });
    };
}

function getOne(Model) {
    return async function (req, res) {
        await findOr404(Model, req.params.id);
        var select = parseObject(req.query, 'select', [0, 1]);
        var doc = await runQuery(Model.findById(req.params.id).select(select));
        res.status(200).json({ message: 'OK', data: doc });
    };
}

module.exports = {
    httpError: httpError,
    isValidId: isValidId,
    isNonEmptyString: isNonEmptyString,
    findOr404: findOr404,
    getCollection: getCollection,
    getOne: getOne
};
