const fli = require('fli-webtask');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const moment = require('moment');
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
  var marketUrl = req.webtaskContext.secrets[market];
  var marketUrlDetails = req.webtaskContext.secrets[`${market}-details`];
  var marketTag = req.webtaskContext.secrets[`${market}-tag`];
  if(!(market && marketUrl && marketUrlDetails && marketTag)) {
     const errMsgMarket = 'No market provided.';
     responseHandler(errMsgMarket, res);
     return next(errMsgMarket);
  }
  req.marketUrl = marketUrl;
  req.marketUrlDetails = marketUrlDetails;
  req.marketTag = marketTag;
  return next();
};
const getMatch = (html, srex) => {
  return (html.match(new RegExp(srex, 'mi')) || [])[1];
}; 
const getElements = (html, el) => {
  var match = getMatch(html, `[\\s\\S]+?${el}[\\s\\S]+?\\[([\\s\\S]+?)\\][\\s\\S]+?`);
  var index = html.indexOf(match);
  if(!!match && index > 0) {
  	var nHtml = html.substring(index);
  	return JSON.parse(`[${match}]`).concat(getElements(nHtml, el));
  }
  return [];
};

router
.all('/', function (req, res) {
  as.waterfall([
    (next) => loader({
      url: req.marketUrl
    }, next),
    (html, next) => {
      var marketplaceId = getMatch(html, `[\\s\\S]+?"${'marketplaceId'}"[\\s\\S]+?"([\\s\\S]+?)"[\\s\\S]+?`);
      var deals = getElements(html, req.webtaskContext.secrets.element)
                  .slice(0, req.webtaskContext.secrets.max);
      next(null, {marketplaceId:marketplaceId, deals:deals});
    },
    (params, next) => loader({
      method: 'post',
      url: req.marketUrlDetails,
      json: ((p) => {
       return {
      	"requestMetadata": {
      		"marketplaceID": params.marketplaceId,
      		"clientID": "goldbox_mobile_pc"
      	},
      	"dealTargets": _.chain(params).get('deals', []).map((id)=>({"dealID":id})).value()
      };
      })(params)
    }, next),
    (data, next) => {
      var dealDetails = _.get(data, 'dealDetails');
      if(!dealDetails) {
        return next('No dealDetails provided.');
      }
      var deals = _.keys(dealDetails).map((k) => {
        var d = dealDetails[k];
        var link = _.get(d, 'egressUrl', '') || _.get(d, 'ingressUrl', '');
        link += !/\?/.test(link) ? '?' : '&';
        link += `tag=${req.marketTag}`;
        var title =  _.get(d, 'title', '');
        var description = _.get(d, 'description', '');
        var promoDescription = description;
        var expare = moment().add(_.get(d, 'msToEnd', 0), 'ms');
        var discount = _.get(d, 'maxPercentOff', '');
        if(title === description && !/%/.test(description) && discount) {
          promoDescription = `<table><tr><td>Save ${discount}% off on ${title}<\/td><\/tr><tr><td>Expires ${expare.format('MMM DD, YYYY')}<\/td><\/tr><\/td><\/tr><\/table>`;
        }
        return {
          promoText: title,
          promoImg: _.get(d, 'primaryImage', ''),
          promoListPrice: _.get(d, 'minCurrentPrice', ''),
          promoDealPrice: _.get(d, 'minDealPrice', ''),
          promoExpired: expare.unix(),
          promoDescription: promoDescription,
          asin: _.get(d, 'impressionAsin', '') || _.get(d, 'reviewAsin', ''),
          node: (link.match(/.+node=([\w]+)&.+/) || [])[1] || '',
          url: link,
        };
      });
      return next(null, {deals:deals, data:data});
    }
    ], (err, goldbox) => {
      responseHandler(err, res, goldbox);
  });
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, router);

module.exports = wt.fromExpress(app);