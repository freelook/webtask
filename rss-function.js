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
    return cb(null, { rss: context.query.rss });
  } 
  return cb("No rss param provided.");
};