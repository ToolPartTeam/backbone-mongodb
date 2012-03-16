//    backbone-mongodb index.js
//    (c) 2011 Done.
var nstatic = require('node-static');
require('./lib/mongodb-sync.js');

var fileServer = new nstatic.Server(__dirname + '/public');
module.exports = function(app, path){
  app.get(path, function(req, res){
    fileServer.serveFile('backbone-mongodb.js', 200, {}, req, res);
  });
};
module.exports.Db = require('./lib/db');

// A simple helper function to wrap a node styl callback
// into a backbone styl callback json
// @param callback: a node style callback accepting `err, result` arguments
// @returns. {success: .., error: ..} json object
module.exports.wrap_callback = function(callback){
  return {
    success: function(model) { callback(null, model);},
    error: function(error) {callback(error);}
    };
};


