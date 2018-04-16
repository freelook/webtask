const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const as = require('async');
const fb = require('fb').default;
const app = express();
const router = express.Router();
const validateMiddleware = (req, res, next) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
     const errMsgToken = 'No token.';
     res.status(400).send(errMsgToken);
     return next(errMsgToken);
  }
  return next();
};
const fbMiddleware = (req, res, next) => {
  var secrets = req.webtaskContext.secrets;
  fb.options({version: secrets.version});
  fb.setAccessToken(secrets.access_token);
  return next();
};
const responseHandler = (res) => (err, data) => {
  if(!!err) {
    return res.status(400).json(err);
  }
  return res.status(200).json(data);
};

router
.get('/msg', function (req, res) {
  as.waterfall([
    (next) => {
      var body = 'Hi!';
      fb.api('me/feed', 'post', { message: body }, function (result) {
      if(!result || result.error) {
        console.log(!result ? 'error occurred' : result.error);
        return next(result.error || result || 'Error');
      }
      console.log('Post Id: ' + result.id);
      next(null, result);
    });
    }
  ],
  (err, result) => responseHandler(res)(err, result));
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, fbMiddleware, router);

module.exports = wt.fromExpress(app);
