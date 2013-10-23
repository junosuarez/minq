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
        then: Function,
        ready: Object
      })

      Q.isPromise(minq.ready).should.equal(true)

    })
    it('minq.then should invoke minq.ready.then', function () {
      // heh, some round-about whitebox testing here:
      var ready = {
        then: sinon.spy()
      }
      var Minq = moquire('../index', {
        q: function () {
          return {then: function () { return ready }}
        }
      })

      var minq = new Minq()
      var onFulfilled = function () {}
      var onRejected = function () {}
      minq.then(onFulfilled, onRejected)
      ready.then.should.have.been.called
      ready.then.should.have.been.calledOn(minq.ready)
      ready.then.should.have.been.calledWithExactly(onFulfilled, onRejected)
    })
    it('#ready should be fulfilled with self', function (done) {
      var minq = new Minq({ready:1})
      minq.ready.then(function (self) {
        // TODO: iron this over
        self.it.should.equal(minq)
      })
      .then(done, done)

    })
  })

  describe('.connect', function () {
    it('calls connect on default provider and returns instanceof Minq', function (done) {
      var defaultProvider = {
        connect: sinon.stub().returns(Q())
      }
      var Minq = moquire('../index', {
        './mongodb': defaultProvider
        })

      var minq = Minq.connect('mongodb://foo')

      minq.should.be.instanceof(Minq)
      minq.then(function () {
        defaultProvider.connect.should.have.been.called
      })
      .then(done, done)
    })
  })
})