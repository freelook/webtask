const fli = require('fli-webtask');
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
  console.log('- unqueued ', context.body._id);
  return as.waterfall([
   (next) => loader({
      url: `${context.secrets.queueFunction}/ack`,
      qs: {token: context.secrets.token}
    }, (err, msg) => next(null, err || msg)),
    (msg, next) => loader({
      method: 'put',
      url: `${context.secrets.storeFunction}/${context.body.db}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: {
        state: 'unqueued'
      }
    }, () => next(null, msg))
  ], cb);
};