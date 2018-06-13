const fli = require('fli-webtask');
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;
const informed = (context, next) => loader({
  method: 'put',
  url: `${context.secrets.storeFunction}/${context.body._id}`,
  qs: {token: context.secrets.token},
  json: {
    state: 'informed'
  }
}, next);

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  console.log(`- informed`);
  if(!_.get(context, 'body._id')) {
    return cb('No _id provided.');
  }
  if(!_.chain(context).get('body.payload.info').isEmpty().value()) {
    return informed(context, () => cb('Info already provided.'));
  }
  var asin = context.body.payload.asin;
  console.log(`-- asin: ${asin}`);
  if(!!asin) {
    return as.waterfall([
      (next) => loader({
        url: `${context.secrets.amazonFunction}/${context.body.payload.asin}`,
        qs: {token: context.secrets.token}
      }, (err, info) => next(null, err || info)),
      (info, next) => loader({
        method: 'patch',
        url: `${context.secrets.storeFunction}/${context.body._id}`,
        qs: {token: context.secrets.token},
        json: {info: info}
      }, () => next(null, info)),
      (info, next) => informed(context, () => next(null, info))
    ], cb);
  }
  return as.waterfall([
    (next) => informed(context, () => next())
  ], cb);
};