var Db = require('../lib/db'),
  should = require('chai').should(),
  sinon = require('sinon'),
  mocha = require('mocha');

var db;
describe('Database', function(){
  before(function(){
    db = new Db({
      name: 'test',
      host: '127.0.0.1',
      port: 27017
    });
  });
  after(function(){
    Db.close();
  });
  it('connects fine', function(done){
    db.once('connected', function(){
      db.status.should.be.equal('connected');
      done();
    });
  });
  describe('getConnection', function(){
    before(function(done){
      if(db.status !== 'connected') db.on('connected', done);
      else done();
    });
    it('gives back the connection', function(){
      should.exist(Db.getConnection());
    });
  });
});

