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
  if(!(_.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url'))) {
     const errMsgUrl = 'No url provided.';
     responseHandler(errMsgUrl, res);
     return next(errMsgUrl);
  }
  return next();
};
const pinterestMiddleware = (req, res, next) => {
  req.pinterest = pinterest.init(req.webtaskContext.secrets.access_token);
  next();
}; 

router
.all('/publish', function (req, res) {
  const url = _.get(req, 'body.payload.shortUrl') || _.get(req, 'body.payload.url');
  const imgUrl = _.get(req, 'body.payload.promoImg') || _.get(req, 'body.payload.info.image');
  const promoText = _.get(req, 'body.payload.promoText') || _.get(req, 'body.payload.info.title');
  console.log(`-- pinterest published: ${promoText} ${url}`);
  as.waterfall([
   (next) => {
     req.pinterest.api('pins', {
        method: 'POST',
        body: {
            board: req.webtaskContext.secrets.board_id,
            note: promoText,
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
  (err, info) => responseHandler(err, res, info));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, pinterestMiddleware, router);

module.exports = wt.fromExpress(app);
