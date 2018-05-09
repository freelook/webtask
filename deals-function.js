
const fli = require('fli-webtask');
const request = fli.request;
const es = fli.es;
const as = fli.as;

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  if(!context.query.endpoint) {
    return cb('No endpoint param provided.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => {
     request.get({
        url: context.secrets.rssFunction,
        qs: {
          token: context.secrets.token,
          rss: storage[context.query.endpoint]
        }
      }, (err, res, body) => {
        if(err) {
          return next(err);
        }
        const deals = JSON.parse(body);
        
        return next(null, deals);
      });
     }
   ], cb);
};