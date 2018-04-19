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
  if(!_.get(context, 'body._id')) {
    return cb('No _id provided.');
  }
  return as.waterfall([
   (next) => loader({
      url: `${context.secrets.queueFunction}/add/${context.body._id}`,
      qs: {token: context.secrets.token}
    }, next),
    (msg, next) => {
      if(msg && msg.payload) {
        return loader({
          method: 'patch',
          url: `${context.secrets.storeFunction}/${context.body._id}`,
          qs: {token: context.secrets.token},
          json: {
            state: 'queued'
          }
        }, () => next(null, msg));
      }
      return next(null, msg);
    }
  ], cb);
};