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
    req.queue = mongoDbQueue(db, req.params.qq);
    next(err);
  });
});

router.get('/add/:msg', function (req, res) {
  as.waterfall([
    (next) => {
      req.queue.add(req.params.msg, next);
    }
  ], ()=> {
      res.status(200).send('add');
  });
});

router.get('/get', function (req, res) {
  as.waterfall([
    
    ], ()=> {
      res.status(200).send('get');
  });
});

app.use('/', router);

module.exports = wt.fromExpress(app);
