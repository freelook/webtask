const request = require('request');
const as = require('async');

const loader = (params, next) => {
  request.get({
    url: params.url,
    qs: params.qs
  }, (err, res, body) => {
    if(!!err || res.status !== 200 || !body) {
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
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => loader({
      url: context.secrets.queueFunction,
      qs: {
        token: context.secrets.token
      }
    })
   ], cb);
};