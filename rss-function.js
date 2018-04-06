const request = require('request');
const feedparser = require('feedparser');
const es = require('event-stream');

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb("No token.");
  }
  if(context.query.rss) {
    const rss = context.query.rss;
    return request(rss)
        .pipe(new feedparser())
        .pipe(es.writeArray(function (err, arr) {
            if(err) {
              return cb(err);
            }
            return cb(null, {rss: arr});
        }))
        .on('error', function(err) {
            cb(err);
        });
  } 
  return cb("No rss param provided.");
};