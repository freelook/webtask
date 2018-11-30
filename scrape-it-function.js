const fli = require('fli-webtask');
const scrapeIt = require('scrape-it');
const _ = fli.npm.lodash;

module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  const endpoint = _.get(context, 'body.endpoint');
  const config = _.get(context, 'body.config');
  if(!(endpoint && config)) {
    return cb('No config or endpoint.');
  }
  scrapeIt(endpoint, config)
    .then((result) => {
      cb(null, _.get(result, 'data'));
    })
    .catch(err => {
      cb(err);
    });
};
