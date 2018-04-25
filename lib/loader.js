const request = require('request');

const loader = (params, next) => {
  request({
    method: (params.method || 'get').toUpperCase(),
    url: params.url,
    qs: params.qs,
    json: params.json
  }, (err, res, body) => {
    if(!!err || res.statusCode !== 200 || !body) {
      return next(err || body || 'No body.');
    }
    var msg = body;
    try {msg = typeof body === 'string' ? JSON.parse(body) : body;} catch(e) {}
    return next(null, msg);
  });
};

module.exports = loader;