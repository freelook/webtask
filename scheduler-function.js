const request = require('request');
const as = require('async');
const _ = require('lodash');

const loader = (params, next) => request.get({
    url: params.url,
    qs: params.qs
  }, (err, res, body) => {
    if(!!err || res.statusCode !== 200 || !body) {
      return next(err || body || 'No body.');
    }
    return next(null, body);
});

const worker = (context) => (params, next) => as.map(
  params.tasks,
  (task, next) => loader({
    url: context.secrets[task], 
    qs: {token: context.secrets.token}
  }, next), 
  next
);

const mmHandler = (context) => (storage, next) => {
  storage.count.mm += 1;
  return worker(context)({tasks: storage.tasks.mm}, (err, result) => next(null, storage));
};

const hhHandler = (context) => (storage, next) => {
  if(storage.count.mm >= 60) {
    storage.count.mm = 0;
    storage.count.hh += 1;
    return worker(context)({tasks: storage.tasks.hh}, (err, result) => next(null, storage));
  }
  return next(null, storage);
};

const ddHandler = (context) => (storage, next) => {
  if(storage.count.hh >= 24) {
    storage.count.hh = 0;
    return worker(context)({tasks: storage.tasks.dd}, (err, result) => next(null, storage));
  }
  return next(null, storage);
};

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.container !== _.get(context, 'body.container')) {
    return cb('No container token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => mmHandler(context)(storage, next),
   (storage, next) => hhHandler(context)(storage, next),
   (storage, next) => ddHandler(context)(storage, next),
   (storage, next) => context.storage.set(storage, next)
  ], cb);
};
