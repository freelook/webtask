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
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  let db = _.get(req, 'query.db', _.get(req, 'body.db'));
  if(!db) {
    const errMsgYb = 'No youtube db config.';
    responseHandler(errMsgYb, res);
    return next(errMsgYb);
  }
  req.db = db;
  return next();
};
const refreshToken = (db) => (context, storage, cb) => {
  as.waterfall([
    (next) => request.post({
      url: context.secrets.googleAuthUrl,
      form: {
        grant_type: 'refresh_token',
        client_id: context.secrets.client_id,
        client_secret: context.secrets.client_secret,
        refresh_token: context.secrets[`${db}_refresh_token`]
      }
    }, (err, httpResponse, body) => {
      next(null, JSON.parse(body));
    }),
    (data, next) => {
      var token = {
        access_token: _.get(data, 'access_token'),
        expire: Date.now() + 1000 * (_.get(data, 'expires_in', 0) - 60)
      };
      storage[db] = storage[db] || {}; storage[db].token = token;
      context.storage.set(storage, () => next(null, token.access_token));
    }
  ], cb);
};
const authenticate = (db) => (context, cb) => {
  as.waterfall([
    (next) => context.storage.get(next),
    (storage, next) => {
      if (Date.now() < _.get(storage[db].token, 'expire', 0)) {
         return next(null, _.get(storage[db].token, 'access_token'));
      }
      return refreshToken(db)(context, storage, next);
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
  if(params.context && params.auth && params.id) {
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
  if(params.context && params.auth && (params.query || params.related)) {
    let config = {
      part: 'id,snippet',
      auth: params.auth,
      key: params.context.secrets.api_key,
      maxResults: _.get(params, 'max', 3),
      order: _.get(params, 'order', 'relevance'),
      // publishedAfter: _.get(params, 'publishedAfter'),
      q: _.get(params, 'query'),
      relatedToVideoId: _.get(params, 'related'),
      type: 'video'
    };
    return youtube.search.list(config, next);
  }
  return next(null, "Not enough params for search");
};
const comment = (params, next) => {
  if(params.context && params.auth && params.channelId && params.text) {
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
const upload = async (params, next) => {
  if (params.context && params.auth && params.snippet && params.fileStream) {
    try {
    const videoData = await youtube.videos.insert({
      part: 'id,snippet,status',
      auth: params.auth,
      key: params.context.secrets.api_key,
      requestBody: {
        snippet: params.snippet,
        status: {
          privacyStatus: 'public'
        }
      },
      media: {
        body: params.fileStream,
      }
    });
    return next(null, videoData);
    } catch(e) {
      return next(null, _.toString(e));
    }
  }
  return next(null, "Not enough params for upload");
};

router
.all('/upload', function (req, res) {
  console.log(`-- google youtube upload`);
  as.waterfall([
    (next) => authenticate(req.db)(req.webtaskContext, next),
    (auth, next) => {
      let file = req.webtaskContext.secrets[`${req.db}-file`];
      if(!file) {
        return (null, 'No file for youtube db');
      }
      let snippet = {
        title: 'Test title',
        description: 'Test description',
        tags: ['test tag']
      };
      let fileStream = request({url: file, encoding: null});
      return upload({auth, context: req.webtaskContext, fileStream, snippet}, next);
    }
  ], (err, uploadResult) => responseHandler(null, res, _.get(uploadResult, 'data', uploadResult)));
})
.all('/list/:id', function (req, res) {
  console.log(`-- google youtube item(s) list`);
  as.waterfall([
    (next) => authenticate(req.db)(req.webtaskContext, next),
    (auth, next) => {
      let id = req.params.id;
      return list({auth, id, context: req.webtaskContext}, next);
    }
  ], (err, listResult) => responseHandler(null, res, _.get(listResult, 'data', {})));
})
.all('/search', function (req, res) {
  console.log(`-- google youtube search`);
  as.waterfall([
    (next) => authenticate(req.db)(req.webtaskContext, next),
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
    (next) => authenticate(req.db)(req.webtaskContext, next),
    (auth, next) => {
      let item = req.body;
      return comment({
        auth: auth,
        context: req.webtaskContext,
        channelId: _.get(item, 'channelId'),
        videoId: _.get(item, 'videoId'),
        text: _.get(item, 'text')
      }, next);
    }
  ], (err, commentResult) => responseHandler(null, res, _.get(commentResult, 'data', {})));
})
.all('/publish', async (req, res) => {
  console.log(`-- google youtube publish`);
  as.waterfall([
    (next) => authenticate(req.db)(req.webtaskContext, next),
    async (auth) => {
      try {
        let query = req.query.q;
        let channel = req.webtaskContext.secrets[`${req.db}-channel`];
        if(channel) {
          let promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
          let link = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
          if(!query) {
            query = _.get(req, 'body.payload.info.title') || _.get(req, 'body.payload.promoText');
          }
          if(!promoText || !link) return;
          return await util.promisify(comment)({
              auth: auth,
              context: req.webtaskContext,
              channelId: channel,
              text: `${promoText} ${link}`
          }); 
        }
        console.log(channel, query);
        if(query) {
        let videoData = await util.promisify(search)({
          query, auth,
          // order: 'date',
          context: req.webtaskContext,
          // publishedAfter: (d => new Date(d.setDate(d.getDate() - 1)))(new Date()).toISOString(),
          max: 3
        });
        let videos = _.get(videoData, 'data.items', []);
        let store = await util.promisify((next) => req.webtaskContext.storage.get(next))();
        let comments = await global.Promise.all(_.map(videos, async(item) => {
          try {
            let videoId = _.get(item, 'id.videoId');
            if(_.includes(store.id, videoId)) {
              return null;
            }
            store.id.unshift(videoId);
            return _.get( await util.promisify(comment)({
              auth: auth,
              context: req.webtaskContext,
              channelId: _.get(item, 'snippet.channelId'),
              videoId: videoId,
              text: _.get(req, 'query.text', _.get(req, 'body.text')) || req.webtaskContext.secrets[`${req.db}-text`]
            }), 'data' );
          } catch(err) {
            return null;
          }
        }));
        store.id.length = Math.min(store.id.length, 30);
        await util.promisify((data, next) => req.webtaskContext.storage.set(data, next))(store);
        return {data: {comments, videos}};
        }
      } catch(err) {
        return err;
      }
    }
  ], (err, publishResult) => {
    responseHandler(null, res, _.get(publishResult, 'data', {}));
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
