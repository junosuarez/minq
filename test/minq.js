var chai = require('chai')
chai.should()
var sinon = require('sinon')
chai.use(require('chai-interface'))

describe('minq', function () {
  var minq = require('../index')

  it('is a fluent query wrapper for mongoDB based on promises', function () {
    var db = {collection: sinon.stub()}

    minq(db)
    .collection('states')
    .where({capital: 'Sacramento'})
    .one()
    .then(function (state) {
      // do stuff with California
    })
  })

  it('returns a minq Query object', function () {
    var q = minq()
    q.should.be.instanceof(minq)
  })

  describe('static functions', function () {
    it('interface', function () {
      minq.should.have.interface({
        connect: Function,
        ObjectId: Function,
        ObjectID: Function,
        like: Function
      })
    })
    describe('like', function () {
      it('builds a regexp for use in a where query', function () {
        Object.prototype.toString.call(minq.like('foo')).should.equal('[object RegExp]')
      })
      it('escapes regex chars', function () {
        var pattern = '#F#$FESR^.^_\\^GGW$%E()...'
        var regex = minq.like(pattern)
        regex.test(pattern).should.equal(true)
        var regex2 = new RegExp(pattern)
        regex2.test(pattern).should.equal(false)
      })
      it('creates a cast insensitive regex', function () {
        var regex = minq.like('FOO')
        regex.test('foo').should.equal(true)
        regex.test('FOO').should.equal(true)
        regex.test('bar').should.equal(false)
      })
    })
  })

  describe('Query', function () {
    it('has interface', function () {
      minq().should.have.interface({
        collection: Function,
        where: Function,
        select: Function,
        sort: Function,
        limit: Function,
        skip: Function,
        toArray: Function,
        one: Function,
        stream: Function,
        count: Function,
        insert: Function,
        update: Function,
        upsert: Function,
        remove: Function,
        removeAll: Function
      })
    })
  })
})