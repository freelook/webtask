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
  req.reddit = new snoowrap({
    userAgent: req.webtaskContext.secrets.userAgent,
    clientId: req.webtaskContext.secrets.clientId,
    clientSecret: req.webtaskContext.secrets.clientSecret,
    refreshToken: req.webtaskContext.secrets.refreshToken
  });
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
    .getSubreddit(req.webtaskContext.secrets.subreddit)
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
