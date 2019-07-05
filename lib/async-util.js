/**
 * Wraps a normal express handler so avoid the boilerplate try/catch you'd
 * otherwise need to put around the express route handler body.
 *
 * @param fn
 * @returns {Function}
 */
const asyncMiddleware = fn => (req, res, next) => {
    Promise.resolve(fn(req, res, next))
        .catch(next);
};

module.exports = {
    asyncMiddleware
};
