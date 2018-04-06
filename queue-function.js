const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.get('/', function (req, res) {
  res.sendStatus(200);
});

module.exports = wt.fromExpress(app);
