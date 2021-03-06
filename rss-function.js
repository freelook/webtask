const _ = require('lodash');
const request = require('request');
const needle = require('needle');
const feedparser = require('feedparser');
const es = require('event-stream');

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  const rss = _.get(context, 'query.rss', _.get(context, 'body.rss'));
  if(!rss) {
      return cb('No rss param provided.');
  }
  const max = _.get(context, 'query.max', _.get(context, 'body.max', _.get(context, 'secrets.max')));
  return needle.get(rss, {follow_max: 5, parse: false})
      .pipe(new feedparser())
      .pipe(es.writeArray(function (err, arr) {
          if(err) {
            return cb(err);
          }
          return cb(null, {rss: arr.slice(0, +max)});
      }))
      .on('error', function(err) {
          cb(err);
      });
};