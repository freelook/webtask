const request = require('request');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const as = require('async');
const _ = require('lodash');
const operationHelper = require('apac').OperationHelper;
const app = express();
const router = express.Router();
const loader = require('fli-webtask').lib.loader;
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  if(!_.get(req, 'params.market')) {
     const errMsgMarket = 'No market name provided.';
     res.status(400).send(errMsgMarket);
     return next(errMsgMarket);
  }
  return next();
};
const apacMiddleware = (req, res, next) => {
  req.oph = new operationHelper({
      awsId: req.webtaskContext.secrets.awsId,
      awsSecret: req.webtaskContext.secrets.awsSecret,
      assocId: req.webtaskContext.secrets.assocId,
      locale: req.params.market.toUpperCase()
  });
  next();
};
const responseHandler = (err, res, data) => {
  if(!!err) {
    return res.status(400).json(err);
  }
  return res.status(200).json(data);
};
const jsonMapper = (asin) => (info , next) => {
  var item = _.get(info, 'result.ItemLookupResponse.Items.Item');
  if(!item || item.ASIN !== asin) {
    return next('Incorrect info.');
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
    var nodeName = _.get(node, 'Name');
    var nodeAncestor = _.get(node, 'Ancestors.BrowseNode');
    nodeName && labels.push(nodeName);
    nodeAncestor && fetchNodeName(nodeAncestor);
  })(_.get(item, 'BrowseNodes.BrowseNode'));
  if(!title || !content || !image || !price) {
    return next('No content.');
  }
  return next(null, {
    title: title,
    content: content,
    image: image,
    price: price,
    labels: labels
  });
};

router
.get('/lookup/:asin', function (req, res) {
  as.waterfall([
    (next) => {
      var asin = _.get(req, 'params.asin');
      if(!asin) {
        return next('No asin provided.');
      }
      req.oph.execute('ItemLookup', {
        'ItemId': req.params.asin,
        'ResponseGroup': 'Large'
      })
      .then((info) => jsonMapper(asin)(info, next))
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
    return loader({
      url: req.webtaskContext.secrets.minifyFunction,
      qs: {longUrl: req.query.url}
    }, next);
   }
  ],
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, apacMiddleware, router);

module.exports = wt.fromExpress(app);
