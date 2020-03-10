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
    (next) => context.storage.get((err, storage) => {
      if(storage && storage.token && storage.token.expire > Date.now()) {
        return cb(null, storage.token.access_token);
      }
      next(null, storage);
    }),
    (storage, next) => request.get({
      url: context.secrets.googleAuthUrl,
    }, (err, httpResponse, body) => {
      next( null, { 
        storage: storage,
        token: ((body || '').match(new RegExp(`"${context.secrets.googleAuthToken}": "(.*)"`, 'i') || [])[1])
      });
    }),
    (params, next) => {
      let token = {
        access_token: params.token,
        expire: Date.now() + 1000 * 60 * 3
      };
      params.storage.token = token;
      context.storage.set(params.storage, () => cb(null, token.access_token));
    }
  ]);
};

router
.all('/web', function (req, res) {
  console.log(`-- google search`);
  const query = _.get(req, 'query.q', _.get(req, 'body.q'));
  if(!query) {
    return responseHandler('Empty query', res);
  }
  as.waterfall([
    (next) => refreshToken(req.webtaskContext, next),
    (token, next) => {
      let url = `${req.webtaskContext.secrets.googleSearchUrl}${token}&num=20&q=${query}`;
      let type = _.get(req, 'query.type', _.get(req, 'body.type'));
      if(type === 'image') {
        url += `&searchtype=image`;
      } 
      request.get({
        url: url, encoding: null
      }, (err, httpResponse, body) => {
        try {
          var goog = (data) => next(null, data);
          eval(body);
        } catch(err) {
          next(err);
        }
      });
    }
  ], (err, searchResult) => {
    const results = _.get(searchResult, 'results', {});
    responseHandler(err, res, {results});
  });
});

app
.use(bodyParser.json())
.use('/', validateMiddleware, router);

module.exports = wt.fromExpress(app);
