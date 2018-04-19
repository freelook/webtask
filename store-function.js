const _ = require('lodash');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const as = require('async');
const app = express();
const router = express.Router();
const mongoose = require('mongoose');
const loader = (params, next) => {
  request({
    method: (params.method || 'get').toUpperCase(),
    url: params.url,
    qs: params.qs,
    json: params.json
  }, (err, res, body) => {
    if(!!err || res.statusCode !== 200 || !body) {
      return next(err || body || 'No body.');
    }
    const msg = JSON.parse(body);
    return next(null, msg);
  });
};
const streamer = (context) => (item, next) => loader({
    method: 'post',
    url:context.secrets.notificationFunction,
    qs: {token: context.secrets.token, topic: item.state},
    json: item
});
const StoreSchema = mongoose.Schema({
  updated: {type: Date, default: Date.now},
  state: {type: String, default: 'new'},
  payload: {type: mongoose.Schema.Types.Mixed, default: {}}
}, {minimize: false});
StoreSchema.pre('save', function (next) {
  this.isStreamRequired = !!this.state && (this.isNew || this.isModified('state'));
  next();
});
StoreSchema.post('save', function(item, next) {
  if(!!this.isStreamRequired) {
    //streamer(req.webtaskContext)(item, ()=>{});
  }
  next();
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
        item.updated = Date.now();
        item.payload = _.merge({}, item.payload, req.body);
        return item.save(next);
      }
      return next();
    }
  ],
  (err, data)=> responseHandler(err, res, data));
})
.put('/:id', function (req, res) {
  as.waterfall([
    (next) => req.Store.findById(req.params.id, next),
    (item, next) => {
      if(!!item) {
        item.updated = Date.now();
        if(!!req.body.state) {
          item.state = req.body.state;
        }
        if(!!req.body.payload) {
         item.payload = req.body.payload;
        }
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
