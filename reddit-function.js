const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const snoowrap = require('snoowrap');
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
  return next();
};
const redditMiddleware = (req, res, next) => {
  var db = _.get(req, 'body.db');
  var userAgent = req.webtaskContext.secrets[`${db}-userAgent`];
  var clientId = req.webtaskContext.secrets[`${db}-clientId`];
  var clientSecret = req.webtaskContext.secrets[`${db}-clientSecret`];
  var refreshToken = req.webtaskContext.secrets[`${db}-refreshToken`];
  var subreddit = req.webtaskContext.secrets[`${db}-subreddit`];
  if(!(userAgent || clientId || clientSecret || refreshToken || subreddit)) {
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
  const url = _.get(req, 'body.payload.url');
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  console.log(`-- reddit published: ${promoText} ${url}`);
  as.waterfall([
   (next) => {
    req.reddit
    .getSubreddit(req.subreddit)
    .submitLink({
      title: promoText,
      url: url
    })
    .then((data) => {
      next(null, data);
    })
    .catch((err) => {
      next(err);
    });
   }
  ],
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, redditMiddleware, router);

module.exports = wt.fromExpress(app);
