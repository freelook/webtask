const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const snoowrap = require('snoowrap');
const btoa = require('btoa');
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
  var rUrl = _.get(req, 'body.payload.url');
  if(!rUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.rUrl = rUrl;
  return next();
};
const redditMiddleware = (req, res, next) => {
  var db = _.get(req, 'body.db');
  var index = _.get(req, 'body.index');
  var userAgent = req.webtaskContext.secrets[`${db}-userAgent`];
  var clientId = req.webtaskContext.secrets[`${db}-clientId`];
  var clientSecret = req.webtaskContext.secrets[`${db}-clientSecret`];
  var refreshToken = index !== undefined ? 
    req.webtaskContext.secrets[`${db}-${index}-refreshToken`] : 
    req.webtaskContext.secrets[`${db}-refreshToken`];
  var subreddit = req.webtaskContext.secrets[`${db}-subreddit`];
  if(!(userAgent && clientId && clientSecret && refreshToken && subreddit)) {
     const errMsgReddit = 'No reddit publisher.';
     responseHandler(errMsgReddit, res);
     return next(errMsgReddit);
  }
  req.reddit = new snoowrap({
    userAgent: userAgent,
    clientId: clientId,
    clientSecret: clientSecret,
    refreshToken: refreshToken
  });
  req.subreddit = subreddit;
  next();
};

router
.all('/publish', function (req, res) {
  let url = req.rUrl;
  let promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  let promoDiscount = _.get(req, 'body.payload.promoDiscount');
  if(promoDiscount) {
    promoText = `[${promoDiscount}% off] ${promoText}`;
  }
  console.log(`-- reddit published: ${promoText} ${url}`);
  as.waterfall([
   (next) => {
    req.reddit
    .getSubreddit(req.subreddit)
    .submitLink({
      title: promoText,
      url: req.webtaskContext.secrets.prefix + btoa(url).replace(/\//mig, '+') + '?r=1'
    })
    .then((data) => {
      next(null, data);
    })
    .catch((err) => {
      next(err);
    });
   }
  ],
  (err, info) => responseHandler(null, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, redditMiddleware, router);

module.exports = wt.fromExpress(app);
