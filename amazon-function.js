const request = require('request');
const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const as = require('async');
const _ = require('lodash');
const operationHelper = require('apac').OperationHelper;
const app = express();
const router = express.Router();
const loader = (params, next) => {
  request({
    method: (params.method || 'get').toUpperCase(),
    url: params.url,
    qs: params.qs,
    json: params.json
  }, (err, res, body) => {
    if(!!err || res.statusCode !== 200 || !body) {
      return next(err || body || 'No body.');
    }
    var msg = body;
    try {msg = typeof body === 'string' ? JSON.parse(body) : body;} catch(e) {}
    return next(null, msg);
  });
};
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  if(!_.get(req, 'body._id')) {
    const errMsgId = 'No _id provided.';
    res.status(400).send(errMsgId);
    return next(errMsgId);
  }
  if(!_.get(req, 'params.market')) {
     const errMsgMarket = 'No market name provided.';
     res.status(400).send(errMsgQQ);
     return next(errMsgQQ);
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
  if(!title || !content || !image || !price) {
    return next('No content.');
  }
  return next(null, { info: {
    title: title,
    content: content,
    image: image,
    price: price
  }});
};

router
.get('/lookup/:asin?', function (req, res) {
  as.waterfall([
    (next) => {
      var asin = _.get(req, 'body.payload.asin') || _.get(req, 'params.asin');
      if(!asin) {
        return next('No asin provided.');
      }
      req.oph.execute('ItemLookup', {
        'ItemId': req.params.asin,
        'ResponseGroup': 'Large'
      })
      .then((info) => jsonMapper(asin)(info, next))
      .catch((err) => next(err));
    },
    (info, next) => loader({
      method: 'patch',
      url: `${req.webtaskContext.secrets.storeFunction}/${req.body._id}`,
      qs: {token: req.webtaskContext.secrets.token},
      json: info
    }, () => next(null, info)),
    (info, next) => loader({
      method: 'put',
      url: `${req.webtaskContext.secrets.storeFunction}/${req.body._id}`,
      qs: {token: req.webtaskContext.secrets.token},
      json: {
        state: 'informed'
      }
    }, () => next(null, info))
  ],
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, apacMiddleware, router);

module.exports = wt.fromExpress(app);
