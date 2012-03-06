var Db = require('../lib/db'),
  should = require('chai').should(),
  Backbone = require('backbone'),
  _ = require('underscore')._,
  Sync = require('../lib/mongodb-sync'),
  sinon = require('sinon'),
  mocha = require('mocha');

var MyModel = Backbone.Model.extend({
  idAttribute: '_id',
  url: '/models',
  collectionName: 'models'
});
var MyCollection = Backbone.Collection.extend({
  url: '/models',
  model: MyModel,
  collectionName: 'models'
});

describe('Sync', function(){
  before(function(done){
    db = new Db({
      name: 'test',
      host: '127.0.0.1',
      port: 27017
    });
    db.once('connected', done);
  });
  after(function(){
    Db.close();
  });
  describe('on create', function(){
    it('returns a Model with id set', function(done){
      var myModel = new MyModel({key:'value'});
      myModel.save(null, {success: function(result){
        result.should.be.an.instanceof(MyModel);
        result.id.should.be.a('string');
        should.exist(result.id);
        result.id.should.be.equal(result.get('_id'));
        done();
      }});
    });
  });
  describe('on update', function(){
    var myModel;
    beforeEach(function(done){
      // create a new model
      myModel = new MyModel({key:'value'});
      myModel.save(null, {success: function(result){
        done();
      }});
    });
    afterEach(function(done){
      myModel.destroy({callback: done});
    });
    it('returns the updated model with the same id', function(done){
      var old_id = myModel.id;
      myModel.save({key: 'other'}, {success: function(result){
        result.should.be.an.instanceof(MyModel);
        result.id.should.be.equal(old_id);
        result.get('key').should.equal('other');
        done();
      }});
    });
  });
  describe('on read', function() {
    var myModel;
    beforeEach(function(done){
      // create a new model
      myModel = new MyModel({key:'value'});
      myModel.save(null, {success: function(result){
        done();
      }});
      myModel.set({key: 'something'});
    });
    afterEach(function(done){
      myModel.destroy({callback: done});
    });
    it('returns a model', function(done){
      var old_id = myModel.id;
      myModel.fetch({success: function(result){
        result.should.be.an.instanceof(MyModel);
        result.id.should.be.equal(old_id);
        result.get('key').should.be.equal('value');
        done();
      }});
    });
  });
  describe('on read with collection', function(){
    var myCollection, myModel;
    beforeEach(function(done){
      myModel = new MyModel({key:'value'});
      myCollection = new MyCollection();
      myCollection._withCollection(function(err, collection){
        collection.remove({}, function(){
          myCollection.create(myModel, {success: function(result){done();}});
        });
      });
    });
    afterEach(function(done){
      myCollection._withCollection(function(err, collection){
        collection.remove({}, done);
      });
    });
    it('resets itself silently', function(done){
      myModel.set({key:'other'});
      var twoModel = new MyModel({key: 'value2'});
      twoModel.save(null, {success: function(tModel){
        myCollection.length.should.be.equal(1);
        myCollection.fetch({success: function(result){
          result.should.be.instanceof(Backbone.Collection);
          result.length.should.be.equal(2);
          should.exist(result.get(myModel.id));
          result.get(myModel.id).get('key').should.be.equal('value');
          done();
        }});
      }});
    });
  });
});

