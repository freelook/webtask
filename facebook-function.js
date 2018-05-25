const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const express = fli.npm.express;
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;
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
  if(!_.get(req, 'body.payload.shortUrl')) {
     const errMsgShortUrl = 'No shortUrl provided.';
     responseHandler(errMsgShortUrl, res);
     return next(errMsgShortUrl);
  }
  return next();
};
const responseHandler = (err, res, data) => {
  if(!!err) {
    return res.status(400).json(err);
  }
  return res.status(200).json(data);
};

router
.all('/publish', function (req, res) {
  if(!!req.body.payload.facebookPublished) {
    return responseHandler('Already published', res);
  }
  return as.waterfall([
   (next) => loader({
    method: 'post',
    url: context.secrets.facebookPublishDyno,
    qs: {token: context.secrets.token}, 
    body: {
      text: req.body.payload.shortUrl
    }
  }, next),
   (response, next) => loader({
    method: 'patch',
    url: `${context.secrets.storeFunction}/${context.body._id}`,
    qs: {token: context.secrets.token},
    json: {facebookPublished: !!response}
  }, () => next(null, response))
  ],
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
