const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const mongoDbQueue = require('mongodb-queue');
const as = require('async');
const app = express();
const router = express.Router();

app.use(bodyParser.json());
router.use((req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  if(!req.query.qq) {
     const errMsgQQ = 'No queue name provided.';
     res.status(400).send(errMsgQQ);
     return next(errMsgQQ);
  }
  return next();
});
router.use((req, res, next) => {
  mongodb.MongoClient.connect(req.webtaskContext.secrets.mongo, function(err, db) {
    req.queue = mongoDbQueue(db, req.query.qq);
    next(err);
  });
});

router.get('/add/:msg', function (req, res) {
  as.waterfall([
    (next) => {
      req.queue.add(req.params.msg, next);
    }
  ], (err, id)=> {
      res.status(200).json({id:id});
  });
});

router.get('/get', function (req, res) {
  as.waterfall([
    (next) => {
      req.queue.get(next);
    }
    ], (err, msg)=> {
      res.status(200).json(msg);
  });
});

app.use('/', router);

module.exports = wt.fromExpress(app);
