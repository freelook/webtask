const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const pinterest = require('node-pinterest');
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
  var pUrl = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  if(!pUrl) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  req.pUrl = pUrl;
  return next();
};
const pinterestMiddleware = (req, res, next) => {
  var db = _.get(req, 'body.db') || _.get(req, 'query.db');
  var access_token = req.webtaskContext.secrets[`${db}-access_token`];
  var board_id = req.webtaskContext.secrets[`${db}-board_id`];
  if(!(access_token && board_id)) {
     const errMsgPinterest = 'No pinterest publisher.';
     responseHandler(errMsgPinterest, res);
     return next(errMsgPinterest);
  }
  req.pinterest = pinterest.init(access_token);
  req.board_id = board_id;
  next();
};

router
.all('/publish', function (req, res) {
  const url = req.pUrl;
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  const hashTags = [''].concat(
  _.get(req, 'body.payload.info.labels', [])
  .map(h => h.replace(/[^\w\d]/mig, ''))
  .filter(h => h && h.length < 33)
  ).join(' #').trim();
  console.log(`-- pinterest published: ${promoText} ${url}`);
  as.waterfall([
   (next) => {
     req.pinterest.api('pins', { 
        method: 'POST',
        body: {
            board: req.board_id,
            note: _.get(req, 'body.payload.as') === 'link' ? `${promoText}

${hashTags}` : promoText,
            link: url,
            image_url: imgUrl
        }
     })
     .then((json)=>{
        next(null, json);
     })
     .catch(next);
   }
  ],
  (err, info) => responseHandler(err, res, info));
})
.all('/boards', function (req, res) {
  as.waterfall([
   (next) => {
     req.pinterest.api('me/boards')
     .then((json)=>{
        next(null, json);
     })
     .catch(next);
   }
  ],
  (err, info) => responseHandler(null, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, pinterestMiddleware, router);

module.exports = wt.fromExpress(app);
