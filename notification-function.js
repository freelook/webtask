const request = require('request');
const as = require('async');

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => {
     request.get({
        url: context.secrets.queueFunction,
        qs: {
          token: context.secrets.token
        }
      }, (err, res, body) => {
        if(!!err) {
          return next(err);
        }
        const data = !!body ? JSON.parse(body) : null;
        return next(null, data);
      });
     }
   ], cb);
};