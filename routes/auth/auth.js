const express = require('express');
const router = express.Router();
const { asyncMiddleware } = rootRequire('./lib/async-util');

router.post('/authenticate', asyncMiddleware ( async(req, res) => {

    if (req.body.grant_type === 'password') {
        try {
            const user = {
                id: 'admin',
                password: process.env.CATFOOD_PASSWORD
            };
            if (user && user.password === req.body.password) {
                res.status(200).send({ 'access_token': 'secret token!', 'user_id': `${user.id}` });
            } else {
                res.status(400).send({ 'error': `invalid user or password for ${req.body.username}` });
                throw new Error(`Authentication error: invalid user or password for ${req.body.username}`);
            }
        } catch (err) {
            const errStatus = err.status || 400;
            const errDetail = err.detail || 'Unknown Server Error';
            res.status(err.status).send({ 'error': `${errDetail}` });
            throw new Error(`${errStatus}: ${errDetail}`);
        }
    } else {
        res.status(400).send({ 'error': 'unsupported grant type' });

        throw new Error('Authentication error: unsupported grant type');
    }
}));

router.post('/revoke', (req, res) => {
    if (req.body.token_type_hint === 'access_token' || req.body.token_type_hint === 'refresh_token') {
        res.status(200).end();
    } else {
        res.status(400).send({ 'error': 'unsupported token type' });
        throw new Error('Authentication error: unsupported token type');
    }
});

module.exports = router;
