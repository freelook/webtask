const request = require('request');
const as = require('async');
const _ = require('lodash');

const loader = (params, next) => {
  request.get({
    url: params.url,
    qs: params.qs
  }, (err, res, body) => {
    if(!!err || res.statusCode !== 200 || !body) {
      return next(err || body || 'No body.');
    }
    const msg = JSON.parse(body);
    return next(null, msg);
  });
};

const mmHandler = (storage, next) => {
  storage.mm += 1;
  as.map(
    storage.tasks.mm,
    (task) => loader({url: task}), 
    (err, result) => next(null, storage)
  );
};

const hhHandler = (storage, next) => {
  if(storage.mm >= 60) {
    storage.mm = 0;
    storage.hh += 1;
  }
  next(null, storage);
};

const ddHandler = (storage, next) => {
  if(storage.hh >= 24) {
    storage.hh = 0;
  }
  next(null, storage);
};

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== _.get(context, 'body.container')) {
    return cb('No token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => mmHandler(storage, next),
   (storage, next) => hhHandler(storage, next),
   (storage, next) => ddHandler(storage, next),
   (storage, next) => context.storage.set(storage, next)
  ], cb);
};