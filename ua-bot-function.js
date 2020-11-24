const fli = require('fli-webtask');
const util = require('util');
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

router
.all('/call', (req, res) => {
  const feed = req.body;
  console.log(feed, req.query);
  if(_.includes(feed, req.webtaskContext.secrets.topic)) {
    // do action
  }
  res.send(_.get(req.query, 'hub.challenge', ''));
})
.all('/subscribe', (req, res) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
    return res.status(400).send('No token');
  }
  const page = req.query.page || 1;
  console.log("Subscribe page ", page);
  as.waterfall([
    (next) => loader({
      method: 'get',
      url: req.webtaskContext.secrets.url + page + '.txt'
    }, next),
    (result, next) => {
      result.data.map(id => {
        console.log("Unsubscribe id ", id);
        request.post({
          url: req.webtaskContext.secrets.pubsubhubbub,
          formData: {
            'hub.callback': req.webtaskContext.secrets.callback,
            'hub.topic': req.webtaskContext.secrets.topic + id,
            'hub.verify': 'async',
            'hub.mode': 'unsubscribe'
          }
        }, () => {
          request.post({
            url: req.webtaskContext.secrets.pubsubhubbub,
            formData: {
              'hub.callback': req.webtaskContext.secrets.callback,
              'hub.topic': req.webtaskContext.secrets.topic + id,
              'hub.verify': 'async',
              'hub.mode': 'subscribe'
            }
          }, () => {
            console.log("Subscribe id ", id);
          });
        });
      });
      if(result.next) {
        loader({
          method: 'get',
          url: req.webtaskContext.secrets.subscribe,
          qs: {
            token: req.webtaskContext.secrets.token,
            page: result.next
          }
        }, () => {});
      }
      next();
    }
  ], (error, result) => {
    res.json({error, result});
  });
});

app
.use(bodyParser.text({type: 'application/atom+xml'}))
.use('/', router);

module.exports = wt.fromExpress(app);
