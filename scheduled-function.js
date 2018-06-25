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
  if(!!context.query.reset) {
    return as.waterfall([
      (next) => context.storage.get(next),
      (storage) => context.storage.set({last: {}})
    ], cb);
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => loader({
      url: `${context.secrets.queueFunction}/get`,
      qs: {token: context.secrets.token}
    }, (err, msg) => next(null, {storage:storage, msg:msg})),
    (params, next) => {
      var last = _.get(params.storage, 'last');
      var current = _.get(params.msg, 'payload');
      if(!current) {
        return next('No item payload provided.', params);
      }
      if(last && current && _.isEqual(last, current)) {
        return next('Item still in progress.', params);
      }
      params.storage.last = current;
      return next(null, params);
    },
    (params, next) => context.storage.set(params.storage, () => next(null, params)),
    (params, next) => loader({
        method: 'put',
        url: `${context.secrets.storeFunction}/${params.msg.payload.db}/${params.msg.payload.id}`,
        qs: {token: context.secrets.token},
        json: {
          state: 'scheduled'
        }
    }, () => next(null, params))
  ], (err, params) => {
    return cb(null, {err: err, params: params});
  });
};