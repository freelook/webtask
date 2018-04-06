const request = require('request');
const es = require('event-stream');
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
        url: context.secrets.rssFunction,
        qs: {
          token: context.secrets.token,
          rss: context.storage.goldbox
        }
      }, (err, res, body) => {
        if(err) {
          return next(err);
        }
        return next(null, body);
      });
     }
   ], cb);
};