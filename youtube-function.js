const fli = require('fli-webtask');
const wt = require('webtask-tools');
const util = require('util');
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
const validatePublish = (req, res, next) => {
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
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
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
    }, (err, httpResponse, body) => {
      next(null, JSON.parse(body));
    }),
    (data, next) => {
      var token = {
        access_token: _.get(data, 'access_token'),
        expire: Date.now() + 1000 * (_.get(data, 'expires_in', 0) - 60)
      };
      context.storage.set(token, () => next(null, token.access_token));
    }
  ], cb);
};
const authenticate = (context, cb) => {
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
    var authObj = new google.auth.OAuth2(
      context.secrets.client_id,
      context.secrets.client_secret
      );
    authObj.setCredentials({
      access_token: access_token,
      refresh_token: context.secrets.refresh_token
    });
    return cb(null, authObj);
  });
};
const list = (params, next) => {
  if(params.auth && params.id) {
    return youtube.videos.list({
      part: 'id,snippet',
      auth: params.auth,
      key: params.context.secrets.api_key,
      id: params.id
    }, (err, data) => {
      next(err, data);
    });
  }
  return next(null, "Not enough params for list");
};
const search = (params, next) => {
  if(params.auth && (params.query || params.related)) {
    let config = {
      part: 'id,snippet',
      auth: params.auth,
      key: params.context.secrets.api_key,
      maxResults: _.get(params, 'max', 3),
      order: _.get(params, 'order', 'relevance'),
      type: 'video'
    };
    if(params.query) {
      config.q = params.query;
    }
    if(params.related) {
      config.relatedToVideoId = params.related;
    }
    return youtube.search.list(config, next);
  }
  return next(null, "Not enough params for search");
};
const comment = (params, next) => {
  if(params.auth && params.channelId && params.videoId && params.text) {
    return youtube.commentThreads.insert({
      part: 'id,snippet',
      auth: params.auth,
      key: params.context.secrets.api_key,
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
.all('/list/:id', function (req, res) {
  console.log(`-- google youtube item(s) list`);
  as.waterfall([
    (next) => authenticate(req.webtaskContext, next),
    (auth, next) => {
      let id = req.params.id;
      return list({auth, id, context: req.webtaskContext}, next);
    }
  ], (err, listResult) => responseHandler(null, res, _.get(listResult, 'data', {})));
})
.all('/search', function (req, res) {
  console.log(`-- google youtube search`);
  as.waterfall([
    (next) => authenticate(req.webtaskContext, next),
    (auth, next) => {
      let query = req.query.q;
      let related = req.query.related;
      return search({auth, query, related, context: req.webtaskContext}, next);
    }
  ], (err, searchResult) => {
    responseHandler(null, res, _.get(searchResult, 'data', {}));
  });
})
.all('/comment', function (req, res) {
  console.log(`-- google youtube comment`);
  as.waterfall([
    (next) => authenticate(req.webtaskContext, next),
    (auth, next) => {
      let item = req.body;
      return comment({
        auth: auth,
        context: req.webtaskContext,
        channelId: _.get(item, 'channelId'),
        videoId: _.get(item, 'videoId'),
        text: item.text || ''
      }, next);
    }
  ], (err, commentResult) => responseHandler(null, res, _.get(commentResult, 'data', {})));
})
.all('/publish', async (req, res) => {
  console.log(`-- google youtube publish`);
  as.waterfall([
    (next) => authenticate(req.webtaskContext, next),
    async (auth, next) => {
      let query = req.query.q;
      try {
        let videos = await util.promisify(search)({
          query, auth,
          order: 'date',
          max: 1
        });
        console.log(videos);
        _.map(_.get(videos, 'data.items', []), (item) => {
          return comment({
            auth: auth,
            context: req.webtaskContext,
            channelId: _.get(item, 'snippet.channelId'),
            videoId: _.get(item, 'id.videoId'),
            text: "Sooo cute!"
          }, console.log);
        });
      } catch(err) {
        console.log(err);
        next(err);
      }
    }
  ], (err, commentResult) => responseHandler(null, res, _.get(commentResult, 'data', {})));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
