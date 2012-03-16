//    backbone-mongodb mongodb-sync.js
//    (c) 2011 Done.
var _ = require('underscore')._,
    ObjectID = require('mongodb').ObjectID,
    events = require('events'),
    async = require('async'),
    Backbone = require('backbone'),
    _ = require('underscore')._,
    Db = require('./db');

var Mongo = function(collectionName, model){
  this.collectionName = collectionName;
  this.model = model;
};
_.extend(Mongo.prototype, {
  // Obtain a database connection or die
  _requireConnection : function() {
    var connection = Db.getConnection();
    if (!connection) {
      throw new Error('FATAL: Database not connected');
    }
    return connection;    
  },
  
  // Request the Database collection associated with this Document
  _withCollection : function(callback) {
    var connection = this._requireConnection();
    connection.collection(this.collectionName, function(err, collection) {
      callback(err, collection);
    });
  }
  
});
Mongo.extend = Backbone.Model.extend;

var MongoSync = Mongo.extend({
  /**
   * @returns: returns a json list
   */
  find: function(callback) {
    // this.model is the backbone collection
    if (!this._requireRoot()) return;
    this._withCollection(function(err, collection){
      if (err) callback(err);
      else {
        collection.find().toArray(function(err, results){
          if(err) callback(err);
          else {
            results = _.map(results, function(result){
              result._id = result._id.toString();
              return result;
            });
            callback(null, results);
          }
        });
      }
    });
  },
  /**
   * @returns: returns JSON
   */
  findOne: function(callback) {
    var model = this.model;
    if (!this._requireRoot()) return;

    this._withCollection(function(err, collection) {
      if (err) { return callback(err); }
      
      collection.findOne({ _id: new ObjectID(model.id) }, function(err, dbModel) {
        if (err) callback(err);
        else if (!dbModel) callback(new Error('Could not find id ' + model.id));
//        model.set(dbModel, {silent:true});
        else {
        dbModel._id = dbModel._id.toString();
        callback(null, dbModel);
        }
      });      
    });
  },
  /**
   * @returns JSON
   */
  create: function(callback) {
    var model = this.model;

    this._withCollection(function(err, collection) {
      if (err) { return callback(err); }
      
      var data = model.toJSON();
      delete data._id;
      collection.insert(data, function(err, dbModel) {
        if(err) callback(err);        
        else {
          dbModel = dbModel[0];
          dbModel._id = dbModel._id.toString();
          callback(null, dbModel);
        }
      });
    });
  },
  /**
   * @returns JSON
   */
  update: function(callback) {
    var model = this.model;

    this._withCollection(function(err, collection) {
      if (err) callback(err);
      else {
        var attributes = model.toJSON();
        delete attributes._id;
        collection.update({ _id: new ObjectID(model.id) }, {$set: attributes}, {safe:true, upsert:false}, function(err) {
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
      else collection.remove({ _id: new ObjectID(model.id) }, callback);
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

var Sync = module.exports.Sync = function(method, model, options) {
    var resp;
    var collection = model.collectionName || model.collection.collectionName;
    var syncer = new MongoSync(collection, model);
    options.error = options.error || function(err){throw new Error(err);};

    var callback = function(err, results) {
      if (err) options.error(err);
      else options.success(results);
    };
    switch (method) {
      case "read":    
        var t = model.id !== undefined ? syncer.findOne(callback) : syncer.find(callback); break;
      case "create":  syncer.create(callback); break;
      case "update":  syncer.update(callback); break;
      case "delete":  syncer.destroy(callback); break;
    }
    return true; // actuall has no meaning
};

_.extend(Backbone.Model.prototype, Mongo.prototype, {
  idAttribute: '_id',
  nested: {}, // ref by id
  embedded: {}, // full json
  initialize: function(attributes, options){
    options = options || {};
    _.bind(this.nestOne, this);
    this.container = options.container || null;
    var self = this;
    this._create_embedded();
    if (!this.container && !_.isEmpty(this.nested)) {
      async.forEach(
        _.keys(self.nested), 
        function(attribute, callback) { self.nestOne(attribute, callback); }, 
        function(err){
          if(err) throw err;
          if(options.callback) options.callback(null, self);
        }
      );
    } else if(options.callback) {
      options.callback(null, this);
    }
  },
  _create_embedded: function(){
    // provide nested attributes
    // 1. another model from JSON
    // 2. another collection from JSON array
    _.each(this.embedded, function(value, attribute){
      var embedAs = this.embedded[attribute],
          self = this,
          nestwith,
          updateFromCollection;
      if(embedAs.prototype.model) {
        // we have collection
        updateFromCollection = function(attribute){
          this[attribute] = new embedAs(this.get(attribute), {container: this});
          this.bind('change:' + attribute, function(model){
            self[attribute].off();
            updateFromCollection.call(self, attribute);
          });
          this[attribute].bind('add', function(model){
            var data = {};
            data[attribute] = self.get(attribute) || [];
            data[attribute].push(model.id);
            self.set(data);
          });
          this[attribute].bind('remove', function(model){
            var data = {};
            data[attribute] = _.reject(self.get(attribute), function(one){ return _.isEqual(one, model.attributes); });
            self.set(data);
          });
        };
        if(_.isEmpty(this.get(attribute))) {
          this[attribute] = new Backbone.Collection();
          this[attribute].bind('add', function(model){
            var data = {};
            data[attribute] = self[attribute].toJSON();
            self.set(data);
          });
          this.bind('change:' + attribute, function(model){
            self[attribute].off();
            updateFromCollection.call(self, attribute);
          });
        } else {
          updateFromCollection.call(this, attribute);
        }
      } else {
        var create_model = function(attribute) {
          var self = this;
          this[attribute] = new embedAs(this.get(attribute), {container: this});
          this[attribute].bind('change', function(model){
            var data = {};
            data[attribute] = model.attributes;
            self.set(data);
          });
          this.bind('change:' + attribute, function(model){
            self[attribute].set(model.get(attribute), {silent:true});
          });
        };
        if(_.isEmpty(self.get(attribute))) {
          this[attribute] = new Backbone.Model();
          this.bind('change:' + attribute, function(model){
            self[attribute].off();
            create_model.call(self, attribute);
          });
          this[attribute].bind("change", function(model){
            var data = {};
            data[attribute] = model.toJSON();
            self.set(data);
          });
        } else {
          // we have json
          create_model.call(self, attribute);
        }
      }
    }, this);
  },
  nestOne: function(attribute, callback) {
    // provide nested attributes
    // 1. another model from model & ID
    // 2. another collection from list of IDs
    var nestAs = this.nested[attribute],
        self = this,
        callbacks,
        nestwith,
        updateFromCollection;
    if(_.isArray(this.get(attribute))) {
      // we have collection
      updateFromCollection = function(attribute){
        var self = this,
          nestwith = new nestAs();
        nestwith.find({_id: {$in: _.map( self.get(attribute), function(id){ return new ObjectID(id); })}}, 
          function(err, collection) {
            if(err) throw err;
            self[attribute] = collection;
            if(callback) callback(null, self);
            self.bind('change:' + attribute, function(model){
              model[attribute].off();
              updateFromCollection.call(model, attribute);
            });
            self[attribute].bind('add', function(model){
              var data = {};
              data[attribute] = self.get(attribute) || [];
              data[attribute].push(model.id);
              self.set(data);
            });
            self[attribute].bind('remove', function(model){
              var data = {};
              data[attribute] = _.without(self.get(attribute), model.id);
              self.set(data);
            });
          }
        );
      };
      updateFromCollection.call(this, attribute);
    } else {
      updateFromCollection = function(attribute){
        var nestwith = new nestAs();
        nestwith.findOne({_id: new ObjectID(this.get(attribute))},
          function(err, value){
            self[attribute] = value;
            if(callback) callback(null, self);
            // we propagate changes only in one direction
            self.bind('change:' + attribute, function(model){
              updateFromCollection.call(model, attribute);
            });
          }
        );
      };
      if(_.isEmpty(this.get(attribute))) {
        this[attribute] = new Backbone.Model();
        if(callback) callback(null, this);
        // populate it at first change
        this.bind('change:' + attribute, function(model){
          updateFromCollection.call(self, attribute);
        });
        // this will be a reference
        this[attribute].bind("change:_id", function(model){
          var data = {};
          data[attribute] = model.id;
          self.set(data);
        });
      } else if(_.isString(this.get(attribute))){
        // we have an id
        updateFromCollection.call(this, attribute);
      }
    }
  }
});

_.extend(Backbone.Collection.prototype, Mongo.prototype, {
    // Runs a mongodb find search. 
    // 
    // The callback is constructed from options.error and options.success
    // 
    // @param args: the query json object
    // @param fields: optional fields json to be returned
    // @param options: the usual backbone success/error callback json
    // @returns: the reseted collection with new models
    find: function(args, fields, options) {
      if(!options) {
        options = fields;
      }
      var self = this;
      this._withCollection(function(err, collection) {
        if (err) { return options.error(err); }
        else {
          collection.find(args).toArray(function(err, results) {
            var _prepareResults = function(results){
              if(!results)
                return null;

              results = _.map(results, function(result){
                result._id = result._id.toString();
                return result;
              });
              // TODO: extend the current collection instead of resetting it
              self.reset(results, {silent: true});
              return self;
            };
            if (_.isFunction(options)) options(err, _prepareResults(results));
            else if (err) options.error(err);
            else options.success(_prepareResults(results));
          });      
        }
      });
    },
    // Runs a mongodb findOne search
    //
    // The callback is constructed from options.error and options.success
    //
    // @returns: Collection.Model instance or null if the model does not validate
    findOne: function(args, options) {
      var self = this;
      this._withCollection(function(err, collection) {
        if (err) { return _.isFunction(options) ? options(err) : options.error(err); }
        collection.findOne(args, function(err, dbModel) {
          var _prepareResults = function(data){
            if(data && typeof(data._id) == 'object' && data._id.toString) {
              data._id = data._id.toString();
            }
            tr.emit('findOne:loaded', err, new self.model(data));
            var model;
            async.waterfall([function(callback){
              new self.model(data, {"callback": callback});
            }], function(err, result){
              if(err) throw err;
              else tr.emit('findOne:loaded', err, result);
            });
          };
          var tr;
          if (_.isFunction(options)) {
            if(err) options(err);
            else {
              tr = new events.EventEmitter();
              tr.once('findOne:loaded', function(err, model){
                options(err, model);
              });
              _prepareResults(dbModel, tr);
            }
          }
          else if (err) options.error(err);
          else if (!dbModel) options.error(new Error('Could not find anything'));
          else {
            tr = new events.EventEmitter();
            tr.once('findOne:loaded', function(err, model){
              if(err) options.error(err);
              else options.success(model);
            });
            _prepareResults(dbModel, tr);
          }
        });      
      });
    }
});
Backbone.sync = Sync;
