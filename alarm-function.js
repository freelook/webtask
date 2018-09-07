const fli = require('fli-webtask');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const moment = require('moment');
const express = fli.npm.express;
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
  const market = _.get(req, 'params.market', '').toUpperCase();
  const db = req.webtaskContext.secrets[market];
  if(!db) {
    const errMsgMarketDB = 'No db name provided for market.';
    responseHandler(errMsgMarketDB, res);
    return next(errMsgMarketDB);
  }
  req.db = db;
  return next();
};

const triggerAlarm = (req) => (alarmBody) => {
  return loader({
    method: 'post',
    url: req.webtaskContext.secrets.gmailFunction,
    qs: {token: req.webtaskContext.secrets.token},
    json: {
      to: req.webtaskContext.secrets.admin,
      subject: 'Alarm!',
      body: alarmBody
    }
  }, () => {});
};

router
.all('/test', function (req, res) {
  console.log(`-- alarm test flow`);
  const yesterday = moment().subtract(2, 'days').format('YYYY-MM-DD');
  as.waterfall([
    // 1 - get db update for yesterday
    // 2 - send email if alarm is not ok
    (next) => loader({
      method: 'get',
      url: `${req.webtaskContext.secrets.storeFunction}/${req.db}/query/updated/${yesterday}`,
      qs: {token: req.webtaskContext.secrets.token}
    }, (err, data) => next(null, data || [])),
    (data, next) => {
      if(data && !data.length) {
        const alarmBody = `Alarm: No deals data. Date: ${yesterday}. Market DB: ${req.db}.`;
        triggerAlarm(req)(alarmBody);
        return next(null, alarmBody);
      }
      return next(null, 'ok');
    }
  ],
  (err, status) => {
    responseHandler(err, res, {status: status});
  });
})
.all('/trigger', function (req, res) {
  console.log(`-- alarm trigger flow`);
  as.waterfall([
    (next) => {
      const alarmBody = _.get(req, 'query.msg') || _.get(req, 'body.msg');
      if(!!alarmBody) {
        triggerAlarm(req)(alarmBody);
        return next(null, alarmBody);
      }
      return next(null, 'No alarm msg.');
    }
  ],
  (err, status) => {
    responseHandler(err, res, {status: status});
  });
});

app
.use(bodyParser.json())
.use('/:market', validateMiddleware, router);

module.exports = wt.fromExpress(app);