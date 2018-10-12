const PORT = process.env.PORT || 8080;
const express = require('express');
const bodyParser = require('body-parser');
const _ = require('lodash');
const router = express.Router();
const app = express();

const validateMiddleware = (req, res, next) => {
    if (!req.params.webtask) {
        const errMsgWT = 'No webtask provided.';
        res.status(400).send(errMsgWT);
        return next(errMsgWT);
    }
    try {
      req.webtask = require(req.params.webtask);
    } catch (e) {
        res.status(400).send(e);
        return next(e);
    }
    return next();
};

router
    .all('/', function(req, res) {
      if(_.isFunction(req.webtask)) {
        req.webtask({
            secrets: process.env
        }, req, res);
      }
    });

app
    .use(bodyParser.json())
    .use('/:webtask', validateMiddleware, router)
    .listen(PORT, () => console.log(`Listening on ${ PORT }`));

module.exports = app;
