const request = require('request');
const as = require('async');
const _ = require('lodash');

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
    var msg = body;
    try {msg = typeof body === 'string' ? JSON.parse(body) : body;} catch(e) {}
    return next(null, msg);
  });
};

const ack = (context) => (params, next) => loader({
    url: `${context.secrets.queueFunction}/ack/${params.msg.ack}`,
    qs: {token: context.secrets.token}
}, next);

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
      url: `${context.secrets.queueFunction}/get`,
      qs: {token: context.secrets.token}
    }, (err, msg) => next(null, {storage:storage, msg:msg})),
    (params, next) => {
      var last = _.get(params.storage, 'last');
      var current = _.get(params.msg, 'payload');
      if(!current) {
        return next('No item payload provided.', params);
      }
      if(last && current && last === current) {
        return next('Item still in progress.', params);
      }
      params.storage.last = current;
      return next(null, params);
    },
    (params, next) => context.storage.set(params.storage, () => next(null, params)),
    (params, next) => loader({
        method: 'put',
        url: `${context.secrets.storeFunction}/${params.msg.payload}`,
        qs: {token: context.secrets.token},
        json: {
          state: 'scheduled'
        }
    }, () => next(null, params))
  ], (err, params) => {
    return cb(null, {err: err, params: params});
  });
};