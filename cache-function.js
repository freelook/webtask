const cacheManager = require('cache-manager');
const mongoStore = require('cache-manager-mongodb');
const objectHash = require('object-hash');
const request = require('request');
const fli = require('fli-webtask');
const _ = fli.npm.lodash;
const ttl = 3600; // sec. => one hour

let _mongoCacheStore;

const createMongoCache = (context) => {
  if(!_mongoCacheStore) {
    _mongoCacheStore = cacheManager.caching({
      store: mongoStore,
      uri: context.secrets.db,
      options: {
        collection: 'cacheManager',
        useUnifiedTopology: true
      }
    });
  }
  return _mongoCacheStore;
};

const fetchRequest = (options, next) => {
  request(options, (err, res, body) => {
    next(err, body);
  });
};

const fetchFromCache = (context) => (mongoCache, next) => {
  const options = _.get(context, 'body', {});
  const key = objectHash(options);
  mongoCache.wrap(key, (cacheCallback) => {
      fetchRequest(options, cacheCallback);
  }, {ttl: _.get(context, 'query.ttl', ttl)}, next);
};

/**
* @param context {WebtaskContext}
*/
module.exports = (context, cb) => {
  const token = _.get(context, 'body.qs.token', _.get(context, 'query.token'));
  if(context.secrets.token !== token) {
    return cb('No token.');
  }
  if(!context.body) {
    return cb('No body options for request.');
  }
  const mongoCache = createMongoCache(context);
  // context.body -> https://www.npmjs.com/package/request#requestoptions-callback
  return fetchFromCache(context)(mongoCache, (err, result) => {
    console.log(err, result);
    try { result = JSON.parse(result);} catch(e) { err = e; }
    return cb(err, result);
  });
};