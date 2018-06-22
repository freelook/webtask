var dbConnection, StoreSchema;
const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongoose = require('mongoose');
const _ = fli.npm.lodash;
const request = fli.npm.request;
const express = fli.npm.express;
const as = fli.npm.async;
const app = express();
const router = express.Router();
const loader = fli.lib.loader;
const responseHandler = fli.lib.responseHandler;
const streamer = (req) => (item, next) => loader({
    method: 'post',
    url: req.webtaskContext.secrets.notificationFunction,
    qs: {token: req.webtaskContext.secrets.token, topic: item.state},
    json: (() => {
      console.log('2----', req.params.db);
      item.db = req.params.db;
      return item;
    })()
}, next);
const createDbConnection = (db) => {
  if(!dbConnection) {
    dbConnection = mongoose.createConnection(db);
  }
  return dbConnection;
};
const createStoreSchema = (req) => {
  var streamerReq = streamer(req);
  if(!StoreSchema) {
    StoreSchema = mongoose.Schema({
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
        streamerReq(item, ()=>{});
      }
      next();
    });
  }
  return StoreSchema;
};
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
  console.log('1----', req.params.db);
  req.Store = createDbConnection(req.db).model('Store', createStoreSchema(req));
  next();
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
