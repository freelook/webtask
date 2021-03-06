const fli = require('fli-webtask');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const moment = require('moment');
const RE2 = require('re2');
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
  return (html && html.match(new RE2(srex, 'mi')) || [])[1];
}; 
const getElements = (html, el, limit, _result) => {
  var result = _result || [];
  var match = getMatch(html, `[\\s\\S]+?${el}[\\s\\S]+?\\[([\\s\\S]+?)\\][\\s\\S]+?`);
  var index = html.indexOf(el);
  if(!!match && index > 0 && limit > result.length) {
  	var nHtml = html.substring(index + 1);
    try {
  	  result = getElements(nHtml, el, limit, result.concat(JSON.parse(`[${match}]`)));
    } catch(e) { console.log(e); }
  }
  return result;
};

router
.all('/', function (req, res) {
  as.waterfall([
   (next) => fli.npm.request({
      url: req.marketUrl,
      followRedirect: true,
      gzip: true,
      headers: {
        'Accept-Charset': 'utf-8',
        'Accept-Encoding': 'gzip',
      },
      encoding: 'utf8'
    },
    (err, response, body) => {
      next(err, body);
    }),
    (html, next) => {
      var marketplaceId, deals; 
      let limit = req.query.max || req.webtaskContext.secrets.max;
      try {
        marketplaceId = getMatch(html, `[\\s\\S]+?${'ue_mid'}[\\s\\S]+?['|"]([\\s\\S]+?)['|"][\\s\\S]+?`);
        deals = getElements(html, req.webtaskContext.secrets.element, limit).slice(0, limit);
      } catch(e){ console.log(e); }
      next(null, {marketplaceId:marketplaceId, deals:deals});
    },
    (params, next) => fli.npm.request({
      method: 'post',
      gzip: true,
      url: req.marketUrlDetails,
      headers: {
        'Accept-Charset': 'utf-8',
        'Accept-Encoding': 'gzip',
      },
      encoding: 'utf8',
      json: ((p) => {
       return {
      	"requestMetadata": {
      		"marketplaceID": params.marketplaceId,
      		"clientID": "goldbox_mobile_pc"
      	},
      	"dealTargets": _.chain(params).get('deals', []).map((id)=>({"dealID":id})).value()
      };
      })(params)
    }, (err, response, body) => next(err, body)),
    (data, next) => {
      var dealDetails = _.get(data, 'dealDetails');
      if(!dealDetails) {
        return next(data, 'No dealDetails provided.');
      }
      var deals = _.keys(dealDetails).map((k) => {
        var d = dealDetails[k];
        var link = _.get(d, 'egressUrl', '') || _.get(d, 'ingressUrl', '');
        link += !/\?/.test(link) ? '?' : '&';
        link += `tag=${req.marketTag}`;
        var promoImg = _.get(d, 'primaryImage', '');
        var title =  _.get(d, 'title', '');
        var description = _.get(d, 'description', '');
        var promoDescription = description;
        var expare = moment().add(_.get(d, 'msToEnd', 0), 'ms');
        var discount = _.get(d, 'maxPercentOff', _.get(d, 'minPercentOff', ''));
        if(title === description && !/%/.test(description) && discount) {
          promoDescription = `<table><tr><td>Save ${discount}% off on ${title}<\/td><\/tr><tr><td>Expires ${expare.format('MMM DD, YYYY')}<\/td><\/tr><\/td><\/tr><\/table>`;
        }
        return {
          promoText: title,
          promoImg: promoImg,
          promoDiscount: discount,
          promoListPrice: _.get(d, 'minCurrentPrice', ''),
          promoDealPrice: _.get(d, 'minDealPrice', ''),
          promoType: _.get(d, 'type', ''),
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