var chai = require('chai')
chai.should()
var expect = chai.expect
var sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('chai-interface'))
var StubDb = require('./stubDb')
var Q = require('q')
Q.longStackSupport = true
var stream = require('stream')
var moquire = require('moquire')

describe('Minq', function () {
  var Minq = require('../index')

  describe('[[constructor]]', function () {
    it('has interface', function () {
      var minq = new Minq({})
      minq.should.have.interface({
        ready: Object
      })

      Q.isPromise(minq.ready).should.equal(true)

    })

    it('requires provider parameter', function () {
      expect(function () {
        var minq = new Minq()
      }).to.throw(/required/)
    })

    it('#ready should be fulfilled with self', function (done) {
      var Minq = moquire('../index')
      Minq.prototype._initialize = sinon.stub().returns(Q())

      var minq = new Minq({ready:1})
      minq.ready.then(function (self) {
        self.should.equal(minq)
      })
      .then(done, done)

    })

    it('calls #initialize when provider is ready', function (done) {
      var provider = {
        ready: Q()
      }
      var Minq = moquire('../index')
      Minq.prototype._initialize = sinon.stub().returns(Q())

      var minq = new Minq(provider)
      minq.ready.then(function () {
        minq._initialize.should.have.been.calledOn(minq)
      })
      .then(done, done)
    })
  })

  describe('.connect', function () {
    it('calls connect on default provider and returns Minq#ready', function (done) {
      var defaultProvider = {
        connect: sinon.stub().returns(Q())
      }
      var Minq = moquire('../index', {
        './mongodb': defaultProvider
        })
      Minq.prototype._initialize = sinon.stub().returns(Q())

      var minq = Minq.connect('mongodb://foo')

      Q.isPromise(minq).should.equal(true)
      minq.then(function (minq) {
        minq.should.be.instanceof(Minq)
        defaultProvider.connect.should.have.been.called
      })
      .then(done, done)
    })
  })

  describe('#_initialize', function () {
    it('creates convenience accessors for collections', function (done) {
      var provider = {
        getCollectionNames: sinon.stub().returns(Q(['foo','baz']))
      }
      var query = {}
      var minq = {
        provider: provider,
        from: sinon.stub().returns(query)
      }
      Minq.prototype._initialize.call(minq).then(function () {
        provider.getCollectionNames.should.have.been.called
        expect('foo' in minq).to.equal(true)
        expect('baz' in minq).to.equal(true)

        var foo = minq.foo
        minq.from.should.have.been.calledWithExactly('foo')
        foo.should.equal(query)

        var baz = minq.baz
        minq.from.should.have.been.calledWithExactly('baz')

      })
      .then(done, done)
    })
  })

  describe('#disconnect', function () {
    it('calls provider#disconnect', function (done) {
      var provider = {
        disconnect: sinon.stub().returns(Q())
      }
      var minq = new Minq(provider)
      minq.disconnect().then(function () {
        provider.disconnect.should.have.been.called
      })
      .then(done, done)
    })
  })

  describe('#from', function () {
    it('creates a new Query', function () {
      var provider = {}

      var Query = function (provider) {
        var self = this
        this.provider = provider
        this.from = sinon.stub().returns(self)
      }
      var Minq = moquire('../index', {
        './query': Query
      })
      var minq = new Minq(provider)

      var q = minq.from('foo')

      q.should.be.instanceof(Query)
      q.provider.should.equal(provider)
      q.from.should.have.been.calledWithExactly('foo')
    })
  })
})