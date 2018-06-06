const fli = require('fli-webtask');
const as = fli.npm.async;
const loader = fli.lib.loader;

const notifier = (context) => (params, next) => as.map(
  params.sources,
  (source, next) => loader({
    method: 'post',
    url: context.secrets[source],
    qs: {token: context.secrets.token},
    json: context.body
  }, next), 
  next
);

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  if(!context.query.topic) {
    return cb('No topic provided.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => notifier(context)({
     sources: storage[context.query.topic] || []
   }, next)
  ], cb);
};