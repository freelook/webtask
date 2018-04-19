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
   (storage, next) => loader({
      url: `${context.secrets.queueFunction}/get`,
      qs: {token: context.secrets.token}
    }, next),
    (msg, next) => {
      if(msg && msg.payload) {
        return loader({
          method: 'patch',
          url: `${context.secrets.storeFunction}/${msg.payload}`,
          qs: {token: context.secrets.token},
          json: {
            state: 'scheduled'
          }
        }, () => next(null, msg));
      }
      return next(null, msg);
    },
    (msg, next) => loader({
      url: `${context.secrets.queueFunction}/ack/${msg.ack}`,
      qs: {token: context.secrets.token}
    }, next)
  ], cb);
};