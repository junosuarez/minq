var chai = require('chai')
chai.should()
var expect = chai.expect
var sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('chai-interface'))
var StubDb = require('./stubDb')
var Q = require('q')
var stream = require('stream')

describe('Query', function () {
  var Query = require('../query')

  describe('[[constructor]]', function () {
    it('initializes data structure', function () {
      var db = {}
      var q = new Query(db)
      q._.db.should.equal(db)
      q._.should.have.property('collection')
      q._.should.have.property('query')
      q._.should.have.property('projection')
      q._.should.have.property('options')

    })
  })

  describe('#clone', function () {
    it('clones a new Query object copying expression', function () {
      var q = new Query
      q.from('foo').where({'bar':'apples'})
      var q2 = q.clone()

      q.should.not.equal(q2)
      q._.should.deep.equal(q2._)
      q2.should.be.instanceof(Query)
    })
  })

  describe('#from', function () {
    it('sets _.collection', function () {
      var q = new Query
      expect(q._.collection).to.equal(null)
      q.from('foo')
        .should.equal(q)
      q._.collection.should.equal('foo')
    })
  })

  describe('#where', function () {
    it('sets _.query', function () {
      var q = new Query
      q._.query.should.deep.equal({})
      q.where({isA: 'bear'})
        .should.equal(q)
      q._.query.should.deep.equal({isA: 'bear'})
    })

    it('is additive', function () {
      var q = new Query
      q.where({foo: 'bar'})
      q._.query.should.deep.equal({foo: 'bar'})
      q.where({baz: 'qux'})
      q._.query.should.deep.equal({foo: 'bar', baz: 'qux'})
    })
  })

  describe('#not', function () {
    it('checks a keypath for falsy-ness', function () {
      var q = new Query
      q.not('_archived')
      q._.query.should.deep.equal({'_archived': {$in: [false, null, undefined]}})
    })
  })

  describe('#select', function () {
    it('sets _.projection', function () {
      var q = new Query
      expect(q._.projection).to.equal(null)
      q.select({_id: true, name: true})
        .should.equal(q)
      q._.projection.should.deep.equal({_id: true, name: true})
    })
    it('takes arrays of string field names', function () {
      var q = new Query
      q.select(['a','b','c'])
      q._.projection.should.deep.equal({a: true, b: true, c: true})
    })
  })

  describe('#limit', function () {
    it('sets _.options.limit', function () {
      var q = new Query
      expect(q._.options.limit).to.equal(undefined)
      q.limit(1)
        .should.equal(q)
      q._.options.limit.should.equal(1)
    })
  })
  describe('#skip', function () {
    it('sets _.options.skip', function () {
      var q = new Query
      expect(q._.options.skip).to.equal(undefined)
      q.skip(23)
        .should.equal(q)
      q._.options.skip.should.equal(23)
    })
  })
  describe('#sort', function () {
    it('sets _.options.sort', function () {
      var q = new Query
      expect(q._.options.sort).to.equal(undefined)
      q.sort({name: -1})
        .should.equal(q)
      q._.options.sort.should.deep.equal({name: -1})
    })
  })
  describe('#options', function () {
    it('extends _.options', function () {
      var q = new Query
      q._.options.should.deep.equal({safe: true})
      q.options({elephant: false})
        .should.equal(q)
      q._.options.should.deep.equal({
        safe: true,
        elephant: false
      })
    })
  })

  describe('#first', function () {
    it('sets _.first to true', function () {
      var q = new Query
      expect(q._.first).to.equal(undefined)
      q.first()
        .should.equal(q)
      q._.first.should.equal(true)
    })
    it('sets _.options.limit to 1', function () {
      var q = new Query
      expect(q._.options.limit).to.equal(undefined)
      q.first()
        .should.equal(q)
      q._.options.limit.should.equal(1)
    })
  })

  describe('#count', function () {
    it('sets _.command to "count"', function () {
      var q = new Query
      q.count()
        .should.equal(q)
      q._.command.should.equal('count')
    })
  })

  describe('#exists', function () {
    it('sets _.command to "exists"', function () {
      var q = new Query
      q.exists()
        .should.equal(q)
      q._.command.should.equal('exists')
    })
  })

  describe('#byId', function () {
    it('desugars to where clause', function () {
      var q = new Query
      expect(q._.query).to.deep.equal({})
      q.byId(23)
        .should.equal(q)
      q._.query.should.deep.equal({
        _id: 23
      })
      q._.options.limit.should.equal(1)
      q._.first.should.equal(true)
    })
  })

  describe('#byIds', function () {
    it('desugars to where clause', function () {
      var q = new Query
      expect(q._.query).to.deep.equal({})
      q.byIds([23, 19, 20])
        .should.equal(q)
      q._.query.should.deep.equal({
        _id: {$in: [23, 19, 20]}
      })
      q._.options.limit.should.equal(3)
    })
    it('exception: TypeError if `ids` is not an Array', function () {
      var q = new Query
      q.byIds(94)
      q.error.should.be.instanceof(TypeError)
      q.error.message.should.match(/Array/)
    })
  })

  describe('#then', function () {
    it('forces execution as a promise', function (done) {
      var db = new StubDb()
      db.run.returns(Q('foo'))
      var q = new Query(db)
      q.then(function (val) {
        val.should.equal('foo')
        db.run.should.have.been.calledWith(q._)
      })
      .then(done, done)
    })
  })

  describe('#pipe', function () {
    it('forces execution and streams the results', function () {
      var db = new StubDb()
      db.runAsStream.returns(process.stdin)
      var q = new Query(db)
      var ws = new stream.Writable
      q.pipe(ws)
      try {
        db.runAsStream.should.have.been.calledWith(q._)
      } finally {
        // cleanup
        process.stdin.unpipe(ws)
      }
    })
  })

  describe('#forEach', function () {
    it('iterates over the result set as a stream and returns a promise', function (done) {
      var db = new StubDb()
      var rs = new stream.Readable({objectMode: true})
      var document = {}
      rs._read = function () {
        // push the document then end the stream
        this.push(this.ended ? null : document)
        this.ended = true
      }
      db.runAsStream.returns(rs)
      var q = new Query(db)
      var iterator = sinon.spy()
      q.forEach(iterator).then(function () {
        iterator.should.have.been.calledOnce
        iterator.should.have.been.calledWith(document)
        db.runAsStream.should.have.been.calledWith(q._)
      })
      .then(done, done)

    })
  })

  describe('#assert', function () {

    it('checks post-conditions and errors if assert fails', function () {
      var q = new Query
      var assertion = function (results) {
        return true
      }
      q.assert(assertion)
      q._.assertion.should.equal(assertion)

    })

    it('takes a predicate function, eg', function (done) {
      var db = new StubDb()
      var stubResults = []
      db.run.returns(Q(stubResults))

      var predicate = sinon.stub().returns(true)

      var q = new Query(db)
       q.from('bears')
        .assert(predicate)
        .then(function () {
          predicate.should.have.been.calledOnce
          predicate.should.have.been.calledWithExactly(stubResults)
        })
        .then(done, done)
    })
    it('fulfills the value if the predicate is true', function (done) {
      var predicate = sinon.stub().returns(true)
      var db = new StubDb()
      var stubResults = []
      db.run.returns(Q(stubResults))


      var q = new Query(db)
       q.from('bears')
        .where({polar:true})
        .assert(predicate)
        .then(function (value) {
          predicate.should.have.been.calledOnce

        })
        .then(done, done)
    })
    it('rejects if the predicate is false', function (done) {
      var predicate = sinon.stub().returns(false)
      var db = new StubDb()
      var stubResults = []
      db.run.returns(Q(stubResults))

      var q = new Query(db)
       q.from('bears')
        .assert(predicate)
        .then(function () {
          throw new Error('should not be fulfilled')
        }, function (reason) {
          predicate.should.have.been.calledOnce
          reason.should.be.instanceof(Error)
          reason.message.should.match(/Assertion failure:/)
        })
        .then(done, done)
    })
    it('takes failure message as second arg', function (done) {
      var predicate = sinon.stub().returns(false)
      var db = new StubDb()
      var stubResults = []
      db.run.returns(Q(stubResults))

      var q = new Query(db)
       q.from('bears')
        .assert(predicate, 'failure message')
        .then(function () {
          throw new Error('should not be fulfilled')
        }, function (reason) {
          reason.message.should.match(/failure message/)
        })
        .then(done, done)
    })

  })


  describe('mutators', function () {

    ['insert', 'update', 'findAndModify', 'modifyAndFind', 'pull',
    'upsert', 'remove', 'removeAll', 'count', 'exists'].forEach(function (command) {

      it('runs ' + command + ' command', function (done) {

        var db = new StubDb()
        var q = new Query(db)
        var out = {}
        db.run.returns(Q(out))
        var val = {}
        q[command](val)
          .then(function (result) {
            q._.command.should.equal(command)
            q._.commandArg.should.equal(val)
            db.run.should.have.been.calledWithExactly(q._)
            result.should.equal(out)
          })
          .then(done, done)
      })

    })
  })

})
