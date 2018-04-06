const request = require('request');
const es = require('event-stream');

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
 return request.get({
    url: context.secrets.rssFunction,
    qs: {
      token: context.secrets.token,
      rss: context.storage.goldbox
    }
  })
  .pipe(es.wait((err, data)=>{
    if(err) {
      return cb(err);
    }
    return cb(null, {rss: data});
  }))
  .on('error', function(err) {
      cb(err);
  });
};