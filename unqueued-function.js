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
  let _id = _.get(context, 'body._id');
  if(!_.get(context, 'body._id')) {
    return cb('No _id provided.');
  }
  let db = _.get(context, 'body.db');
  if(!db) {
    return cb('No db provided.');
  }
  let queueNameKey = db.split('-')[0];
  let queueName = context.secrets[queueNameKey];
  if(!queueName) {
    return cb('No queueName provided.');
  }
  console.log('- unqueued ', context.body._id);
  return as.waterfall([
   (next) => loader({
      url: `${context.secrets.queueFunction}/${queueName}/ack`,
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