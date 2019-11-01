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
  let _id = _.get(context, 'body._id');
  if(!_id) {
    return cb('No _id provided.');
  }
  let db = _.get(context, 'body.db');
  if(!db) {
    return cb('No db provided.');
  }
  let queueName = context.secrets[db.split('-')[0] || db];
    if(!queueName) {
    return cb('No queueName provided.');
  }
  return as.waterfall([
   (next) => loader({
      method: 'post',
      url: `${context.secrets.queueFunction}/${queueName}/add`,
      json: { msg: {
        id: _id,
        db: db
      }},
      qs: {token: context.secrets.token}
    }, next),
    (msg, next) => loader({
      method: 'put',
      url: `${context.secrets.storeFunction}/${context.body.db}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: {
        state: 'queued'
      }
    }, () => next(null, msg))
  ], cb);
};