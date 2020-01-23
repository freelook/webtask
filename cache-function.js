const cacheManager = require('cache-manager');
const mongoStore = require('cache-manager-mongodb');
const objectHash = require('object-hash');
const request = require('request');
const fli = require('fli-webtask');
const _ = fli.npm.lodash;

const DEFAULT_TTL = 3600; // sec. => one hour
let _mongoCacheStore = {};

const createMongoCache = (context) => {
  const store = _.get(context, 'query.store', 'db');
  if(!_mongoCacheStore[store]) {
    const uri = _.get(context.secrets, store, context.secrets.db);
    _mongoCacheStore[store] = cacheManager.caching({
      store: mongoStore,
      uri: uri,
      options: {
        collection: 'cacheManager',
        useUnifiedTopology: true
      }
    });
  }
  return _mongoCacheStore[store];
};

const fetchRequest = (options, next) => {
  request(options, (err, res, body) => {
    next(err, body);
  });
};

const fetchFromCache = (context) => (mongoCache, next) => {
  const options = _.get(context, 'body', {});
  const key = objectHash(options);
  const queryTtl = +_.get(context, 'query.ttl');
  const ttl = _.isInteger(queryTtl) ? queryTtl : DEFAULT_TTL;
  mongoCache.wrap(key, (cacheCallback) => {
      fetchRequest(options, cacheCallback);
  }, { ttl }, next);
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
    if(!err && result) {
      try { result = JSON.parse(result);} catch(e) { /**/ }
    }
    return cb(err, result);
  });
};