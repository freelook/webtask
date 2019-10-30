const fli = require('fli-webtask');
const m = require('moment');
const cron = require('cron-converter');
const as = fli.npm.async;
const _ = fli.npm.lodash;
const loader = fli.lib.loader;

const worker = (context) => (params, next) => as.map(
  params.tasks,
  (task, next) => {
    loader({
    url: context.secrets[task],
    qs: {token: context.secrets.token, alarm: true}
  }, () => {});
  next();
  }, 
  () => next()
);

const cronHandler = (context) => (params, next) => {
  var tasks = [];
  _.keys(params.storage.tasks)
    .filter((key) => {
      var cronInstance = new cron();
      cronInstance.fromString(key);
      return cronInstance.schedule(params.now).next().isBetween(params.now, params.tick, null, '[)');
    })
    .map((key) => {
      tasks.push.apply(tasks, params.storage.tasks[key]);
    });
  worker(context)({tasks: tasks}, () => {});
  return next(null, tasks);
};

/**
* @param context {WebtaskContext}
*/
module.exports = (context, cb) => {
  const now = m().add(2, 'h').startOf('m');
  const tick = m(now).add(1, 'm');
  if(context.secrets.token !== _.get(context, 'query.token')) {
    return cb('No container token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => cronHandler(context)({
     storage: storage,
     now: now,
     tick: tick
   }, () => next())
  ], () => cb());
};
