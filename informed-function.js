const fli = require('fli-webtask');
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;

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
      json: {info: info}
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