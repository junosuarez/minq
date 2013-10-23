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
      var minq = new Minq()
      minq.should.have.interface({
        ready: Object
      })

      Q.isPromise(minq.ready).should.equal(true)

    })

    it('#ready should be fulfilled with self', function (done) {
      var minq = new Minq({ready:1})
      minq.ready.then(function (self) {
        self.should.equal(minq)
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

      var minq = Minq.connect('mongodb://foo')

      Q.isPromise(minq).should.equal(true)
      minq.then(function (minq) {
        minq.should.be.instanceof(Minq)
        defaultProvider.connect.should.have.been.called
      })
      .then(done, done)
    })
  })
})