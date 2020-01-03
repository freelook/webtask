const fli = require('fli-webtask');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;
const responseHandler = fli.lib.responseHandler;
const operationHelper = require('apac').OperationHelper;
const Paapi = require('amazon-pa-api50');
const PaapiConfig = require('amazon-pa-api50/lib/config');
const PaapiOptions = require('amazon-pa-api50/lib/options');
const app = express();
const router = express.Router();
const routerPaapi = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  const market = _.get(req, 'params.market');
  if(!market) {
     const errMsgMarket = 'No market name provided.';
     responseHandler(errMsgMarket, res);
     return next(errMsgMarket);
  }
  req.market = _.upperCase(market);
  return next();
};
const apacMiddleware = (req, res, next) => {
  req.oph = new operationHelper({
      awsId: req.webtaskContext.secrets.awsId,
      awsSecret: req.webtaskContext.secrets.awsSecret,
      assocId: req.webtaskContext.secrets.assocId,
      locale: req.market
  });
  next();
};
const paapiMiddleware = (req, res, next) => {
  let resourceList = null;
  let countryName = {
    'US': 'UnitedStates',
    'DE': 'Germany',
    'UK': 'UnitedKingdom'
  }[req.market];
  let country = _.get(PaapiOptions.Country, countryName);
  if(!country) {
    const errMsgCountry = 'Country not supported or empty.';
    responseHandler(errMsgCountry, res);
    return next(errMsgCountry);
  }
  let paapiConfig = new PaapiConfig(resourceList, country);
  paapiConfig.accessKey = req.webtaskContext.secrets.awsId;
  paapiConfig.secretKey = req.webtaskContext.secrets.awsSecret;
  paapiConfig.partnerTag = req.webtaskContext.secrets.assocId;
  req.paapi = new Paapi(paapiConfig);
  return next();
};
const jsonMapper = (asin) => (info, next) => {
  var item = _.get(info, 'result.ItemLookupResponse.Items.Item');
  if(!item || item.ASIN !== asin) {
    return next(null, {});
  }
  var title = _.get(item, 'ItemAttributes.Title');
  var content = _.get(item, 'EditorialReviews.EditorialReview.Content') || 
                _.chain(item).get('ItemAttributes.Feature', '').concat([]).join('; ').value();
  var image = _.get(item, 'LargeImage.URL') ||
              _.get(item, 'MediumImage.URL');
  var price = _.get(item, 'ItemAttributes.ListPrice.FormattedPrice') ||
              _.get(item, 'OfferSummary.LowestNewPrice.FormattedPrice');
  var labels = [];
  (function fetchNodeName(node) {
    if(_.isArray(node)) {
      return _.map(node, (n) => fetchNodeName(n));
    }
    var nodeName = _.get(node, 'Name');
    var nodeAncestor = _.get(node, 'Ancestors.BrowseNode');
    if(nodeName) {
      labels.push(nodeName);
    }
    if(nodeAncestor) {
      fetchNodeName(nodeAncestor);
    }
  })(_.get(item, 'BrowseNodes.BrowseNode'));
  if(!title || !content || !image || !price) {
    return next('No content.');
  }
  return next(null, {
    title: title,
    content: content,
    image: image,
    price: price,
    labels: _.uniq(labels)
  });
};

router
.get('/lookup/:asin', function (req, res) {
  const asin = _.get(req, 'params.asin');
  if(!asin) {
    return responseHandler('No asin provided.', res);
  }
  as.parallel([
    (next) => {
      const enpoint = req.webtaskContext.secrets[req.market];
      if(!enpoint) {
        return next('No market endpoint');
      }
      return loader({
        method: 'post',
        url: req.webtaskContext.secrets.scrapeItFunction,
        qs: {
          token: req.webtaskContext.secrets.token
        },
        json: {
          endpoint: `${enpoint}/dp/${asin}`,
          config: {
            keywords: {
              selector: 'meta[name="keywords"]',
              attr: 'content'
            }
          }
        }
      }, next);
    },
    (next) => {
      req.oph.execute('ItemLookup', {
        'ItemId': asin,
        'ResponseGroup': 'Large'
      })
      .then((info) => jsonMapper(asin)(info, next))
      .catch((err) => next(err));
    }
  ],
  (err, result) => {
    const keywords = _.get(result, '[0].keywords', '');
    const info = _.get(result, '[1]', {});
    info.labels = _.concat(
      _.get(info, 'labels', []), 
      _.chain(keywords).split(',').compact().map(_.trim).value()
    );
    responseHandler(null, res, info);
  });
})
.get('/browsenodelookup/:node', function (req, res) {
  as.waterfall([
    (next) => {
      var node = _.get(req, 'params.node');
      if(!node) {
        return next('No node provided.');
      }
      req.oph.execute('BrowseNodeLookup', {
        'BrowseNodeId': node,
        'ResponseGroup': 'BrowseNodeInfo'
      })
      .then((info) => {
        next(null, {
          info: info
        });
      })
      .catch((err) => next(err));
    }
  ],
  (err, info) => responseHandler(err, res, info));
})
.get('/minify', function (req, res) {
  as.waterfall([
   (next) => {
    if(!req.query.url) {
      return next('No url provided.');
    }
    return fli.npm.request({
      auth: {
        bearer: req.webtaskContext.secrets.minifyToken
      },
      url: req.webtaskContext.secrets.minifyFunction,
      method: 'post',
      json: {
        long_url: req.query.url
      }
    }, (err, shortRes, shortBody) => next(err, shortBody));
   },
   (shortBody, next) => {
     return next(null, {
       isOk: true,
       longUrl: _.get(shortBody, 'long_url', ''),
       shortUrl: _.get(shortBody, 'link', '')
     });
   }
  ],
  (err, info) => responseHandler(err, res, info));
});

routerPaapi
.post('/v5/:method', async function (req, res) {
  /** https://github.com/arifulhb/amazon-pa-api50#usage
   *  https://webservices.amazon.com/paapi5/documentation/operations.html
   *  Methods: getItems, getBrowseNodes, getVariations, searchItems
   **/
  let error, data;
  let requestConfig = _.merge(
    {
      PartnerTag: req.paapi.props.partnerTag,
      PartnerType: req.paapi.props.partnerType,
      //Resources: req.paapi.props.resourceParameters
    },
    _.get(req, 'body', {})
  );
  try {
    /* global Promise */
    data = await new Promise((resolve, reject) => {
      req.paapi._api[req.params.method](requestConfig, (e, d) => {
        if(!!e) {
        return reject(e);
        }
        return resolve(d);
      });
    });
  } catch(e) {
    error = { error: _.toString(e) };
  } finally {
    responseHandler(error, res, data);
  }
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, apacMiddleware, router)
.use('/:market/paapi', validateMiddleware, paapiMiddleware, routerPaapi);

module.exports = wt.fromExpress(app);
