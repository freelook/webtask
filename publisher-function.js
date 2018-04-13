const request = require('request');
const as = require('async');

const poster = (params, next) => {
  request.post({
    url: params.url,
    qs: params.qs,
    body: params.body
  }, (err, res, body) => {
    if(!!err || res.statusCode !== 200 || !body) {
      return next(err || body || 'No body.');
    }
    const msg = JSON.parse(body);
    return next(null, msg);
  });
};

const publisher = (context) => (params, next) => as.map(
  params.sources,
  (source, next) => poster({
    url: context.secrets[source],
    body: params.body
  }, next), 
  next
);

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
     next();
   },
  ], cb);
};