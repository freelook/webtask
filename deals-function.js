const request = require('request');
const es = require('event-stream');
const RSS_FUNCTION = '';

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  
  request();
  
  return cb(null, { hello: context.query.name || 'Anonymous' });
};