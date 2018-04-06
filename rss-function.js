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
        .pipe(es.wait(function (err, body) {
          console.log(body);
            if(err) {
              return cb(err);
            }
            return cb(null, body);
        }))
        .on('error', function(err) {
            cb(err);
        });
  } 
  return cb("No rss param provided.");
};