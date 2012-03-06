var Db = require('../lib/db'),
  should = require('chai').should(),
  asyncblock = require('asyncblock'),
  Backbone = require('backbone'),
  _ = require('underscore')._,
  Sync = require('../lib/mongodb-sync'),
  sinon = require('sinon'),
  mocha = require('mocha');

var MyModel = Backbone.Model.extend({
  url: '/models',
  collectionName: 'models'
});
var MyCollection = Backbone.Collection.extend({
  url: '/models',
  model: MyModel,
  collectionName: 'models'
});
describe('Collection', function(){
  var myCollection, myModel;
  before(function(done){
    var db = new Db({
      name: 'test',
      host: '127.0.0.1',
      port: 27017
    });
    db.on('connected', done);
  });
  beforeEach(function(done){
    myCollection = new MyCollection();
    myModel = new MyModel({key: 'value'});
    myModel.save(null, {success: function(model){
      done();
    }});
  });
  afterEach(function(done){
    myCollection._withCollection(function(err, collection){
      collection.remove(done);
    });
  });
  describe('find', function(){
    it('should use the callback when provided', function(done){
      myCollection.find({key: 'value'}, function(err, model){
        should.exist(model);
        model.should.be.instanceof(Backbone.Collection);
        done();
      });
    });
    it('should use success when no callback is provided', function(done){
      myCollection.find({key: 'value'}, {success:function(){done();}});
    });
    it('should reset the collection with new values', function(done){
      myCollection.find({key: 'value'}, {success: function(result){
        result.should.be.instanceof(Backbone.Collection);
        result.length.should.equal(1);
        result.at(0).id.should.equal(myModel.id);
        done();
      }});
    });
    it('should work with callback too', function(done){
      myCollection.find({key: 'value'}, function(err, result){
        should.not.exist(err);
        result.should.be.instanceof(Backbone.Collection);
        result.length.should.equal(1);
        result.at(0).id.should.equal(myModel.id);
        done();
      });
    });
  });
  describe('findOne', function(){
    it('should return exactly one model', function(done){
      var model2 = new MyModel({key: 'value'});
      model2.save(null, {success: function(){
        myCollection.findOne({key: 'value'}, {success: function(result){
          result.should.be.instanceof(Backbone.Model);
          result.id.should.be.equal(myModel.id);
          done();
        }});
      }});
    });
    it('should work with callback', function(done){
      var model2 = new MyModel({key: 'value'});
      model2.save(null, {success: function(){
        myCollection.findOne({key: 'value'}, function(err, result){
          should.not.exist(err);
          result.should.be.instanceof(Backbone.Model);
          result.id.should.be.equal(myModel.id);
          done();
        });
      }});
    });
  });
});

