const phantom = require('phantom');

const waitFor = (page, selector) => {
  var count = 0;
  return new Promise(function evaluateFunc(resolve) {
    page.evaluate(function(selector){
      return document.querySelector(selector);
    }, selector).then((result) => {
      if(!!result) {
        return resolve(true);
      }
      console.log('Count', count);
      count += 1;
      if(count > 3) {
        return resolve(false);
      }
      return setTimeout(() => evaluateFunc(resolve), 500);
    });
  });
};

/**
* @param context {WebtaskContext}
*/
module.exports = function(context, req, res) {
  var url = req.url.split('/phantom-function/')[1] || context.query.url;
  if(!url) {
    return res.end('No url provided.');
  }
  var instance, page, status, content, error;

  phantom
    .create()
    .then((_instance) => {
      instance = _instance;
      return instance.createPage();
    })
    .then((_page) => {
      page = _page;
      return page.open(url);
    })
    .then((_status) => {
      status = _status;
      console.log(`Status: ${status}`);
      return page.property('content');
    })
    .then((_content) => {
      content = _content;
      res.writeHead(200, { 'Content-Type': 'text/html '});
      res.end(content);
      page.close();
      instance.exit();
    })
    .catch((_error) => {
      error = _error;
      console.log(`Error: ${error}`);
      res.writeHead(400, { 'Content-Type': 'text/html '});
      res.end(error);
      instance && instance.exit();
    });
    
};