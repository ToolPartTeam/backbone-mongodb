//    backbone-mongodb mongodb-sync.js
//    (c) 2011 Done.
var _ = require('underscore')._,
    ObjectID = require('mongodb').ObjectID,
    Backbone = require('backbone'),
    Db = require('./db');

var MongoSync = function(collectionName, model){
  this.collectionName = collectionName;
  this.model = model;
};

_.extend(MongoSync.prototype, {
  findAll: function(callback) {
    if (!this._requireRoot()) return;
    this._withCollection(function(err, collection){
      if (err) callback(err);
      else {
        collection.find().toArray(function(err, results){
          if(err) callback(err);
          else callback(null, results);
        });
      }
    })
  },
  find: function(callback) {
    var model = this.model;
    if (!this._requireRoot()) return;

    this._withCollection(function(err, collection) {
      if (err) { return callback(err); }
      
      collection.findOne({ _id: new ObjectID(model.id) }, function(err, dbModel) {
        if (err) callback(err);
        else if (!dbModel) callback('Could not find id ' + model.id);
        else callback(null, dbModel);
      });      
    });
  },
  create: function(callback) {
    var model = this.model;

    this._withCollection(function(err, collection) {
      if (err) { return callback(err); }
      
      collection.insert(model.attributes, function(err, dbModel) {
        if(err) callback(err);        
        else callback(null, model.attributes);
      });
    });
  },
  update: function(callback) {
    var model = this.model;

    this._withCollection(function(err, collection) {
      if (err) callback(err);
      else {
        var attributes = _.clone(model.attributes);
        delete attributes['_id'];
        collection.update({ _id: new ObjectID(model.id) }, {$set: attributes}, {safe:true, upsert:false}, function(err) {
          model.fetch();
          callback(null, model.toJSON());
        });
      }
    });
  },
  destroy : function(callback) {
    var model = this.model;

    if (!this._requireRoot()) return;
    
    this._withCollection(function(err, collection) {
      if (err) callback(err);
      else collection.remove({ _id: model.id }, callback);
    });    
  },              

  // Obtain a database connection or die
  _requireConnection : function() {
    var connection = Db.getConnection();
    if (!connection) {
      throw 'FATAL: Database not connected', this;
    }
    return connection;    
  },
  
  // Request the Database collection associated with this Document
  _withCollection : function(callback) {
    var connection = this._requireConnection();
    connection.collection(this.collectionName, function(err, collection) {
      callback(err, collection);
    });
  },
  
  // Must be the root
  _requireRoot : function(callback) {
    if (this.model.container) {
      callback('This function cannot be called on an embedded document');
      return false;
    }
    return true;
  }
});

var Sync = module.exports = function(method, model, options) {
    var resp;
    var collection = model.collectionName || model.collection.collectionName;
    var syncer = new MongoSync(collection, model);

    var callback = function(err, results) {
      if (err) options.error(err);
      else options.success(results);
    }
    switch (method) {
      case "read":    
        model.id != undefined ? syncer.find(callback) : syncer.findAll(callback); break;
      case "create":  syncer.create(callback); break;
      case "update":  syncer.update(callback); break;
      case "delete":  syncer.destroy(callback); break;
    }
    return true; // actuall has no meaning
};
//_.extend(Backbone.Model.prototype, MongoModel);
//_.extend(Backbone.Collection.prototype, MongoCollection);
Backbone.sync = Sync;

