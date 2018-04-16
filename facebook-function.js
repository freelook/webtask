const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const as = require('async');
const fb = require('fb');
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  return next();
};
const responseHandler = (res) => (err, data) => {
  if(!!err) {
    return res.status(400).json(err);
  }
  return res.status(200).json(data);
};

router
.post('/msg', function (req, res) {
  as.waterfall([
    (next) => next()
  ],
  (err, result) => responseHandler(res)(err, result));
});

app
.use(bodyParser.json())
.use('/', router);

module.exports = wt.fromExpress(app);
