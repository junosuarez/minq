var chai = require('chai')
chai.should()
var expect = chai.expect
var sinon = require('sinon')
chai.use(require('sinon-chai'))
chai.use(require('chai-interface'))
var Promise = require('bluebird')
var stream = require('stream')
var through = require('through')
var ObjectId = require('mongodb').ObjectID

var Minq = require('../../')

var connStr = 'mongodb://localhost/minq_test'
describe('integration tests', function () {
  var minq
  var db
  var collection = 'test'+Date.now()

  beforeEach(function (done) {
    minq = Minq.connect(connStr)
    minq.then(function (_db){
      db = _db
    })
    .then(null, function (e){
      if (e && /connect/.test(e.message)) {
        console.log('\n')
        console.log('=======================================')
        console.log('== Make sure local mongod is running ==')
        console.log('=======================================')
      }
      throw e
    })
    .then(done, done)
  })

  afterEach(function (done) {
    db.store.dropCollection(collection)
      .then(function () {
        return db.disconnect()
      })
    .then(done, done)
  })

  it('can read and write', function (done) {

    db.from(collection).insert({greeting: 'hello', name: 'jason'})
      .then(function () {
        return db.from(collection).where({greeting:'hello'})
          .first()
          .then(function (result) {
            result.name.should.equal('jason')
          })
    })
    .then(done, done)

  })


  // https://github.com/jden/minq/issues/15
  it('eager evaluates updates', function (done) {

    db.from(collection).insert({_id: 'asdf62'})
      .then(function () {
        db.from(collection).where({_id: 'asdf62'})
          .update({$set: {a: true}})
          // don't call `.then()
        setTimeout(function () {
          db.from(collection).where({_id:'asdf62'})
            .first()
            .then(function (doc) {
              doc.a.should.equal(true)
            })
            .then(done, done)
        }, 50)
      })
  })

  describe('bson objectids', function () {
    it('works with byId', function (done) {
      var oid = ObjectId()
      db.from(collection).insert({_id: oid, test:true})
      .then(function () {
        return db.from(collection).byId(oid.toString())
        .then(function (doc) {
          doc.test.should.equal(true)
        })
      })
      .then(done, done)
    })
  })

  describe('readonly', function () {
    beforeEach(function (done) {
      testData(db, collection).then(done, done)
    })

    it('can query', function (done) {
      db.from(collection)
        .where({'language_paradigms':{id: '/en/functional_programming'}})
        .then(function (langs) {
          langs.length.should.equal(44)
        })
        .then(done, done)
    })

    it('can limit, sort, and skip', function (done) {
      db.from(collection)
        .limit(10)
        .skip(10)
        .sort({name: 1})
        .select(['name'])
        .then(function (langs) {
          langs.length.should.equal(10)
          langs.map(function (x) { return x.name})
            .should.deep.equal([
              'C#', 'C++', 'COBOL', 'Caml', 'Cat', 'Cecil',
              'Cobra', 'ColdFusion Markup Language', 'Common Lisp', 'Dylan'])
        })
        .then(done, done)
    })

    it('can stream', function (done) {
      var count = 0
      db.from(collection)
        .limit(10)
        .pipe(through(function (data) {
          count++
        }))
        .on('error', done)
        .on('end', function () {
          try {
            count.should.equal(10)
            done()
          } catch (e) {
            done(e)
          }
        })
    })

    it('can forEach', function (done) {
      var count = 0
      db.from(collection)
        .limit(10)
        .forEach(function (lang) {
          count++
        })
        .then(function () {
          count.should.equal(10)
        })
        .then(done, done)
    })

    it('first returns scalar', function (done) {
      db.from(collection)
        .first()
        .then(function (val) {
          Array.isArray(val).should.equal(false)
        })
        .then(done, done)
    })
    it('first is rejected if no match', function (done) {
      db.from(collection)
        .first()
        .where({name: 'canhazscript'})
        .then(function (val) {
          throw new Error('should not be fulfilled')
        }, function (err) {
          err.should.be.instanceof(Error)
        })
        .then(done, done)
    })
    it('first defaults if no match but default given', function (done) {
      db.from(collection)
        .firstOrDefault({isDefault: true})
        .where({name: 'C+++'})
        .then(function (val) {
          val.isDefault.should.equal(true)
        })
        .then(done, done)
    })
  })

})
var raw = require('./data.json').result
function testData(db, collection) {
  return Promise.all(raw.map(function (doc) {
    return db.from(collection).insert(doc)
  }))
  .then(function(){ })
}