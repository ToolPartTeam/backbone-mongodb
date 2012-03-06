//    backbone-mongodb db.js
//    (c) 2011 Done.

var util = require('util'),
    events = require('events'),
    Mongo = require('mongodb').Db,
    Server = require('mongodb').Server;

var _connection = null, db = null;

//  Database interface for the MongoDB
//
//  Options hash:
//    name, host, port
//    debug --- TODO: does MongoDB driver support debug?  how much?
//
//  Opens the database and emits an 'open' event on success, or an 'error' event if there was a problem.
var Database = module.exports = function(options) {
  options.autoconnect = options.autoconnect || true;
  this.status = 'new';
  db = this;
  db.mongo = new Mongo(options.name, new Server(options.host, options.port, {}));

  if (options.autoconnect) {
    Database.open();
  }
};

// Support events
util.inherits(Database, events.EventEmitter);

//  Returns a connection to the database, or null if the database is not (yet) open
Database.open = function() {
  var callback = function(err, database) {
      if(err) {
        db.status = 'error';
        db.emit('connected', err);
      } else {
        db.status = 'connected';
        _connection = database;
        db.emit('connected');
      }
  };
  if(!_connection) {
    db.mongo.open(callback);
  } else {
    _connection.open(callback);
  }
};
Database.close = function() {
  db.emit('closing');
  _connection.close();
  db.status = 'closed';
  return true;
};
Database.getConnection = function() {
  return _connection;
};
