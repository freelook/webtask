const fli = require('fli-webtask');
const request = fli.npm.request;
const _ = fli.npm.lodash;
const as = fli.npm.async;
const loader = fli.lib.loader;

const publisher = (context) => (params, next) => as.map(
  params.sources,
  (source, next) => loader({
    url: context.secrets[source],
    json: context.body
  }, (response) => loader({
    method: 'patch',
    url: `${context.secrets.storeFunction}/${context.body._id}`,
    qs: {token: context.secrets.token},
    json: _.once(() => {
      var json = {};
      json[`${source}Published`] = !!response;
      return json;
    })()
  }, () => next(null, response))
  ), 
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
