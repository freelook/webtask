let express = require('express');
let webtask = require('webtask-tools');
let bodyParser = require('body-parser');
let app = express();

app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.sendStatus(200);
});

module.exports = webtask.fromExpress(app);
