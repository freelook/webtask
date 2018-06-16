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
const gmail = google.gmail('v1');
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
      client_id: context.secrets.client_id,
      client_secret: context.secrets.client_secret, 
      access_token: access_token,
      refresh_token: context.secrets.refresh_token
    });
    return cb(null, authObj); 
  });
};
const generateContent = (payload) => {

};

router
.all('/send', function (req, res) {
  console.log(`-- google gmail published`);
  as.waterfall([
    (next) => auth(req.webtaskContext, next),
    (authObj, next) => {
      const messageParts = [
        'From: <mr.freelook.info@gmail.com>',
        'To: <freelook@mail.ua>',
        'Content-Type: text/html; charset=utf-8',
        'MIME-Version: 1.0',
        `Subject: Hi`,
        '',
        'This is a message just to say hello.',
        'So... <b>Hello!</b>  🤘❤️😎'
      ];
      const message = messageParts.join('\n');    
      const encodedMessage = Buffer.from(message)
      .toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');
      gmail.users.messages.send({
        auth: authObj,
        userId: 'me',
        clientId: req.webtaskContext.secrets.client_id,
        requestBody: {
          raw: encodedMessage
        }
      })
      .then(data => next(null, data))
      .catch(err => next(null, err));
    }
  ],
  (err, response) => {
    responseHandler(err, res, _.get(response, 'data'));
  });
});

app
.use(bodyParser.json())
.use('/', /*validateMiddleware,*/ router);

module.exports = wt.fromExpress(app);
