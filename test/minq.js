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