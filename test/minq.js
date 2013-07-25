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
        from: Function,
        collection: Function,
        drop: Function,
        getCollections: Function,
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
        removeAll: Function,
        byId: Function,
        byIds: Function,
        deferToArray: Function,
        deferOne: Function
      })
    })
  })

  describe('Query#where', function () {
    it('is additive', function () {
      var query = minq()
      query.where({foo: 'bar'})
      query._.query.should.deep.equal({foo: 'bar'})
      query.where({baz: 'qux'})
      query._.query.should.deep.equal({foo: 'bar', baz: 'qux'})
    })
  })

  describe('Query#options', function () {
    it('can set arbitrary options', function () {
      var query = minq()
      query.options({multi: true})
      query._.options.multi.should.equal(true)
    })
  })

  describe('Query#select', function () {
    it('takes arrays of string field names', function () {
      var query = minq().select(['a','b','c'])
      query._.projection.should.deep.equal({a: true, b: true, c: true})
    })
  })

  describe('Query#byId', function () {
    it('can be combined with a `where` clause', function () {
      var oid = minq.ObjectId('513f8bd6f8fea70000000001')
      var query = minq().byId(oid).where({foo: 'baz'})
      query._.query.should.deep.equal({_id: oid, foo: 'baz'})
    })

    it('takes plain old strings', function () {
      var id = 'fizzbuzzer'
      var query = minq().byId(id)
      query._.query.should.deep.equal({_id: id})
    })

    it('coerces to a BSON ObjectId if passed a string which is a valid oid', function () {
      var str = '513f8bd6f8fea70000000001'
      var query = minq().byId(str)
      query._.query._id.should.be.an('object')
      query._.query._id.toString().should.equal(str)
    })
  })

})