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
  console.log(`- minified`);
  if(!!_.get(context, 'body.payload.shortUrl')) {
    return cb('shortUrl already provided.');
  }
  if(!_.get(context, 'body._id')) {
    return cb('No _id provided.');
  }
  if(!_.get(context, 'body.payload.url')) {
    return cb('No url provided.');
  }
  return as.waterfall([
   (next) => loader({
      url: context.secrets.amazonFunction,
      qs: {
        token: context.secrets.token,
        url: context.body.payload.url
      }
    }, next),
    (info, next) => loader({
      method: 'patch',
      url: `${context.secrets.storeFunction}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: {shortUrl: _.get(info, 'shortUrl', '')}
    }, () => next(null, info)),
    (info, next) => loader({
      method: 'put',
      url: `${context.secrets.storeFunction}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: {
        state: 'minified'
      }
    }, () => next(null, info))
  ], cb);
};