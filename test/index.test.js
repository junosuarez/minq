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
var ObjectId = require('mongodb').ObjectID

describe('Minq', function () {
  var Minq

  beforeEach(function () {
    Minq = moquire('../index', {'./query': {}})
  })

  describe('[[constructor]]', function () {
    it('has interface', function () {
      var minq = new Minq({})
      minq.should.have.interface({
        ready: Object
      })

      Q.isPromise(minq.ready).should.equal(true)

    })

    it('requires store parameter', function () {
      expect(function () {
        var minq = new Minq()
      }).to.throw(/required/)
    })

    it('#ready should be fulfilled with self', function (done) {
      var Minq = moquire('../index', {'./query': {}})
      Minq.prototype._initialize = sinon.stub().returns(Q())

      var minq = new Minq({ready:1})
      minq.ready.then(function (self) {
        self.should.equal(minq)
      })
      .then(done, done)

    })

    it('calls #initialize when store is ready', function (done) {
      var store = {
        ready: Q()
      }
      var Minq = moquire('../index', {'./query': {}})
      Minq.prototype._initialize = sinon.stub().returns(Q())

      var minq = new Minq(store)
      minq.ready.then(function () {
        minq._initialize.should.have.been.calledOn(minq)
      })
      .then(done, done)
    })
    it('overrides Query.ObjectId', function () {
      var Query = {}
      var Minq = moquire('../index', {'./query':Query})
      new Minq({})
      Query.ObjectId.should.equal(Minq.ObjectId)

    })
  })

  describe('.connect', function () {
    it('calls connect on default store and returns Minq#ready', function (done) {
      var defaultStore = {
        connect: sinon.stub().returns(Q())
      }
      var Minq = moquire('../index', {
        './mongodb': defaultStore,
        './query':{}
        })
      Minq.prototype._initialize = sinon.stub().returns(Q())

      var minq = Minq.connect('mongodb://foo')

      Q.isPromise(minq).should.equal(true)
      minq.then(function (minq) {
        minq.should.be.instanceof(Minq)
        defaultStore.connect.should.have.been.called
      })
      .then(done, done)
    })
  })

  describe('#_initialize', function () {
    it('creates convenience accessors for collections', function (done) {
      var store = {
        getCollectionNames: sinon.stub().returns(Q(['foo','baz']))
      }
      var query = {}
      var minq = {
        store: store,
        from: sinon.stub().returns(query)
      }
      Minq.prototype._initialize.call(minq).then(function () {
        store.getCollectionNames.should.have.been.called
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
    it('calls store#disconnect', function (done) {
      var store = {
        disconnect: sinon.stub().returns(Q())
      }
      var minq = new Minq(store)
      minq.disconnect().then(function () {
        store.disconnect.should.have.been.called
      })
      .then(done, done)
    })
  })

  describe('#from', function () {
    it('creates a new Query', function () {
      var store = {}

      var Query = function (store) {
        var self = this
        this.store = store
        this.from = sinon.stub().returns(self)
      }
      var Minq = moquire('../index', {
        './query': Query
      })
      var minq = new Minq(store)

      var q = minq.from('foo')

      q.should.be.instanceof(Query)
      q.store.should.equal(store)
      q.from.should.have.been.calledWithExactly('foo')
    })
  })

  describe('.ObjectId', function () {
    it('passes through non-ObjectId strings', function () {
      var id = 'condors'
      Minq.ObjectId(id)
        .should.equal(id)
    })
    it('passes through BSON ObjectIds', function () {
      var oid = ObjectId()
      Minq.ObjectId(oid)
        .should.equal(oid)
    })
    it('coerces to BSON ObjectId if passed a string which is a valid oid', function () {
      var str = '513f8bd6f8fea70000000001'
      var oid = Minq.ObjectId(str)
      oid.should.be.an('object')
      oid.toString().should.equal(str)
    })
    it('toStrings input and wraps if not string or oid object', function () {
      var foo = {toString: function () { return 'c0ffee' }}
      Minq.ObjectId(foo)
        .should.equal('c0ffee')

      var bar = {toString: function () { return '513f8bd6f8fea70000000001' }}
      var oid = Minq.ObjectId(bar)
      oid.should.be.an('object')
      oid.toString().should.equal(bar.toString())
    })

  })
})