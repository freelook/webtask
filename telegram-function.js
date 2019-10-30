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
  var dealUrl = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  if(!dealUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.dealUrl = dealUrl;
  var db = _.get(req, 'body.db');
  var telegramPublisherUrl = req.webtaskContext.secrets[`${db}-t`];
    if(!telegramPublisherUrl) {
     const errMsgT = 'No Telegram publisher.';
     responseHandler(errMsgT, res);
     return next(errMsgT);
  }
  req.dealUrl = dealUrl;
  req.db = db;
  req.telegramPublisherUrl = telegramPublisherUrl;
  return next();
};
const recordAlarm = (req) => (name) => {
  let context = req.webtaskContext;
  // Record alarm
  return loader({
    method: 'post',
    url: `${context.secrets.alarmFunction}/${req.db}/record`,
    qs: {
      token: context.secrets.token,
      name: name
    },
  }, () => {});
};

router
.all('/publish', function (req, res) {
  const telegramPublisherUrl = (req.telegramPublisherUrl || "").replace("${method}", "sendMessage");
  const url = req.dealUrl;
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const hashTags = [''].concat(
    _.get(req, 'body.payload.info.labels', [])
    .map(h => h.replace(/[^\w\d]/mig, ''))
    .filter(h => h && h.length < 33)
    ).concat(['Amazon', 'Deal']).join(' #');
  console.log(`-- telegram published: ${promoText} ${url}`);
  as.waterfall([
   (next) => loader({
    method: 'post',
    url: telegramPublisherUrl,
    json: {
      parse_mode: 'Markdown',
      text: `${promoText}

${url}
     
[ ](${imgUrl}) ${hashTags}`
    }
   }, next)
  ],
  (err, info) => {
    if(!!err) {
      recordAlarm(req)('telegram_publish_error');
    }
    responseHandler(null, res, info);
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
