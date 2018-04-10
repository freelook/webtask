const request = require('request');
const as = require('async');

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, req, res) {
  if(context.secrets.token !== context.query.token) {
    return cb('No token.');
  }
  return as.waterfall([
   (next) => context.storage.get(next),
   (storage, next) => {
     request.get({
        url: context.secrets.queueFunction,
        qs: {
          token: context.secrets.token
        }
      }, (err, res, body) => {
        if(!!err) {
          return res.status(400).json(err);
        }
        return res.status(200).json(body);
      });
     }
   ]);
};