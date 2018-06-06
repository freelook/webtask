const fli = require('fli-webtask');
const loader = fli.lib.loader;
const _ = fli.npm.lodash;
const as = fli.npm.async;

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  if(!context.query.endpoint) {
    return cb('No endpoint param provided.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => loader({
      url: context.secrets.rssFunction,
      qs: {
        token: context.secrets.token,
        rss: storage[context.query.endpoint]
      }
   }, next),
   (data, next) => as.mapSeries(_.get(data, 'rss', []),
    (deal, next) => {
      const link = _.get(deal, 'link', '');
      const description = _.get(deal, 'description', '');
      var item = {
       promoText: _.get(deal, 'title', ''),
       promoImg: ((description.match(/.+img src="(.+?)".+/) || [])[1] || '')
                 .replace('._SL160_.', '._SL1000_.'),
       promoListPrice: (description.match(/.+List Price: <strike>\$(.+?)<.+/) || [])[1] || '',
       promoDealPrice: (description.match(/.+Deal Price: \$(.+?)<.+/) || [])[1] || '',
       promoExpired: (description.match(/.+Expires (.+?)<.+/) || [])[1] || '',
       asin: (link.match(/.+\/dp\/([\w]+)\/.+/) || [])[1] || '',
       node: (link.match(/.+node=([\w]+)&.+/) || [])[1] || '',
       url: link.replace(context.secrets.rssTag, context.secrets.fliTag)
      };
      loader({
        method: 'post',
        url: context.secrets.storeFunction,
        qs: {
          token: context.secrets.token
        },
        json: item
      }, () => next(null, item));
    }, 
   next)
  ], cb);
};
