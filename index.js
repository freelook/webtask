const PORT = process.env.PORT || 8080;
const express = require('express');
const bodyParser = require('body-parser');
const router = express.Router();
const app = express();

const dynos = {
    'facebook-publish': require('./dynos/facebook-publish.js')
};

const validateMiddleware = (req, res, next) => {
    if (req.query.token !== process.env.token) {
        const errMsgToken = 'No token.';
        res.status(400).send(errMsgToken);
        return next(errMsgToken);
    }
    const errMsgDyno = 'No dyno provided.';
    if (!req.params.dyno) {
        res.status(400).send(errMsgDyno);
        return next(errMsgDyno);
    }
    const dyno = dynos[req.params.dyno];
    if (!dyno) {
        res.status(400).send(errMsgDyno);
        return next(errMsgDyno);
    }
    req.dyno = dyno;
    return next();
};

router
    .get('/', function(req, res) {
        req.dyno({
            secrets: process.env
        }, req, res);
    });

app
    .use(bodyParser.json())
    .use('/:dyno', validateMiddleware, router)
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

module.exports = app;
