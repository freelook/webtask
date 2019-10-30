const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const twitter = require('twitter');
const express = fli.npm.express;
const request = fli.npm.request;
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;
const responseHandler = fli.lib.responseHandler;
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  console.log('-- Twitter validateMiddleware');
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
  var twUrl = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  if(!twUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.twUrl = twUrl;
  return next();
};
const twitterMiddleware = (req, res, next) => {
  var db = _.get(req, 'body.db');
  var consumer_key = req.webtaskContext.secrets[`${db}-TWITTER_CONSUMER_KEY`];
  var consumer_secret = req.webtaskContext.secrets[`${db}-TWITTER_CONSUMER_SECRET`];
  var access_token_key = req.webtaskContext.secrets[`${db}-TWITTER_ACCESS_TOKEN_KEY`];
  var access_token_secret = req.webtaskContext.secrets[`${db}-TWITTER_ACCESS_TOKEN_SECRET`];
  if(!(consumer_key && consumer_secret && access_token_key && access_token_secret)) {
     const errMsgTwitter = 'No twitter publisher.';
     responseHandler(errMsgTwitter, res);
     return next(errMsgTwitter);
  }
  req.twitter = new twitter({
    consumer_key: consumer_key,
    consumer_secret: consumer_secret,
    access_token_key: access_token_key,
    access_token_secret: access_token_secret
  });
  next();
};

router
.all('/publish', function (req, res) {
  const url = req.twUrl;
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  const hashTags = [''].concat(
    _.get(req, 'body.payload.info.labels', [])
    .map(h => h.replace(/[^\w\d]/mig, ''))
    .filter(h => h && h.length < 33)
    ).concat(['Amazon', 'Deal']).join(' #');
  console.log(`-- twitter published: ${promoText} ${url}`);
  as.waterfall([
   (next) => fli.npm.request({
      url: imgUrl,
      encoding: null
   },
   (err, _res, body) => next(err, body)
   ),
   (image, next) => req.twitter.post('media/upload',
      {
        media_data: Buffer.from(image).toString('base64')
      },
      (error, media, response) => next(error, media)
   ),
   (media, next) => req.twitter.post('statuses/update', 
      {
        status: `${url} ${promoText} ${hashTags}`,
        media_ids: media.media_id_string // Pass the media id string
      },
    (error, tweet, response) => next(error, tweet)
   )
  ],
  (err, info) => responseHandler(null, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, twitterMiddleware, router);

module.exports = wt.fromExpress(app);
