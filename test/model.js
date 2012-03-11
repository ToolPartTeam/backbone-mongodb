var Db = require('../lib/db'),
  should = require('chai').should(),
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
  describe('with nested', function(){
    describe('json model', function(){
      before(function(){
        MyModel = MyModel.extend({
          nested : {
            submodel: MyModel
          }
        });
      });
      it('is created', function(done){
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
    describe('model id', function(){
      var savedModel;
      before(function(done){
        MyModel = MyModel.extend({
          nested : {
            submodel: MyCollection
          }
        });
        savedModel = new MyModel({
          key: 'value'
        });
        savedModel.save(null, {success: function(model){
          done();
        }});
      });
      it('is created', function(done){
        async.waterfall([function(callback){new MyModel({key: 'value2', submodel: savedModel.id}, {callback: callback});}],
          function(err, myModel){
            should.exist(myModel.submodel);
            myModel.submodel.id.should.be.equal(savedModel.id);
            done();
          }
        );
      });
      it('it listens to changes in the attribute', function(done){
        var myModel = new MyModel({submodel: savedModel.id});
        var model2 = new MyModel({key: 'value2'});
        model2.save(null, {success: function(){
          myModel.set({submodel: model2.id});
          myModel.submodel.id.should.be.equal(model2.id);
          done();
        }});
      });
    });
    describe('json collection', function(){
      it('is created', function(done){
        var myModel = new MyModel({submodel: [{key: 'value'}]});
        // initialize finishes later than this one
        should.exist(myModel.submodel);
        myModel.submodel.length.should.be.equal(1);
        myModel.submodel.at(0).is.should.be.equal(savedModel.id);
        done();
      });
      it('propagate changes from attributes', function(done){
      });
      it('propagate changes from the collection', function(done){
      });
    });
    describe('collection ids', function(){
      var savedModel;
      before(function(done){
        MyModel = MyModel.extend({
          nested : {
            submodel: MyCollection
          }
        });
        savedModel = new MyModel({key: 'value'});
        savedModel.save(null, {callback: done});
      });
      it('is created', function(done){
        var myModel = new MyModel({submodel: [savedModel.id]});
        // initialize finishes later than this one
        should.exist(myModel.submodel);
        myModel.submodel.length.should.be.equal(1);
        myModel.submodel.at(0).is.should.be.equal(savedModel.id);
        done();
      });
      it('propagate changes from attributes', function(done){

      });
      it('propagate changes from the collection', function(done){
      });
    });
  });
});
