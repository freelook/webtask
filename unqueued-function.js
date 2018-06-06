const request = require('request');
const as = require('async');
const _ = require('lodash');
const loader = require('fli-webtask').lib.loader;

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
    }, next),
    (msg, next) => loader({
      method: 'put',
      url: `${context.secrets.storeFunction}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: {
        state: 'unqueued'
      }
    }, () => next(null, msg))
  ], cb);
};