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
  var facebookPublisherUrl = req.webtaskContext.secrets[`${db}-fb`];
    if(!facebookPublisherUrl) {
     const errMsgFb = 'No FB publisher.';
     responseHandler(errMsgFb, res);
     return next(errMsgFb);
  }
  req.fUrl = fUrl;
  req.db = db;
  req.facebookPublisherUrl = facebookPublisherUrl;
  return next();
};
const refreshToken = (req, storage, cb) => {
  let context = req.webtaskContext;
  let refreshToken = _.get(storage,`${req.db}.access_token`);
  as.waterfall([
    (next) => request.get({
      url: `${context.secrets['fb-refresh-token-url']}${refreshToken}`,
    }, (err, httpResponse, body) => next(null, JSON.parse(body))),
    (data, next) => {
      var token = {
        access_token: _.get(data, 'access_token', refreshToken),
        expire: Date.now() + 1000 * (_.get(data, 'expires_in', 0) - 60)
      };
      storage[req.db] = token;
      context.storage.set(storage, () => next(null, token.access_token));
    }
  ], cb);
};
const getToken = (req, cb) => {
  let context = req.webtaskContext;
  as.waterfall([
    (next) => context.storage.get(next),
    (storage, next) => {
      if (Date.now() < _.get(storage, `${req.db}.expire`, 0)) {
         return next(null, _.get(storage, `${req.db}.access_token`));
      }
      return refreshToken(req, storage, next);
    }
  ], (err, access_token) => {
    if(!!err) {
      return cb(err);
    }
    return cb(null, access_token); 
  });
};

router
.all('/publish', function (req, res) {
  const url = req.fUrl;
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const hashTags = [''].concat(
    _.get(req, 'body.payload.info.labels', [])
    .map(h => h.replace(/[^\w\d]/mig, ''))
    .filter(h => h && h.length < 33)
    ).concat(['Amazon', 'Deal']).join(' #');
  console.log(`-- facebook published: ${promoText} ${url}`);
  as.waterfall([
   (next) => getToken(req, next),
   (access_token, next) => loader({
    method: 'post',
    url: req.facebookPublisherUrl,
    qs: {
      message: `${url} 
       
      ${promoText} 
      
      ${hashTags}`,
      link: imgUrl,
      access_token: access_token
    },
   }, next)
  ],
  (err, info) => {
    responseHandler(err, res, info);
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
