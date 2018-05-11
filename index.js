var dependencies = require('package.json').dependencies;

module.exports = {
  lib: require('./lib'),
  npm: Object.keys(dependencies).reduce(function(npm, d){
    npm[d] = require(d);
    return npm;
  }, {})
};