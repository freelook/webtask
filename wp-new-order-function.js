/**
* @param context {WebtaskContext}
*/

const AgileCRMManager = require('agile_crm');
const moment = require('moment');

module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
     const errMsgToken = 'No token.';
     return cb(errMsgToken);
  }
  let obj = new AgileCRMManager(context.secrets.DOMAIN, context.secrets.KEY, context.secrets.EMAIL);
  let success = function (data) {
    cb(null, data);
	};
  let error = function (data) {
    cb(data);
	};
  let task_email = {
    "subject": `Complete order: ${context.body.id}`,
    "type": "FOLLOW_UP",
    "priority_type": "HIGH",
    "taskDescription": `https://freelook.info/wp-admin/post.php?post=${context.body.id}&action=edit`,
    "due": moment().add(3, 'days').valueOf()
  };

  obj.contactAPI.createTaskByEmail(context.body.email, task_email, success, error);
  return cb();
};