const fli = require('fli-webtask');
const request = fli.npm.request;
const _ = fli.npm.lodash;
const as = fli.npm.async;
const loader = fli.lib.loader; 

const publisher = (context) => (params, next) => {
  params.sources.map((source, index) => {
    console.log(`-- published ${source._id}`);
    source.db = context.query.db;
    source.index = index;
    source.payload.promoText = `[BEST DEAL] ${source.payload.promoText}`;
    return loader({
      method: 'post',
      url: context.secrets.redditFunction,
      qs: {token: context.secrets.token},
      json: source
    }, () => {});
  });
  next();
};

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  if(!_.get(context, 'query.market')) {
    return cb('No market provided.');
  }
  if(!_.get(context, 'query.db')) {
    return cb('No db provided.');
  }
  return as.waterfall([
   (next) => loader({
      url: `${context.secrets.dealsFunction}/${context.query.market}/today`,
      qs: {
        token: context.secrets.token,
      }
    }, next),
   (deals, next) => publisher(context)({
     sources: (deals || []).filter(d => d && d.payload && d.payload.promoType === 'BEST_DEAL')
   }, () => next()),
  ], cb);
};
