const nodemailer = require("nodemailer"); 

/**
* @param context {WebtaskContext}
*/
module.exports = async function(context, cb) {
  try {
    if(context.secrets.token !== context.query.token) {
      throw new Error('No token.');
    }
    const transporter = nodemailer.createTransport({
      host: context.secrets.host,
      port: 465,
      secure: true,
      auth: {
        user: context.secrets.user,
        pass: context.secrets.pass,
      },
    });
    let info = await transporter.sendMail({
      from: context.secrets.from, // sender address
      to: context.body.to, // list of receivers
      subject: context.body.subject, // Subject line
      text: context.body.text, // plain text body
      html: context.body.html, // html body
    });
    cb(null, info);
  } catch(err) {
    cb(null, JSON.stringify(err, Object.getOwnPropertyNames(err)));
  }
};
