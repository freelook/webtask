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
const twitterMiddleware = (req, res, next) => {
  req.twitter = new twitter({
    consumer_key: req.webtaskContext.secrets.TWITTER_CONSUMER_KEY,
    consumer_secret: req.webtaskContext.secrets.TWITTER_CONSUMER_SECRET,
    access_token_key: req.webtaskContext.secrets.TWITTER_ACCESS_TOKEN_KEY,
    access_token_secret: req.webtaskContext.secrets.TWITTER_ACCESS_TOKEN_SECRET
  });
  next();
};

router
.all('/publish', function (req, res) {
  const url = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const promoText = _.get(req, 'body.payload.promoText');
  console.log(`-- twitter published: ${promoText} ${url}`);
  as.waterfall([
   (next) => fli.npm.request({
      url: imgUrl,
      encoding: null
   },
   (err, res, body) => next(err, body)
   ),
   (image, next) => req.twitter.post('media/upload',
      {
        media_data: Buffer.from(image).toString('base64')
      },
      (error, media, response) => next(error, media)
   ),
   (media, next) => req.twitter.post('statuses/update', 
      {
        status: `${promoText} ${url}`,
        media_ids: media.media_id_string // Pass the media id string
      },
    (error, tweet, response) => next(error, tweet)
   )
  ],
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, twitterMiddleware, router);

module.exports = wt.fromExpress(app);
