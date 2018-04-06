const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const app = express();

app.use(bodyParser.json());

app.get('/push', function (req, res) {
  res.sendStatus(200, 'push');
});

app.get('/pop', function (req, res) {
  res.sendStatus(200, 'pop');
});

module.exports = wt.fromExpress(app);
