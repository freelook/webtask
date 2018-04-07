const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const mongodb = require('mongodb');
const mongoDbQueue = require('mongodb-queue');
const app = express();

app.use(bodyParser.json());

app.get('/push', function (req, res) {
  res.status(200).send('push');
});

app.get('/pop', function (req, res) {
  res.status(200).send('pop');
});

module.exports = wt.fromExpress(app);
