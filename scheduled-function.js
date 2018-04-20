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
    }, (err, msg) => ({storage:storage, msg:msg})),
    (params, next) => {
      var last = _.get(params.storage, 'data.last');
      var current = _.get(params.msg, 'payload');
      if(!current) {
        return next('No item payload provided.', params);
      }
      if(last && current && last === current) {
        return next('Item still in progress.', params);
      }
      return next(null, param);
    },
    (param, next) => loader({
        method: 'put',
        url: `${context.secrets.storeFunction}/${param.msg.payload}`,
        qs: {token: context.secrets.token},
        json: {
          state: 'scheduled'
        }
    }, () => next(null, param)),
    (param, next) => loader({
      url: `${context.secrets.queueFunction}/ack/${param.msg.ack}`,
      qs: {token: context.secrets.token}
    }, () => next(null, param))
  ], (err, result) => {
    if(!!err && +_.get(params, 'msg.tries', 0) > 10 ) {
      loader({
        url: `${context.secrets.queueFunction}/ack/${param.msg.ack}`,
        qs: {token: context.secrets.token}
      }, () => next(null, param));
    }
    return cb(null);
  });
};