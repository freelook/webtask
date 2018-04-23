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
  if(!_.get(context, 'body._id')) {
    return cb('No _id provided.');
  }
  if(!_.get(context, 'body.payload.asin')) {
    return cb('No asin provided.');
  }
  return as.waterfall([
   (next) => loader({
      url: `${context.secrets.amazonFunction}/${context.body.payload.asin}`,
      qs: {token: context.secrets.token}
    }, next),
    (info, next) => loader({
      method: 'patch',
      url: `${context.secrets.storeFunction}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: info
    }, () => next(null, info)),
    (info, next) => loader({
      method: 'put',
      url: `${context.secrets.storeFunction}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: {
        state: 'informed'
      }
    }, () => next(null, info))
  ], cb);
};