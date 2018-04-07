const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const mongoDbQueue = require('mongodb-queue');
const as = require('async');
const app = express();

app.use((req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     res.status(400).send('No token.');
     return next('No token.');
  }
  return next();
});
app.use(bodyParser.json());
app.use((req, res, next) => {
  mongodb.MongoClient.connect(req.webtaskContext.secrets.mongo, function(err, db) {
    req.queue = mongoDbQueue(db, req.params.qq);
    next(err);
  });
});

app.get('/:qq/add/:msg', function (req, res) {
  as.waterfall([
    (next) => {
      req.queue.add(req.params.msg, next);
    }
  ], ()=> {
      res.status(200).send('add');
  });
});

app.get('/:qq/get', function (req, res) {
  as.waterfall([
    
    ], ()=> {
      res.status(200).send('get');
  });
});

module.exports = wt.fromExpress(app);
