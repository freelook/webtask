const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const mongoDbQueue = require('mongodb-queue');
const express = fli.npm.express;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const responseHandler = fli.lib.responseHandler;
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  if(!req.params.qq) {
     const errMsgQQ = 'No queue name provided.';
     responseHandler(errMsgQQ, res);
     return next(errMsgQQ);
  }
  return next();
};
const mongoDbQueueMiddleware = (req, res, next) => {
  mongodb.MongoClient.connect(req.webtaskContext.secrets.mongo, function(err, db) {
    req.queue = mongoDbQueue(db, req.params.qq, {
      visibility: 1,
      delay: 0,
      maxRetries: 3,
      deadQueue: mongoDbQueue(db, `${req.params.qq}-dead`)
    });
    next(err);
  });
};

router
.all('/add/:msg?', function (req, res) {
  var msg = _.get(req, 'body.msg') || _.get(req, 'params.msg');
  if(!msg) {
    return responseHandler('No msg provided.', res);
  }
  as.waterfall([
    (next) => req.queue.add(msg, next)
  ],
  (err, id) => responseHandler(err, res, {id:id}));
})
.get('/get', function (req, res) {
  as.waterfall([
    (next) => req.queue.get(next)
  ],
  (err, msg)=> responseHandler(err, res, msg));
})
.get('/ack', function (req, res) {
  as.waterfall([
    (next) => req.queue.get(next),
    (item, next) => {
      !!_.get(item, 'ack') ? req.queue.ack(item.ack, next) : item('Queue is empty.');
    },
    (id, next) => req.queue.clean((err) => next(err, {id:id}))
  ],
  (err, data)=> responseHandler(err, res, data));
});

app
.use(bodyParser.json())
.use('/:qq', validateMiddleware, mongoDbQueueMiddleware, router);

module.exports = wt.fromExpress(app);
