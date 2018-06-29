const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const express = fli.npm.express;
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;
const responseHandler = fli.lib.responseHandler;
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res); 
     return next(errMsgToken);
  }
  return next();
};

router
.all('/flow', function (req, res) {
  console.log(`-- test flow`);
  as.waterfall([
    // 1 - create item in test db
    // 2 - trigger new state
    // 3 - call scheduler
    // 4 - check that item has status unqueued
    (next) => loader({
        method: 'put',
        url: `${req.webtaskContext.secrets.storeFunction}/${req.webtaskContext.secrets.id}`,
        qs: {token: req.webtaskContext.secrets.token},
        json: {
          state: 'test'
        }
      }, () => next()),
    (next) => loader({
      method: 'get',
      url: req.webtaskContext.secrets.scheduledFunction,
      qs: {token: req.webtaskContext.secrets.token, reset: true}
    }, () => next()),
    (next) => loader({
      method: 'put',
      url: `${req.webtaskContext.secrets.storeFunction}/${req.webtaskContext.secrets.id}`,
      qs: {token: req.webtaskContext.secrets.token},
      json: {
        state: 'new'
      }
    },() => next()),
    (next) => setTimeout(()=>next(), 1000),
    (next) => loader({
      method: 'get',
      url: req.webtaskContext.secrets.scheduledFunction,
      qs: {token: req.webtaskContext.secrets.token}
    }, () => next()),
    (next) => setTimeout(()=>next(), 3000),
    (next) => loader({
      method: 'get',
      url: `${req.webtaskContext.secrets.storeFunction}/${req.webtaskContext.secrets.id}`,
      qs: {token: req.webtaskContext.secrets.token}
    }, next)
  ],
  (err, response) => {
    responseHandler(err, res, _.get(response, 'state'));
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
