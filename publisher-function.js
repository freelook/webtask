const fli = require('fli-webtask');
const request = fli.request;
const as = fli.as;
const loader = fli.lib.loader;

const publisher = (context) => (params, next) => as.map(
  params.sources,
  (source, next) => loader({
    url: context.secrets[source],
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
  if(!context.body) {
    return cb('No body provided.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => publisher(context)({
     sources: storage.sources
   }, next),
  ], cb);
};