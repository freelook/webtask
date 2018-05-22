const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const mongoDbQueue = require('mongodb-queue');
const as = require('async');
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  if(!req.params.qq) {
     const errMsgQQ = 'No queue name provided.';
     res.status(400).send(errMsgQQ);
     return next(errMsgQQ);
  }
  return next();
};
const mongoDbQueueMiddleware = (req, res, next) => {
  mongodb.MongoClient.connect(req.webtaskContext.secrets.mongo, function(err, db) {
    req.queue = mongoDbQueue(db, req.params.qq, {
      visibility: 1,
      delay: 0,
      maxRetries: 5,
      deadQueue: mongoDbQueue(db, `${req.params.qq}-dead`)
    });
    next(err);
  });
};
const responseHandler = (err, res, data) => {
  if(!!err) {
    return res.status(400).json(err);
  }
  return res.status(200).json(data);
};

router
.get('/add/:msg', function (req, res) {
  as.waterfall([
    (next) => req.queue.add(req.params.msg, next)
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
    (item, next) => !!_.get(item, 'ack') ? req.queue.ack(item.ack, next) : item('Queue is empty.'),
    (id, next) => req.queue.clean((err) => next(err, {id:id}))
  ],
  (err, data)=> responseHandler(err, res, data));
});

app
.use(bodyParser.json())
.use('/:qq', validateMiddleware, mongoDbQueueMiddleware, router);

module.exports = wt.fromExpress(app);
