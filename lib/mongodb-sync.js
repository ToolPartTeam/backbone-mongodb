//    backbone-mongodb mongodb-sync.js
//    (c) 2011 Done.
var _ = require('underscore')._,
    ObjectID = require('mongodb').ObjectID,
    asyncblock = require('asyncblock'),
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
        else if (!dbModel) callback('Could not find id ' + model.id);
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

var Sync = module.exports = function(method, model, options) {
    var resp;
    var collection = model.collectionName || model.collection.collectionName;
    var syncer = new MongoSync(collection, model);
    options.error = options.error || function(err){throw new Error(err);};

    var callback = options.callback ? options.callback : function(err, results) {
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
  nested: {},
  initialize: function(attributes, options){
    options = options || {};
    var outer_wait = options.flow || function(){};
    this._setup_nesting();
    outer_wait(null, 'a');
  },
  _setup_nesting: function(){
    // provide nested attributes
    // 1. another model from JSON
    // 2. another collection from JSON array
    // 3. another model from model & ID
    // 4. another collection from list of IDs
    _.each(this.nested, function(nestAs, attribute){
      var callbacks,
          nestwith,
          updateFromCollection,
          self = this;
      if(_.isArray(this.get(attribute))) {
        // we have collection
        if(_.isString(this.get(attribute)[0])) {
    /*      // we have ids
          updateFromCollection = function(attribute){
            nestwith = new nestAs();
            asyncblock(function(){
              self[attribute] = nestwith.find({_id: {$in: _.map(
                self.get(attribute), 
                function(id){
                  return new ObjectID(id);
                })}}).sync();
              self.bind('change:' + attribute, function(model){
                self[attribute].off();
                updateFromCollection(attribute);
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
            });
          };
          updateFromCollection(attribute);*/
        } else {
          updateFromCollection = function(attribute){
            self[attribute] = new nestAs(self.get(attribute));
            self.bind('change:' + attribute, function(model){
              self[attribute].off();
              updateFromCollection(attribute);
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
          };
          updateFromCollection(attribute);
        }
      } else {
        if(_.isString(this.get(attribute))){
          // we have an id
          updateFromCollection = function(attribute){
            var nestwith = new nestAs();
            asyncblock(function(flow){
              var wait = flow.add('wait');
              console.log('elo');
              nestwith.findOne({_id: new ObjectID(self.get(attribute))}, {success: function(model) {
                console.log('bent');
                wait(null, model);
                console.log('uto');
              }});
              self[attribute] = flow.wait('wait');
              console.log(self[attribute]);
              // we propagate changes only in one direction
              self.bind('change:' + attribute, function(model){
                updateFromCollection(attribute);
              });
            });
          };
          updateFromCollection(attribute);
        } else {
          // we have json
          var data = _.isEmpty(this.get(attribute)) ? {} : this.get(attribute);
          this[attribute] = new nestAs(this.get(attribute));
          this[attribute].bind('change', function(model){
            var data = {};
            data[attribute] = model.attributes;
            self.set(data);
          });
          this.bind('change:' + attribute, function(model){
            self[attribute].set(model.get(attribute), {silent:true});
          });
        }
      }
    }, this);
  }
});

_.extend(Backbone.Collection.prototype, Mongo.prototype, {
    /**
     * Runs a mongodb find search. 
     *
     * The callback is constructed from options.error and options.success
     *
     * @param args: the query json object
     * @param fields: optional fields json to be returned
     * @param options: the usual backbone success/error callback json
     * @returns: the reseted collection with new models
     */
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
    /**
     * Runs a mongodb findOne search
     *
     * The callback is constructed from options.error and options.success
     *
     * @returns: Collection.Model instance or null if the model does not validate
     */
    findOne: function(args, options) {
      var self = this;
      this._withCollection(function(err, collection) {
        if (err) { return _.isFunction(options) ? options(err) : options.error(err); }
        collection.findOne(args, function(err, dbModel) {
          var _prepareResults = function(data){
            if(data && typeof(data._id) == 'object' && data._id.toString) {
              data._id = data._id.toString();
            }
            return new self.model(data);
          };
          if (_.isFunction(options)) options(err, _prepareResults(dbModel));
          else if (err) options.error(err);
          else if (!dbModel) options.error('Could not find anything');
          else {
            options.success(_prepareResults(dbModel));
          }
        });      
      });
    }
});
Backbone.sync = Sync;
