const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const as = require('async');
const app = express();
const router = express.Router();
const StoreSchema = mongoose.Schema({
  updated: { 
    type: Date,
    default: Date.now
  }, 
  payload: mongoose.Schema.Types.Mixed
});
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  return next();
};
const validateIdRouteMiddleware = (req, res, next) => {
  if(!req.params.id) {
     const errMsgId = 'No id param provided.';
     responseHandler(errMsgId, res);
     return next(errMsgId);
  }
  return next();
};
const validateBodyRouteMiddleware = (req, res, next) => {
  if(!req.body) {
     const errMsgBody = 'No body provided.';
     responseHandler(errMsgBody, res);
     return next(errMsgBody);
  }
  return next();
};
const mongoDbMiddleware = (req, res, next) => {
  mongoose.connect(req.webtaskContext.secrets.mongo, (err) => {
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
.get('/:id', validateIdRouteMiddleware, function (req, res) {
  as.waterfall([
    (next) => req.Store.findById(req.params.id, next)
  ],
  (err, data) => responseHandler(err, res, data));
})
.post('/:id?', validateBodyRouteMiddleware, function (req, res) {
  as.waterfall([
    (next) => {
      console.log(req.body);
      var item = new req.Store({payload:req.body});
      item.save(next);
    }
  ],
  (err, data)=> responseHandler(err, res, data));
})
.patch('/:id', function (req, res) {
  as.waterfall([
    
  ],
  (err, data)=> responseHandler(err, res, data));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, mongoDbMiddleware, router);

module.exports = wt.fromExpress(app);
