const phantom = require('phantom');

const waitFor = (page, element) => {
  var count = 0;
  var evaluator;
  var selector = element.selector;
  var xpath = element.xpath;
  if(!!xpath) {
    evaluator = function() {
      return page.evaluate(function(xpath){
        return document.evaluate(xpath, document, null, 9, null).singleNodeValue;
      }, xpath);
    };
  } else {
    evaluator = function() {
      return page.evaluate(function(selector){
        return document.querySelector(selector);
      }, selector);
    };
  }
  return new Promise(function evaluateFunc(resolve) {
    evaluator().then((result) => {
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

const phantomClose = (page, instance) => {
  if(!!page) {
    return page.close().then(function(){
      instance && instance.exit();
    });
  } 
  return instance && instance.exit();
};

const responseEnd = (res, code, content) => {
  res.writeHead(code, { 'Content-Type': 'text/html '});
  res.end(content);
};

module.exports = function(context, req, res) {

  var instance, page, status, content, error;
  var fbText = req.body.text || req.query.text;
  if (!fbText) {
    return responseEnd(res, 400, 'No text provided.');
  }

  phantom
    .create([
        '--ignore-ssl-errors=yes',
        '--load-images=no'
    ])
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
        return document.evaluate('//*[text()="Log In"]', document, null, 9, null).singleNodeValue.click();
      });
    })
    .then(() => waitFor(page, {selector: 'input[name="email"]'}))
    .then((isElementExist) => {
      console.log('Login', isElementExist);
      return isElementExist && page.evaluate(function(email, password){
        document.querySelector('input[name="email"]').value = email;
        document.querySelector('input[name="pass"]').value = password;
        return document.querySelector('*[name="login"]').click();
      }, context.secrets.fb_email, context.secrets.fb_pass);
    })
    .then(() => waitFor(page, {xpath: '//*[text()="Publish"]'}))
    .then((isElementExist) => {
      console.log('Publish', isElementExist);
      return isElementExist && page.evaluate(function(){
        return document.evaluate('//*[text()="Publish"]', document, null, 9, null).singleNodeValue.click();
      });
    })
    .then(() => waitFor(page, {selector: 'textarea'}))
    .then((isElementExist) => {
      console.log('Textarea', isElementExist);
      return isElementExist && page.evaluate(function(fbText){
        document.querySelector('textarea').value = fbText;
        return document.querySelector('*[value="Post"]').click();
      }, fbText);
    })
    .then(() => waitFor(page, {selector: 'a[aria-label="Publish"]'}))
    .then(() => {
      return page.evaluate(function(){
        return document.documentElement.outerHTML;
      });
    })
    .then((_content) => {
      content = _content;
      console.log(`Success: ${!!_content}`);
      responseEnd(res, 200, content);
      phantomClose(page, instance);
    })
    .catch((_error) => {
      error = _error;
      console.log(`Error: ${error}`);
      responseEnd(res, 400, error);
      phantomClose(page, instance);
    });
    
};