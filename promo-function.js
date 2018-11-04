const fli = require('fli-webtask');
const express = require('express');
const moment = require('moment');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;
const responseHandler = fli.lib.responseHandler;
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  var market = _.get(req, 'params.market', '').toUpperCase();
  var marketDB = req.webtaskContext.secrets[`${market}-db`];
  var marketTag = req.webtaskContext.secrets[`${market}-tag`];
  if(!(market && marketDB && marketTag)) {
     const errMsgMarket = 'No market provided.';
     responseHandler(errMsgMarket, res);
     return next(errMsgMarket);
  }
  req.market = market;
  req.marketDB = marketDB;
  req.marketTag = marketTag;
  return next();
};
router
.all('/', function (req, res) {
  console.log('- promo');
  as.waterfall([
   (next) => fli.npm.request({
      gzip: true,
      headers: {
        'Accept-Charset': 'utf-8',
        'Accept-Encoding': 'gzip',
      },
      encoding: 'utf8',
      url: `${req.webtaskContext.secrets.promoFunction}`
   }, (err, response, data) => next(null, err || data)),
   (data, next) => {
     let promos;
     try {
       promos = _.get(JSON.parse(data), req.webtaskContext.secrets.promo, []);
     } catch (e) {
       promos = [];
     }
     return next(promos);
     if(!promos.length) {
      return next('No promo');
     }
     return next(null, promos.map((p) => {
       let title = _.get(p, 'title', 'prize');
       let image = _.get(p, 'priceImageUrl', '');
       let expare = moment().add(req.webtaskContext.secrets.expire, 'ms');
       let discount = _.get(p, 'promotionPercentOff', '');
       let promoText = `${req.webtaskContext.secrets.promoText}: ${title}`;
       let promoDescription = '';
       if(!!discount) {
         promoDescription = `<table><tr><td>${req.webtaskContext.secrets.promoText} and Save ${discount}% off on ${title}<\/td><\/tr><tr><td>Expires ${expare.format('MMM DD, YYYY')}<\/td><\/tr><\/td><\/tr><\/table>`
       } else {
         promoDescription = `<table><tr><td>${req.webtaskContext.secrets.promoText}: ${title}<\/td><\/tr><tr><td>Expires ${expare.format('MMM DD, YYYY')}<\/td><\/tr><\/td><\/tr><\/table>`
       }
       return {
        promoText: promoText,
        promoImg: image,
        promoExpired: expare.unix(),
        promoDescription: promoDescription,
        url: [
          req.webtaskContext.secrets.link,
         _.get(p, 'id', ''), 
         `?tag=${req.marketTag}`
        ].join(''),
        info: {
          title: title,
          image: image,
          labels: _.chain(req.webtaskContext.secrets).get('labels', '').split(',').compact().value()
        }
       };
     }));
   },
   (deals, next) => as.mapSeries(deals,
   (deal, next) => {
      if(deal && deal.url && deal.promoText) {
        loader({
          method: 'post',
          url: req.marketDB,
          qs: {
            token: req.webtaskContext.secrets.token
          },
          json: deal
        }, () => {});
      }
      return next(null, deal);
   }, next)
  ], (err, promo) => {
    responseHandler(err, res, promo);
  });
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, router);

module.exports = wt.fromExpress(app);
