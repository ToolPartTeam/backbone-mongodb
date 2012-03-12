var Db = require('../lib/db'),
  assert = require('assert'),
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
  describe('with nested', function(){
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
        async.waterfall([
          function(callback){new MyModel({key: 'value2', submodel: savedModel.id}, {callback: callback});},
          function(myModel, callback){
            new MyModel({key: 'value2'}, {
              callback: function(err, model2) { callback(err, myModel, model2); }
            });
          },
          function(myModel, model2, callback){
            model2.save(null, {
              success: function(model2){
                callback(null, myModel, model2);
              },
              error: callback
            });
          }
        ],
          function(err, myModel, model2) {
            myModel.set({submodel: model2.id});
            // TODO: async-kal ezt is tesztelni
            myModel.submodel.id.should.be.equal(model2.id);
            done();
        });
      });
    });
    describe('collection ids', function(){
      var savedModel;
      before(function(done){
        MyModel = MyModel.extend({
          nested : {
            subcollection: MyCollection
          },
          defaults: {
            subcollection: []
          }
        });
        savedModel = new MyModel({key: 'value'});
        savedModel.save(null, {success: function(model){done();}});
      });
      it('is created', function(done){
        async.waterfall([function(callback){new MyModel({subcollection: [savedModel.id]}, {callback: callback});}],
          function(err, myModel){
            should.exist(myModel.subcollection);
            myModel.subcollection.length.should.be.equal(1);
            myModel.subcollection.at(0).id.should.be.equal(savedModel.id);
            done();
          }
        );
      });
      it('propagate changes from attributes', function(done){
        async.waterfall([function(callback){new MyModel({subcollection: []}, {callback: callback});}],
          function(err, myModel){
            myModel.set({subcollection: [savedModel.id]});
            // TODO: write w/ asyncblock to ensure that callbacks are called
            assert(_.isEqual(myModel.get('subcollection'), myModel.subcollection.toJSON()));
            done();
          }
        );
      });
      it('propagate changes from the collection', function(done){
        async.waterfall([function(callback){new MyModel({subcollection: []}, {callback: callback});}],
          function(err, myModel){
            myModel.subcollection.add([savedModel]);
            // TODO: write w/ asyncblock to ensure that callbacks are called
            console.log(myModel.get('subcollection'), [savedModel.id]);
            assert(_.isEqual(myModel.get('subcollection'), [savedModel.id]));
            done();
          }
        );
      });
    });
  });
});
