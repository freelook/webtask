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
  var lUrl = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  if(!lUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.lUrl = lUrl;
  var db = _.get(req, 'body.db');
  var linkedinPublisherUrl = req.webtaskContext.secrets[`${db}-ln-url`];
  var linkedinPublisherId = req.webtaskContext.secrets[`${db}-ln-id`];
  var linkedinPublisherToken = req.webtaskContext.secrets[`${db}-ln-token`];
  if(!linkedinPublisherUrl || !linkedinPublisherId || !linkedinPublisherToken) {
     const errMsgFb = 'No LinkedIn publisher.';
     responseHandler(errMsgFb, res);
     return next(errMsgFb);
  }
  req.linkedinPublisherUrl = linkedinPublisherUrl;
  req.linkedinPublisherId = linkedinPublisherId;
  req.linkedinPublisherToken = linkedinPublisherToken;
  req.db = db;
  return next();
};

router
.all('/publish', function (req, res) {
  const url = req.lUrl;
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const hashTags = [''].concat(
    _.get(req, 'body.payload.info.labels', [])
    .slice(2)
    .map(h => h.replace(/[^\w\d]/mig, ''))
    .filter(h => h && h.length < 33)
    ).join(' #').trim();
  const body = {
      owner: 'urn:li:organization:' + req.linkedinPublisherId,
      subject: promoText,
      text: {
          text: `
          ${promoText}
          
          ${hashTags}
`
      },
      content: {
          contentEntities: [{
              entityLocation: url,
              thumbnails: [{
                  resolvedUrl: imgUrl
              }]
          }],
          title: promoText
      },
      distribution: {
          linkedInDistributionTarget: {}
      }
  };
  const headers = {
      'Authorization': 'Bearer ' + req.linkedinPublisherToken,
      'cache-control': 'no-cache',
      'X-Restli-Protocol-Version': '2.0.0',
      'x-li-format': 'json'
  };

  console.log(`-- linkedin published: ${promoText} ${url}`);
  
  as.waterfall([
   (next) => {
     request.post({
       url: req.linkedinPublisherUrl,
       json: body,
       headers: headers
     }, (err, response, body) => next(err, body));
   }
  ],
  (err, info) => {
    if(!!err) {
      // recordAlarm(req)('linkedin_publish_error');
      console.log(err);
    }
    responseHandler(null, res, info);
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
