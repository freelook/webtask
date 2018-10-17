'use latest';

const _ = require('lodash');
const a = require('async');
const jwt = require('jsonwebtoken');
const c = require('./core.js');
const constants = require('../constants.js');
const responseHandler = require('../response-handler');

const init = (config) => {
  if(!!config) {
    config.type = 'editor';
  }
  return c.init(config);
};

const buildSchema = (schema) => {
  return _.chain(schema || {})
    .defaults({
      title: 'Configuration',
      input: {},
      output: {},
      handler: () => {}
    })
    .reduce((s, v, k) => {
      s[k] = _.isFunction(v) ? _.toString(v) : JSON.stringify(v);
      return s;
    }, {})
    .value();
};

const render = (locals) => {
  locals.schema = buildSchema(locals.schema);
  return c.render({
        title: locals.title,
        body: `
        <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/bootstrap@4.1.3/dist/css/bootstrap.css">
        <link rel="stylesheet" href="//cdn.jsdelivr.net/npm/font-awesome@4.7.0/css/font-awesome.css">
        <style>
         .card.card-body {
            margin-bottom: 10px;
         }
        </style>
        <div class="alert alert-primary">
          Webtask: <b>${_.get(locals, 'webtask.name')}</b>
          <a href="${_.get(locals, 'webtask.adminURL')}" target="_blank">Admin</a>
          <a href="${_.get(locals, 'webtask.runURL')}" target="_blank">Run</a>
        </div>
        <div class="container-fluid">
          <div id="editor" class="mb-3"></div>
          <button id="save" class="btn btn-primary float-right">Save</button>
        </div>
        <script src="//cdn.jsdelivr.net/npm/jquery@3.3.1/dist/jquery.min.js"></script>
        <script src="//cdn.jsdelivr.net/npm/@json-editor/json-editor/dist/jsoneditor.min.js"></script>
        <script>
          window.JSONEditor.defaults.theme = 'bootstrap4';
          window.JSONEditor.defaults.iconlib = 'fontawesome4';
          var element = document.getElementById('editor');
          var editor = new JSONEditor(element, {
            schema: {
              type: "object",
              format: "grid",
              title: ${_.get(locals, 'schema.title')},
              properties: {
                input: {
                  type: "object",
                  properties: ${_.get(locals, 'schema.input')}
                },
                output: {
                  type: "object",
                  properties: ${_.get(locals, 'schema.output')}
                }
              }
            }
          });
          var save = function(_c) {
            var config = _c || {};
            return jQuery.ajax(config.custom || {
              url: config.url || window.location.href.replace('/edit', '/api'),
              method: config.method || 'POST',
              contentType : config.contentType || 'application/json',
              dataType: config.dataType || 'json',
              data: JSON.stringify({
                task: 'save',
                data: config.data || editor.getValue()
              })
            });
          };
          document.getElementById('save').addEventListener('click', function() {
            (${_.get(locals, 'schema.handler')})({
              editor: editor,
              save: save, 
              document: document,
              window: window,
              $: jQuery
            });
          });
        </script>
        `
      });
};

const save = (req, res, cb) => {
  a.waterfall([
    (next) => req.webtaskContext.storage.get(next),
    (storage, next) => {
      storage.data = _.get(req, 'body.data');
      next(null, storage);
    },
    (storage, next) => req.webtaskContext.storage.set(storage, next)
  ], cb || ((error, data) => {
    if(!!error) {
      return res.status(constants.code.error).json({error: error});
    }
    return res.status(constants.code.success).json({save: true});
  }));
};

const tokenAviability = (req, res, next) => {
  let wtToken = _.get(req, 'webtaskContext.query.token');
  if(!wtToken) {
     const errMsgToken = 'No token.';
     responseHandler(errMsgToken, res);
     return next(errMsgToken);
  }
  req.wtToken = wtToken;
  return next();
};

const webtaskData = (req, res, next) => {
  let wtName = _.get(req, 'webtaskContext.storage.backchannel.webtaskName');
  let wtHostData = _.get(req, 'webtaskContext.headers.host', '').split('.');
  let wtContainer = wtHostData.shift();
  let wtHost = wtHostData.join('.');
  req.webtask = {
    name: wtName,
    adminURL: `https://${wtHost}/edit/${wtContainer}#webtaskName=${wtName}&token=${req.wtToken}`,
    runURL: `https://${wtContainer}.${wtHost}/${wtName}?token=${req.wtToken}`
  };
  return next();
};

const tokenValidation = (req, res, next) => {
  let decodedToken = jwt.decode(req.wtToken, {complete: true});
  let wtName = _.get(req, 'webtask.name');
  if(!(wtName && _.chain(decodedToken).get('payload.jtnm[0]').isEqual(wtName).value())) {
     const errMsgValidToken = 'Token not valid.';
     responseHandler(errMsgValidToken, res);
     return next(errMsgValidToken);
  }
  return next();
};

module.exports = {
  init: init,
  render: render,
  save: save,
  middleware: {
    tokenAviability: tokenAviability,
    webtaskData: webtaskData,
    tokenValidation: tokenValidation
  }
};