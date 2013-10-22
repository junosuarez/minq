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

describe('MongoDb', function () {
  var MongoDb = require('../mongodb')

  describe('[[constructor]]', function () {

    it('lifts db to a promise', function (done) {
      var db = {}
      var mdb = new MongoDb(db)
      mdb.db.then(function (val) {
        val.should.equal(db)
      })
      .then(done, done)
    })
    it('has instance interface', function () {
      var mdb = new MongoDb()
      mdb.should.have.interface({
        run: Function,
        runAsStream: Function
      })
    })
  })

  describe('#run', function () {
    ['read','count','exists','insert', 'update', 'findAndModify', 'modifyAndFind', 'pull',
    'upsert', 'remove', 'removeAll'].forEach(function (command) {
    it('dispatches to ' + command + 'command', function (done) {
      var q = StubQuery()
      q.command = command
      var mdb = new MongoDb
      mdb['_'+command] = sinon.stub().returns(Q('result'))
      var result = mdb.run(q)
      result.then(function (val) {
        mdb['_'+command].should.have.been.calledOnce
        mdb['_'+command].should.have.been.calledWithExactly(q)
        val.should.equal('result')
      })
      .then(done, done)
    })
    })
    it('is rejected if unknown command', function (done) {
      var q = StubQuery()
      q.command = 'false command'
      var mdb = new MongoDb
      var result = mdb.run(q)
      result.then(function () {
        throw new Error('should not resolve')
      }, function (e) {
        e.should.match(/unknown/i)
      })
      .then(done, done)
    })
  })

  describe('#runAsStream', function () {
    it('returns a Stream', function () {
      var q = StubQuery()
      var mdb = new MongoDb()
      var s = mdb.runAsStream(q)
      s.on('error', function () { /* ignore */})
      s.should.be.instanceof(stream.Stream)
    })
    it('requires command=read', function (done) {
      var q = {command: 'not-read'}
      var mdb = new MongoDb()
      var stream = mdb.runAsStream(q)
      stream.on('error', function (e) {
        e.should.match(/read/)
        done()
      })
    })
    it('errors if the query has an error', function (done) {
      var q = {command: 'read', err: new Error('query error')}
      var mdb = new MongoDb()
      var stream = mdb.runAsStream(q)
      stream.on('error', function (e) {
        e.should.match(/query error/)
        done()
      })
    })
    it('errors if the underlying read has an error', function (done) {
      var q = StubQuery()
      var mdb = new MongoDb()

      mdb._find = sinon.stub().returns(Q.reject(new Error('read error')))

      var s = mdb.runAsStream(q)
      s.on('error', function (e) {
        e.should.match(/read error/)
        done()
      })

    })
    it('processes read queries', function (done) {

      var q = StubQuery()
      var mdb = new MongoDb()
      var underlyingStream = {
        pipe: sinon.spy()
      }
      var cursor = {
        toStream: sinon.stub().returns(underlyingStream)
      }
      mdb._find = sinon.stub().returns(Q(cursor))

      var s = mdb.runAsStream(q)
      s.on('end', function () {
        try {
          mdb._find.should.have.been.calledOnce
          cursor.toStream.should.have.been.calledOnce
          underlyingStream.pipe.should.have.been.calledOnce
          done()
        } catch (e) {
          done(e)
        }
      })
      s.on('error', done)

    })
  })

  describe('#_find', function () {
    it('calls find', function (done) {

      var find = function (query, callback) {
        find.query = query
        process.nextTick(function () {
          callback(null, [])
        })
      }
      var collection = sinon.stub().returns(Q({find:find}))

      var q = StubQuery()
      q.collection = 'fooCollection'
      q.query = {a: 1}
      var mdb = new MongoDb()
      mdb._collection = collection

      mdb._find(q).then(function () {
        collection.should.have.been.calledWithExactly(q)
        find.query.should.equal(q.query)
      })
      .then(done, done)

    })
  })

  describe('#_read', function () {
    it('returns resultset', function (done) {
      var q = StubQuery()
      q.one = true
      var mdb = new MongoDb()
      var cursor = {
        toArray: function (callback) {
          process.nextTick(function () {
            callback(null, ['result','set'])
          })
        }
      }
      mdb._find = sinon.stub().returns(Q(cursor))

      mdb._read(q).then(function (results) {
        results.should.deep.equal(['result', 'set'])
      })
      .then(done, done)
    })
    it('checks for expected scalar return value', function (done) {
      var q = StubQuery()
      q.first = true
      var mdb = new MongoDb()
      var cursor = {
        toArray: function (callback) {
          process.nextTick(function () {
            callback(null, ['result'])
          })
        }
      }
      mdb._find = sinon.stub().returns(Q(cursor))
      mdb._read(q).then(function (results) {
        Array.isArray(results).should.equal(false)
        results.should.equal('result')
      })
      .then(done, done)
    })
  })

  describe('#_collection', function () {
    it('gets underlying collection', function (done) {
      var db = {}

      db.collection = sinon.stub().returns({})

      var q = StubQuery()
      q.collection = 'fooCollection'
      var mdb = new MongoDb(db)

      mdb._collection(q).then(function () {
        db.collection.should.have.been.calledWithExactly('fooCollection')
      })
      .then(done, done)
    })
  })

  describe('#_count', function () {
    it('calls underlying count', function (done) {

      var count = sinon.stub().returns(Q(108))
      var collection = sinon.stub().returns(Q({count:count}))

      var q = StubQuery()
      q.collection = 'fooCollection'
      q.query = {a: 1}
      var mdb = new MongoDb()
      mdb._collection = collection

      mdb._count(q).then(function (val) {
        val.should.equal(108)
        collection.should.have.been.calledWithExactly(q)
        count.should.have.been.calledWithExactly(q.query)
      })
      .then(done, done)

    })
  })
  describe('#_exists', function () {
    it('returns true if not 0', function (done) {

      var count = sinon.stub().returns(Q(1))

      var q = StubQuery()
      q.collection = 'fooCollection'
      q.query = {a: 1}
      var mdb = new MongoDb()
      mdb._count = count

      mdb._exists(q).then(function (val) {
        val.should.equal(true)
        count.should.have.been.calledWithExactly(q.query)

      })
      .then(done, done)

    })
  })
  describe('#_insert', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._insert()
    })
  })
  describe('#_update', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._update()
    })
  })
  describe('#_findAndModify', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._findAndModify()
    })
  })
  describe('#_modifyAndFind', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._modifyAndFind()
    })
  })
  describe('#_pull', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._pull()
    })
  })
  describe('#_upsert', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._upsert()
    })
  })
  describe('#_remove', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._remove()
    })
  })
  describe('#_removeAll', function () {
    it('exists', function () {
      var mdb = new MongoDb()
      mdb._removeAll()
    })
  })


})
function StubQuery() {
  return {
      command: "read"
  }
}