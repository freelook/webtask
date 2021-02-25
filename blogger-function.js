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
const {google} = require('googleapis');
const blogger = google.blogger('v3');
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
  var bUrl = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  if(!bUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.bUrl = bUrl;
  var db = _.get(req, 'body.db');
  var blogId = req.webtaskContext.secrets[`${db}-blogId`];
    if(!blogId) {
     const errMsgBlogger = 'No blogger publisher.';
     responseHandler(errMsgBlogger, res);
     return next(errMsgBlogger);
  }
  req.blogId = blogId;
  return next();
};
const refreshToken = (context, cb) => {
  as.waterfall([
    (next) => request.post({
      url: context.secrets.googleAuthUrl,
      form: {
        grant_type: 'refresh_token',
        client_id: context.secrets.client_id,
        client_secret: context.secrets.client_secret, 
        refresh_token: context.secrets.refresh_token
      }
    }, (err, httpResponse, body) => next(null, JSON.parse(body))),
    (data, next) => {
      var token = {
        access_token: _.get(data, 'access_token'),
        expire: Date.now() + 1000 * (_.get(data, 'expires_in', 0) - 60)
      };
      context.storage.set(token, () => next(null, token.access_token));
    }
  ], cb);
};
const auth = (context, cb) => {
  as.waterfall([
    (next) => context.storage.get(next),
    (storage, next) => {
      if (Date.now() < _.get(storage, 'expire', 0)) {
         return next(null, _.get(storage, 'access_token'));
      }
      return refreshToken(context, next);
    }
  ], (err, access_token) => {
    if(!!err) {
      return cb(err);
    }
    var authObj = new google.auth.OAuth2();
    authObj.setCredentials({access_token: access_token});
    return cb(null, authObj); 
  });
};
const generateContent = (payload) => {
  const title = _.get(payload, 'promoText') || _.get(payload, 'info.title') || '';
  const url = _.get(payload, 'shortUrl') || _.get(payload, 'url') || '';
  const img = _.get(payload, 'promoImg') || _.get(payload, 'info.image') || '';
  const description = _.get(payload, 'promoDescription') || '';
  const content = _.get(payload, 'info.content') || '';
  return `
  <div>
    <div class="fli-image" style="text-align:center;">
      <a href="${url}"><img src="${img}"/></a>
    </div>
    <div class="fli-description">${description}</div>
    <div class="fli-content">${content}</div>
    <div class="fli-title"><a href="${url}">${title}</a></div>
    <div class="fli-link" data-url="${url}"></div>
  </div>`;
};

router
.all('/publish', function (req, res) {
  console.log(`-- google blogger published`);
  as.waterfall([
    (next) => auth(req.webtaskContext, next),
    (authObj, next) => {
      blogger.posts.insert({
        auth: authObj,
        key: _.get(req, 'webtaskContext.secrets.api_key'),
        blogId: _.get(req, 'blogId'),
        requestBody: {
          title: _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title'),
          content: generateContent(_.get(req, 'body.payload')),
          //labels: _.get(req, 'body.payload.info.labels') || []
        }
      }, next);
    }
  ],
  (err, response) => {
    console.log(err, response);
    responseHandler(null, res, _.get(response, 'data', {}));
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
