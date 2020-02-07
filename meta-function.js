const _ = require('lodash');
const util = require('util');
const metaget = require('metaget');

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
    meta = await util.promisify(metaget.fetch)(
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
