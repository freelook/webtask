const fli = require('fli-webtask');
const request = fli.npm.request;
const _ = fli.npm.lodash;
const as = fli.npm.async;
const loader = fli.lib.loader; 

const publisher = (context) => (params, next) => as.map(
  params.sources,
  (source, next) => {
    if(!!_.get(context, `body.payload.${source}Published`)) {
      return next(null, `${source} already published`);
    }
    console.log(`-- published ${source}`);
    loader({
      method: 'post',
      url: context.secrets[source],
      qs: {token: context.secrets.token},
      json: context.body
    }, () => loader({
      method: 'patch',
      url: `${context.secrets.storeFunction}/${context.body.db}/${context.body._id}`,
      qs: {token: context.secrets.token},
      json: _.once(() => {
        var json = {};
        json[`${source}Published`] = true;
        return json;
      })()
    }, () => {}));
    return next();
  },
  () => next()
);

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  if(!_.get(context, 'body')) {
    return cb('No body provided.');
  }
  if(!_.get(context, 'body._id')) {
    return cb('No _id provided.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => publisher(context)({
     sources: storage.sources
   }, () => next()),
  ], cb);
};
