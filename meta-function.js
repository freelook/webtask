const _ = require('lodash');
const util = require('util');
const urlHelper = require('url');
const cheerio = require('cheerio');
const needle = require('needle');

const metaget = function (uri, user_options, callback) {
        var options = {
            url: uri,
            follow: 5, 
            timeout: 5000,
            headers: {
                'User-Agent': 'request'
            }
        };

        //  setup the args/user_options
        var user_args = [];
        for (var i = 0; i < arguments.length; i++) {
            user_args.push(arguments[i]);
        }

        // remove these from arg array
        uri = user_args.shift();
        callback = user_args.pop();

        // get user_options if specified
        if (user_args.length > 0) {
            user_options = user_args.shift();
        } else {
            user_options = null;
        }

        // override default headers
        if (user_options) {
            options.headers = user_options.headers;
        }

        needle.get(options.url, {
          open_timeout: options.timeout,
          response_timeout: options.timeout,
          read_timeout: options.timeout,
          follow_max: options.follow,
          headers: options.headers
        }, function (error, response) {
            if (!error && response.statusCode === 200) {
                var body = response.body;
                var $ = cheerio.load(body);
                var meta = $('meta');
                var keys = Object.keys(meta);
                var meta_obj = {};
                keys.forEach(function (key) {
                    if (meta[key].attribs != undefined) {
                        if (meta[key].attribs.property && meta[key].attribs.content) {
                            meta_obj[meta[key].attribs.property] = meta[key].attribs.content;
                        }
                        if (meta[key].attribs.name && meta[key].attribs.content) {
                            meta_obj[meta[key].attribs.name] = meta[key].attribs.content;
                        }
                    }
                });
                
                meta_obj['title'] = $('title').text();
                var ogUrl = _.get(meta_obj, 'og:url', _.get(meta_obj, 'url', uri));
                if(meta_obj['og:image']) {
                  meta_obj['og:image'] = urlHelper.resolve(ogUrl, meta_obj['og:image']);
                }
                var icon = $('link[rel*="apple-touch-icon"]').attr('href') || $('link[rel*="icon"]').attr('href') || '';
                if(icon) {
                  meta_obj['icon'] = urlHelper.resolve(ogUrl, icon);
                }
                var rss = $('link[type*="rss+xml"]').attr('href') || $('link[type*="atom+xml"]').attr('href') || '';
                if(rss) {
                  meta_obj['rss'] = urlHelper.resolve(ogUrl, rss);
                }
                
                callback(null, meta_obj);
            } else {
                if (response && typeof response.statusCode !== 'undefined') {
                    callback('Response code: ' + response.statusCode, null);
                } else {
                    callback(error, null);
                }
            }
        });
};

/**
* @param context {WebtaskContext}
*/
module.exports = async function(context, cb) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  const url = _.get(context, 'query.url', _.get(context, 'body.url'));
  if(!url) {
      return cb('No url param provided.');
  }
  let meta = {};
  try {
    meta = await util.promisify(metaget)(
      url,
      {
        headers: {
          "User-Agent": context.secrets.user
        }
      });
  } catch(e) {
    meta = { error: _.toString(e) };
  } finally {
    cb(null, meta);
  }
};
