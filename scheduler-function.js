const fli = require('fli-webtask');
const m = require('moment');
const mz = require('moment-timezone');
const cron = require('cron-converter');
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

const cronHandler = (context) => (storage, next) => {
  const now = mz().tz(context.secrets.TIME_ZONE);
  const today =  mz().tz(context.secrets.TIME_ZONE).startOf('day');
  var tasks = [];
  _.keys(storage.tasks)
    .filter((key) => {
      var cronInstance = new cron();
      cronInstance.fromString(key);
      return cronInstance.schedule(now).prev().isBetween(today, now);
    })
    .map((key) => {
      tasks.push.apply(tasks, storage.tasks[key]);
    });
  worker(context)({tasks: tasks}, () => {});
  return next(null, tasks);
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
   (storage, next) => cronHandler(context)(storage, next)
  ], cb);
};
