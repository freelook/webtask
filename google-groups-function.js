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
  return next();
};
const generateMail = (payload, to) => {
  const title = _.get(payload, 'promoText') || _.get(payload, 'info.title') || '';
  const url = _.get(payload, 'shortUrl') || _.get(payload, 'url') || '';
  const img = _.get(payload, 'promoImg') || _.get(payload, 'info.image') || '';
  const description = _.get(payload, 'promoDescription') || '';
  const content = _.get(payload, 'info.content') || '';
  const body = `
  <div>
    <div class="fli-image" style="text-align:center;">
      <a href="${url}"><img src="${img}"/></a>
    </div>
    <div class="fli-description">${description}</div>
    <div class="fli-content">${content}</div>
    <div class="fli-title"><a href="${url}">${title}</a></div>
    <div class="fli-link" data-url="${url}"></div>
  </div>`;
  console.log(to, title, body);
  return {
    to: to,
    subject: title,
    body: body
  };
};

router
.all('/publish', function (req, res) {
  console.log(`-- google groups published`);
  as.waterfall([
    (next) => loader({
        method: 'post',
        url: req.webtaskContext.secrets.gmailFunction,
        qs: {token: req.webtaskContext.secrets.token},
        json: generateMail(_.get(req, 'webtaskContext.body.payload'), req.webtaskContext.secrets.groupEmail)
      }, (err, info) => next(null, err || info))
  ],
  (err, response) => {
    responseHandler(err, res, response);
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
