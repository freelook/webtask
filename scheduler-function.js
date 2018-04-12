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

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== _.get(context, 'body.container')) {
    return cb('No token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => {
    storage.mm += 1;
    //todo: 1 minute handler
    if(storage.mm >= 60) {
      storage.mm = 0;
      storage.hh += 1;
      //todo: 1 hour handler
      if(storage.mm >= 24) {
        storage.hh = 0;
        //todo: 1 day handler
      }
    }
    context.storage.set(storage, next);
   }
   ], cb);
};