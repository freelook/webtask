const request = require('request');
const feedparser = require('feedparser');
const es = require('event-stream');

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.query.rss) {
    return cb(null, { hello: context.query.rss });
  } 
  return cb(true);
};