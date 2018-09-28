/**
* @param context {WebtaskContext}
*/

module.exports = function(context, cb) {
  if(context.secrets.token !== context.query.token) {
     const errMsgToken = 'No token.';
     return cb(errMsgToken);
  }
  console.log(context.body);
  // woocommerce_new_customer_note
  cb(null, {body: context.body});
};