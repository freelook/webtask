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
  if(!(_.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url'))) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  var db = _.get(req, 'body.db');
  var facebookPublisherUrl = req.webtaskContext.secrets[`${db}-fb-dyno`];
    if(!facebookPublisherUrl) {
     const errMsgFb = 'No FB publisher.';
     responseHandler(errMsgFb, res);
     return next(errMsgFb);
  }
  req.facebookPublisherUrl = facebookPublisherUrl;
  return next();
};

router
.all('/publish', function (req, res) {
  const url = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  console.log(`-- facebook published: ${req.body.payload.promoText} ${url}`);
  as.waterfall([
   (next) => loader({
    method: 'post',
    url: req.facebookPublisherUrl,
    qs: {token: req.webtaskContext.secrets.token}, 
    json: {
      text: `${req.body.payload.promoText} ${url}`
    }
   }, next)
  ],
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
