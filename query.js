var deepClone = require('clone')
var util = require('./util')
var charybdis = require('charybdis')

var Query = module.exports = function Query(db){
  this._ = {
    db: db,
    collection: null,
    query: {},
    projection: null,
    options: {
      safe: true
    }
  }
}

var method = Query.prototype

// initializers
method.clone = function () {
  var q = new Query(this._.db)
  q._.collection = this._.collection
  q._.query = deepClone(this._.query)
  q._.projection = deepClone(this._.projection)
  q._.options = deepClone(this._.options)
  return q
}

// query
method.from = function (collection) {
  this._.collection = collection
  return this
}
method.where = function (clause) {
  this._.query = util.extend(this._.query, clause)
  return this
}
method.select = function select(projection) {
  // accept arrays of field names to include (dot-notation ok)
  if (Array.isArray(projection)) {
    this._.projection = projection.reduce(function (projection, field) {
      projection[field] = true
      return projection
    }, {})
  } else {
    this._.projection = projection
  }
  return this
}
method.limit = function (number) {
  this._.options.limit = number
  return this
}
method.skip = function (number) {
  this._.options.skip = number
  return this
}
method.sort = function (sort) {
  this._.options.sort = sort
  return this
}
method.options = function (options) {
  this._.options = util.extend(this._.options, options)
  return this
}
// returns scalar result rather than collection
method.first = function () {
  this._.first = true
  this.limit(1)
  return this
}
method.count = function () {
  this._.command = 'count'
  return this
}
method.exists = function () {
  this._.command = 'exists'
  return this
}
method.byId = function (id) {
  return this
    .where({_id: id})
    .first()
}
method.byIds = function (ids) {
  if (!Array.isArray(ids)) {
    return this.error = new TypeError('ids must be an Array')
  }
  return this
    .where({_id: {$in: ids}})
    .limit(ids.length)
}

// finalizers
method.assert = function (assertion) {
  this._.post = assertion
  return this
}

// forcers
// fetch result set as promise
method.then = function (fulfill, reject) {
  // TODO: guard for db
  return this._.db.run(this).then(fulfill, reject)
}
// fetch result set as stream
method.pipe = function (sink) {
  // TODO: guard for db
  return this._.db.runAsStream(this).pipe(sink)
}
// do charybdis magic
method.forEach = function (iterator) {
  // TODO: guard for db, iterator is fn
  return this._.db.runAsStream(this).pipe(charybdis(iterator))
}

// mutators
method.insert
method.update
method.findAndModify
method.modifyAndFind
method.pull
method.upsert
method.remove
method.removeAll
method.drop


