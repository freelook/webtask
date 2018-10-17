'use latest';

const fli = require('./index.js');
const _ = fli.npm.lodash;
const {constants, components} = fli.lib;

const app = components.editor.init({
  middleware: [
    (req, res, next) => {
      req.webtaskContext = {
        query: req.query,
        headers: {host: "xxxx.test.com"},
        storage:{
          get: (next) => next(null, {}),
          set: (data, next) => next(null, data),
          backchannel:{webtaskName: 'express-with-view'}
        }
      };
      next();
    },
    components.editor.middleware.tokenAviability,
    components.editor.middleware.webtaskData,
    components.editor.middleware.tokenValidation,
  ],
  run: (req, res) => {
      res.status(constants.code.success).json({run: true});
  },
  api: (req, res) => {
    switch(_.chain(req).get('body.task').value()) {
      case 'save':
        return components.editor.save(req, res);
      default:
        return res.status(constants.code.success).json({api: true});
    }
  },
  edit: (req, res) => {
      const html = components.editor.render({
        title: 'Webtask Editor',
        webtask: req.webtask,
        schema: {
          input: {},
          output: {},
          handler: function(P) {
            P.save();
          }
        }
      });
      res.set(constants.header.contentType, constants.contentType.html);
      res.status(constants.code.success).send(html);
  },
  custom: true
})
.listen(process.env.PORT, process.env.IP, () => console.log(`Listening on ${ process.env.PORT }`));

module.exports = app;
