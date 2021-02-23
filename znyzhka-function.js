const axios = require('axios');
const _ = require('lodash');
const fli = require('fli-webtask');
const loader = fli.lib.loader;

/**
* @param context {WebtaskContext}
*/
module.exports = async function(context, cb) {
  try {
    if(context.secrets.token !== context.query.token) {
      throw 'No token.';
    }
    const page = context.query.page || 1;
    const response = await axios.get(`${context.secrets.catalog}${page}`);
    const deals = _.get(response, 'data.data.data', []).map((offer) => {
      return {
          promoText: offer.title,
          promoImg: offer.image,
          promoType: 'Знижка',
          promoStart: offer.period_start,
          promoExpired: offer.period_end,
          promoDescription: offer.description,
          slug: offer.slug,
          url: _.trim(`${context.secrets.link}${offer.slug}`),
          notification: 'minified',
          info: {
            labels: ['Знижка', 'Акція']
          }
        };
    });
    if(context.query.publish) {
      deals.map((deal) => {
        if(deal && deal.url && deal.promoText) {
          loader({
            method: 'post',
            url: context.secrets.storeFunction,
            qs: {
              token: context.secrets.token
            },
            json: deal
          }, () => {});
        }
        return deal;
      });
    }
    cb(null, deals);
  }
  catch(e) {
    cb(null, _.toString(e));
  }
};