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
const youtube = google.youtube('v3');
const scopes = [
  'https://www.googleapis.com/auth/youtube'
];
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  var db = _.get(req, 'body.db');
  var youtubePublisher = req.webtaskContext.secrets[`${db}-youtube`];
  if(!youtubePublisher) {
    const errMsgYb = 'No youtube publisher.';
    responseHandler(errMsgYb, res);
    return next(errMsgYb);
  }
  req.db = db;
  var bUrl = _.get(req, 'body.payload.shortUrl');
  var discount = _.get(req, 'body.payload.promoDiscount');
  if(!bUrl || !discount) {
     const errMsgUrl = 'No url or discount provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.bUrl = bUrl;
  req.discount = discount;
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
    authObj.setCredentials({
      access_token: access_token
    });
    return cb(null, authObj); 
  });
};
const generateText = (params) => {
  const title = _.get(params.payload, 'promoText') || _.get(params.payload, 'info.title') || '';
  const discount = _.get(params.payload, 'promoDiscount', '');
  const shortUrl = _.get(params.payload, 'shortUrl', '');
  return `[${discount}% off] ${title} ${shortUrl}`;
};
const generateQuery = (payload) => {
  const query =  _.get(payload, 'info.title') ||
  _.get(payload, 'promoText', '')
  .replace(/\$[\d|.|,]+ /i, "")
  .replace(/[\d|.|,]+% /i, "")
  .replace(/save /i, "")
  .replace(/on /i, "")
  .replace(/off /i, "")
  .replace(/up to /i, "")
  .replace(/or more /i, "");
  return query
  .replace(/,|;|:|\[|\(|\]|\)|\{|\}/mig, "")
  .replace(/-|\+/mig, " ")
  .replace(/ /mig, "+")
  .substring(0, 50);
};
const search = (params, next) => {
  if(params.auth && params.query) {
    return youtube.search.list({
      part: 'id,snippet',
      auth: params.auth,
      q: params.query,
      maxResults: 3,
      order: 'relevance'
    }, next);
  }
  return next(null, "Not enough params for search");
};
const comment = (params, next) => {
  if(params.auth && params.channelId && params.videoId && params.text) {
    return youtube.commentThreads.insert({
      part: 'id,snippet',
      auth: params.auth,
      requestBody: {
        snippet: {
          channelId: params.channelId,
          videoId: params.videoId,
          topLevelComment: {
            snippet: {
              textOriginal: params.text
            }
          }
        }
      }
    }, next);
  }
  return next(null, "Not enough params for comment");
};

router
.all('/publish', function (req, res) {
  console.log(`-- google youtube published`);
  as.waterfall([
    (next) => auth(req.webtaskContext, next),
    (auth, next) => {
      let query = generateQuery(_.get(req, 'body.payload'));
      return search({auth, query}, 
      (err, searchResult) => next(err, {
        auth,
        query,
        search: _.get(searchResult, 'data', {})
      }));
    },
    (params, cd) => {
      as.map(
        _.get(params, 'search.items', []),
        (item, next) => {
          return comment({
            auth: params.auth,
            channelId: _.get(item, 'snippet.channelId'),
            videoId: _.get(item, 'id.videoId'),
            text: generateText({video: item, payload: _.get(req, 'body.payload')})
          }, (err, commentResult) => next(err, _.get(commentResult, 'data', commentResult)));
        },
        (err, commentsResult) => {
         cd(null, {
           commentsResult: commentsResult,
           query: params.query,
           search: params.search
         });
       }
      );
    }
  ],
  (err, response) => {
    responseHandler(err, res, _.get(response, 'data', response));
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
