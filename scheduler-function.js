const fli = require('fli-webtask');
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;

const worker = (context) => (params, next) => as.map(
  params.tasks,
  (task, next) => {
    loader({
    url: context.secrets[task], 
    qs: {token: context.secrets.token}
  }, () => {});
  next();
  }, 
  next
);

const mmHandler = (context) => (storage, next) => {
  worker(context)({tasks: storage.tasks.mm}, () => {});
  return next(null, storage);
};

const cronHandler = (context) => (storage, next) => {
  worker(context)({tasks: []]}, () => {});
  return next(null, storage);
};

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, cb) {
  if(context.secrets.container !== _.get(context, 'body.container')) {
    return cb('No container token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => mmHandler(context)(storage, next),
   (storage, next) => cronHandler(context)(storage, next),
   (storage, next) => context.storage.set(storage, next)
  ], cb);
};
