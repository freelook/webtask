const _ = require('lodash');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const as = require('async');
const app = express();
const router = express.Router();
const mongoose = require('mongoose');
const StoreSchema = mongoose.Schema({
  _id: mongoose.Schema.ObjectId,
  updated: {type: Date, default: Date.now},
  state: {type: String, default: 'new'},
  payload: mongoose.Schema.Types.Mixed
});
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  if(!req.params.db) {
     const errMsgDB = 'No DB provided.';
     res.status(400).send(errMsgDB);
     return next(errMsgDB);
  }
  const db = req.webtaskContext.secrets[req.params.db];
  if(!db) {
     const errMsgDBEmpty = 'DB not exist.';
     res.status(400).send(errMsgDBEmpty);
     return next(errMsgDBEmpty);
  }
  req.db = db;
  return next();
};
const mongoDbMiddleware = (req, res, next) => {
  return mongoose.connect(req.db, (err) => {
    req.Store = mongoose.model('Store', StoreSchema);
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
.get('/:id', function (req, res) {
  as.waterfall([
    (next) => req.Store.findById(req.params.id, next)
  ],
  (err, data) => responseHandler(err, res, data));
})
.post('/find', function(req, res) {
  as.waterfall([
    (next) => req.Store.find(req.body, next)
  ],
  (err, data) => responseHandler(err, res, data));
})
.post('/', function (req, res) {
  as.waterfall([
    (next) => req.Store.create({payload:req.body}, next)
  ],
  (err, data)=> responseHandler(err, res, data));
})
.patch('/:id', function (req, res) {
  as.waterfall([
    (next) => req.Store.findById(req.params.id, next),
    (item, next) => {
      if(!!item) {
        const patch = req.body || {};
        patch.updated = Date.now();
        patch.state = req.body.state;
        patch.payload = req.body.payload;
        _.merge(item, patch);
        console.log(item);
        return item.save(next);
      }
      return next();
    }
  ],
  (err, data)=> responseHandler(err, res, data));
})
.delete('/:id', function (req, res) {
  as.waterfall([
    (next) => req.Store.findOneAndRemove(req.params.id, next)
  ],
  (err, data)=> responseHandler(err, res, data));
});

app
.use(bodyParser.json())
.use('/:db', validateMiddleware, mongoDbMiddleware, router);

module.exports = wt.fromExpress(app);
