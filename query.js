var deepClone = require('clone')
var util = require('./util')
var charybdis = require('charybdis')
var toString = require('to-string')

var Query = module.exports = function Query (db) {
  this._ = {
    db: db,
    collection: null,
    command: 'read',
    query: {},
    options: {
      safe: true
    }
  }
}

var proto = Query.prototype

// initializers
proto.clone = function () {
  var q = new Query(this._.db)
  q._.collection = this._.collection
  q._.query = deepClone(this._.query)
  q._.options = deepClone(this._.options)
  return q
}

// Query
proto.from = function (collection) {
  this._.collection = collection
  return this
}
proto.where = function (clause) {
  this._.query = util.extend(this._.query, clause)
  return this
}

proto.not = function (key) {
  var obj = {}
  obj[key] = {$in: [false, null, undefined, 0]}
  this.where(obj)
  return this
}

proto.select = function (projection) {
  // accept arrays of field names to include (dot-notation ok)
  if (Array.isArray(projection)) {
    return this.select(projection.reduce(function (projection, field) {
        projection[field] = true
        return projection
      }, {}))
  }

  this._.options.fields = projection
  return this
}
proto.limit = function (number) {
  this._.options.limit = number
  return this
}
proto.skip = function (number) {
  this._.options.skip = number
  return this
}
proto.sort = function (sort) {
  this._.options.sort = sort
  return this
}
proto.options = function (options) {
  this._.options = util.extend(this._.options, options)
  return this
}
// returns scalar result rather than collection
proto.first = function () {
  this._.first = true
  this.limit(1)
  return this
}

// returns scalar result rather than collection
proto.firstOrDefault = function (defaultValue) {
  this._.first = true
  this._._default = defaultValue
  this.limit(1)
  return this
}

proto.byId = function (id) {
  var oid = Query.ObjectId(id)
  return this
    .where({_id: oid})
    .first()
}
proto.byIds = function (ids) {
  if (!Array.isArray(ids)) {
    this.error = new TypeError('ids must be an Array')
    return this
  }
  var oids = ids.map(Query.ObjectId)
  return this
    .where({_id: {$in: oids }})
    .limit(ids.length)
}

proto.count = command('count')
proto.exists = command('exists')
proto.aggregate = command('aggregate')

// finalizers
proto.assert = function (assertion, message) {
  if (message) {
    assertion.message = message
  }
  this._.assertion = assertion
  return this
}

proto.expect = function (quantity) {
  if (typeof quantity !== 'number' || !Number.isFinite(quantity)) {
    this.error = new TypeError('quantity must be a number')
    return this
  }
  return this.assert(function (result) {
    return result &&
      (result.length ? (quantity === result.length) : quantity === 1)
  }, 'Expected ' + quantity + ' result' + (quantity === 1 ? '' : 's'))
}

var _checkAssertion = function (assertion) {
  if (!assertion) { return function (x) { return x }}
  return function (val) {
    if (!assertion(val)) {
      throw new Error('Assertion failure: ' + assertion.message || assertion.name || assertion)
    }
    return val
  }
}

proto.val = function () {
  return this._.db.run(this._)
    .then(_checkAssertion(this._.assertion))
}

// forcers
// fetch result set as promise (for lazy query)
proto.then = function (fulfill, reject) {
  // TODO: guard for db

  return this.val()
    .then(fulfill, reject)
}
// fetch result set as stream
proto.pipe = function (sink) {
  // TODO: guard for db
  this._.command = 'read'
  return this._.db.runAsStream(this._).pipe(sink)
}
// do charybdis magic
proto.forEach = function (iterator) {
  // TODO: guard for db, iterator is fn
  this._.command = 'read'
  return this._.db.runAsStream(this._).pipe(charybdis(iterator))
}

// mutators
proto.insert = mutatorCommand('insert')
proto.update = mutatorCommand('update')
proto.findAndModify = mutatorCommand('findAndModify')
proto.modifyAndFind = mutatorCommand('modifyAndFind')
proto.pull = mutatorCommand('pull')
proto.upsert = mutatorCommand('upsert')
proto.remove = mutatorCommand('remove')
proto.removeAll = mutatorCommand('removeAll')

function command (name) {
  var fn = function (arg) {
    this._.command = name
    this._.commandArg = arg
    return this
  }
  fn.name = name
  return fn
}

function mutatorCommand (name) {
  var fn = function (arg) {
    this._.command = name
    this._.commandArg = arg
    return this.val()
  }
  fn.name = name
  return fn
}

Query.ObjectId = function (oid) {
  var type = typeof oid
  if (type === 'string') {
    return {$oid: oid}
  }
  if (type === 'object' && oid.$oid) {
    return oid
  }

  return {$oid: toString(oid)}
}
