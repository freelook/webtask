const fli = require('fli-webtask');
const express = require('express');
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
  if(!(market && marketDB)) {
     const errMsgMarket = 'No market provided.';
     responseHandler(errMsgMarket, res);
     return next(errMsgMarket);
  }
  req.market = market;
  req.marketDB = marketDB;
  return next();
};
router
.all('/', function (req, res) {
  console.log('- deals');
  as.waterfall([
   (next) => loader({
      url: `${req.webtaskContext.secrets.goldboxFunction}/${req.market}`,
      qs: {
        token: req.webtaskContext.secrets.token
      }
   }, next),
   (data, next) => {
     const deals = _.get(data, 'deals', []);
     if(!!deals.length) {
       // Trigger alarm
      return loader({
        method: 'post',
        url: `${req.webtaskContext.secrets.ararmFunction}/${req.market}/trigger`,
        qs: {
          token: req.webtaskContext.secrets.token
        },
        json: {
          msg: `Alarm: No new deals for: Market - ${req.market}. DB - ${req.marketDB}. Fix me.`
        }
      }, () => next('No deals'));
     }
     return next(null, deals);
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
  ], (err, goldbox) => {
    responseHandler(err, res, goldbox);
  });
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, router);

module.exports = wt.fromExpress(app);
