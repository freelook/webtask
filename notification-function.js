const request = require('request');
const as = require('async');

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

const notifier = (context) => (params, next) => as.map(
  params.sources,
  (source, next) => loader({
    method: 'post',
    url: context.secrets[source],
    json: context.body
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
  if(!context.query.topic) {
    return cb('No topic provided.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => notifier(context)({
     sources: storage[context.query.topic] || []
   }, next)
  ], cb);
};