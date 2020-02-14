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
.all('/call', async (req, res) => {
  const feed = req.body;
  if(feed && feed.includes(req.webtaskContext.secrets.topic)) {
    try {
      const id = feed.match(/<id>(.*)<\/id>/)[1].split(":")[2];
      console.log('-- publish digest: ', id);
      if(id) {
        let video = await util.promisify(loader)({
            method: 'post',
            qs: {token: req.webtaskContext.secrets.token},
            url: `${req.webtaskContext.secrets.youtubeFunction}/list/${id}`
        });
        let title = _.get(video, 'items[0].snippet.title');
        let image = _.get(video, 'items[0].snippet.thumbnails.standard.url');
        let labels = _.get(video, 'items[0].snippet.tags');
        if(title && image && labels) {
          loader({
            method: 'post',
            url: req.webtaskContext.secrets.db,
            qs: {token: req.webtaskContext.secrets.token},
            json: {
              url: req.webtaskContext.secrets.url + id,
              state: 'publish',
              as: 'link',
              info: {title, image, labels}
            }
          }, () => {});
          request.get(req.webtaskContext.secrets.youtubePublish);
        }
      }
    } finally {/**/}
  }
  res.status(204).send(_.get(req.query, 'hub.challenge', ''));
})
.all('/unsubscribe', (req, res) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
    return res.status(400).send('No token');
  }
  return request.post({
    url: req.webtaskContext.secrets.pubsubhubbub,
    formData: {
      'hub.callback': req.webtaskContext.secrets.callback,
      'hub.topic': req.webtaskContext.secrets.topic,
      'hub.verify': 'async',
      'hub.mode': 'unsubscribe'
    }
  }, (error, httpRes, body) => res.json({error, body}));
})
.all('/subscribe', (req, res) => {
  if(req.webtaskContext.secrets.token !== req.query.token) {
    return res.status(400).send('No token');
  }
  return request.post({
    url: req.webtaskContext.secrets.pubsubhubbub,
    formData: {
      'hub.callback': req.webtaskContext.secrets.callback,
      'hub.topic': req.webtaskContext.secrets.topic,
      'hub.verify': 'async',
      'hub.mode': 'subscribe'
    }
  }, (error, httpRes, body) => res.json({error, body}));
});

app
.use(bodyParser.text({type: 'application/atom+xml'}))
.use('/', router);

module.exports = wt.fromExpress(app);
