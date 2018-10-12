'use latest';

const express = require('express');
const wt = require('webtask-tools');
const bodyParser = require('body-parser');
const _ = require('lodash');

const init = (config) => {
  let app = config.app || express();
  const router = express.Router();
  const middlewares = _.chain(config.middleware).concat(router).compact().value();
  
  router    
    .all('/', config.run) 
    .all('/api', config.api)
    .all('/edit', config.edit);
    
  app
    .use(bodyParser.json())
    .use('/', ...middlewares);
    
    return !!config.custom ? app : wt.fromExpress(app);
};

const render = (locals) => {
  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>${locals.title}</title>
    </head>

    <body>
      ${locals.body}
    </body>
    </html>
  `;
};

module.exports = {
  init: init,
  render: render
};