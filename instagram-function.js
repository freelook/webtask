const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const express = fli.npm.express;
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
  if(!_.get(req, 'body._id')) {
     const errMsgId = 'No _id provided.';
     responseHandler(errMsgId, res);
     return next(errMsgId);
  }
  var fUrl = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  if(!fUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.fUrl = fUrl;
  var db = _.get(req, 'body.db');
  var fbInstaPublisherUrl = req.webtaskContext.secrets[`${db}-insta`];
  var fbInstaPublisherTags = req.webtaskContext.secrets[`${db}-tags`] || '';
    if(!fbInstaPublisherUrl) {
     const errMsgFb = 'No FB instagram publisher.';
     responseHandler(errMsgFb, res);
     return next(errMsgFb);
  }
  req.fUrl = fUrl;
  req.db = db;
  req.fbInstaPublisherUrl = fbInstaPublisherUrl;
  req.fbInstaPublisherTags = fbInstaPublisherTags;
  return next();
};

router
.all('/publish', function (req, res) {
  const url = req.fUrl;
  const promoType = _.get(req, 'body.payload.promoType');
  const asin = _.get(req, 'body.payload.asin');
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const hashTags = [''].concat(
    _.get(req, 'body.payload.info.labels', [])
    .map(h => h.replace(/[^\w\dА-ЯҐЄІЇ]/mig, ''))
    .filter(h => h && h.length < 33)
    )
    .concat(req.fbInstaPublisherTags.split(',')).join(' #').trim();
  console.log(`-- facebook instagram published: ${promoText} ${url}`);
  as.waterfall([
   (next) => loader({
    method: 'post',
    url: `${req.fbInstaPublisherUrl}/media`,
    qs: {
      caption: `${promoText} 

      Dealcode: ${asin} on deals.freelook.info

      ${hashTags}`,
      image_url: imgUrl,
      access_token: req.webtaskContext.secrets.access_token
    }
   }, next),
   (result, next) => loader({
      method: 'post',
      url: `${req.fbInstaPublisherUrl}/media_publish?creation_id=${result.id}`,
      qs: {
        access_token: req.webtaskContext.secrets.access_token
      }
  }, next)
  ],
  (err, info) => {
    responseHandler(null, res, info || err);
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
