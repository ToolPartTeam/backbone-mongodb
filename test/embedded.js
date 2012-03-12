/**
 * Testing embedded attributes
 */


var Db = require('../lib/db'),
  should = require('should'),
  async = require('async'),
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

describe('Model', function(){
  var myCollection, myModel;
  before(function(done){
    var db = new Db({
      name: 'test',
      host: '127.0.0.1',
      port: 27017
    });
    db.on('connected', done);
  });
  describe('with embedded model', function(){
    before(function(){
      MyModel = MyModel.extend({
        embedded : {
          submodel: MyModel
        }
      });
    });
    it('the attribute is created', function(done){
      var myModel = new MyModel({submodel: {key: 'value'}});
      should.exist(myModel.submodel);
      myModel.submodel.get('key').should.be.equal('value');
      done();
    });
    it('listens to changes in the attribute', function(done){
      var myModel = new MyModel({submodel: {key: 'value'}});
      myModel.set({submodel: {key: 'newvalue'}});
      myModel.submodel.get('key').should.be.equal('newvalue');
      done();
    });
    it('propagates changes to the attribute', function(done){
      var myModel = new MyModel({submodel: {key: 'value'}});
      myModel.submodel.set({key: 'newvalue'});
      myModel.get('submodel').key.should.equal('newvalue');
      done();
    });
  });
  describe('with embedded collection', function(){
    beforeEach(function(){
      MyModel = MyModel.extend({
        embedded: {
          subcollection: MyCollection
        }
      });
    });
    it('the attribute is created', function(done){
      var myModel = new MyModel({subcollection: [{key: 'value'}]});
      should.exist(myModel.subcollection);
      myModel.subcollection.length.should.be.equal(1);
      done();
    });
    it('propagate changes from attributes', function(done){
      var myModel = new MyModel({subcollection: [{key: 'value'}]});
      myModel.set({subcollection: [{key: 'myvalue'}]});
      myModel.subcollection.at(0).get('key').should.be.equal('myvalue');
      done();
    });
    it('propagate add from the collection', function(done){
      var myModel = new MyModel({subcollection: [{key: 'value'}]});
      myModel.subcollection.add({key: 'newmodel'});
      myModel.get('subcollection').length.should.be.equal(2);
      done();
    });
    it('propagate remove from the collection', function(done){
      var myModel = new MyModel({subcollection: [{key: 'value'}]});
      myModel.subcollection.remove(myModel.subcollection.at(0));
      myModel.get('subcollection').length.should.be.equal(0);
      done();
    });
  });
});
