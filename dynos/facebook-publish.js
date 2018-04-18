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
      return setTimeout(() => evaluateFunc(resolve), 1000);
    });
  });
};

module.exports = function(context, req, res) {

  var instance, page, status, content, error;

  phantom
    .create()
    .then((_instance) => {
      instance = _instance;
      return instance.createPage();
    })
    .then((_page) => {
      page = _page;
      return page.open('https://m.facebook.com/amzn.deals.us/');
    })
    .then((_status) => {
      status = _status;
      console.log(`Status: ${status}`);
    })
    .then(() => {
      return page.evaluate(function(){
        return document.querySelector('a[href*="login.php"]').click();
      });
    })
    .then(() => waitFor(page, 'input[name="email"]'))
    .then((isElementExist) => {
      console.log('Login', isElementExist);
      return isElementExist && page.evaluate(function(email, password){
        document.querySelector('input[name="email"]').value = email;
        document.querySelector('input[name="pass"]').value = password;
        return document.querySelector('button[name="login"]').click();
      }, context.secrets.fb_email, context.secrets.fb_pass);
    })
    .then(() => waitFor(page, 'a[aria-label="Publish"]'))
    .then((isElementExist) => {
      console.log('Publish', isElementExist);
      return isElementExist && page.evaluate(function(){
        return document.querySelector('a[aria-label="Publish"]').click();
      });
    })
    .then(() => waitFor(page, 'textarea[name="status"]'))
    .then((isElementExist) => {
      console.log('Textarea', isElementExist);
      return isElementExist && page.evaluate(function(){
        document.querySelector('textarea[name="status"]').value = 'test: ' + Date.now();
        return document.querySelector('button[value="Post"]').click();
      });
    })
    .then(() => waitFor(page, 'a[aria-label="Publish"]'))
    .then(() => {
      return page.evaluate(function(){
        return document.documentElement.outerHTML;
      });
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