var Promise = require('bluebird')
var DefaultStore = require('./mongodb')
var Query = require('./query')
var ObjectId = require('mongodb').ObjectID
var util = require('./util')
var toString = require('to-string')

var Minq = module.exports = function Minq (store) {
  if (typeof store !== 'object') {
    throw new TypeError('Missing required parameter: store')
  }
  var self = this
  this.store = store
  this.ready = Promise.resolve(this.store.ready)
    .then(this._initialize.bind(this))
    .then(function (store) {
      return self
    })

  //override Query.ObjectId
  Query.ObjectId = Minq.ObjectId
}

Minq.connect = function (connectionString, options) {
  var minq = new Minq(DefaultStore.connect(connectionString, options))
  return minq.ready
}

var proto = Minq.prototype

proto.disconnect = function () {
  return this.store.disconnect && Promise.resolve(this.store.disconnect()) || Promise.resolve()
}

proto._initialize = function () {
  var self = this
  return this.store.getCollectionNames().then(function (names) {
    names.forEach(function (name) {
      Object.defineProperty(self, name, {
        enumerable: true,
        get: function () {
          return self.from(name)
        }
      })
    })
  })
}

proto.from = function (collection) {
  var query = new Query(this.store)
  query.from(collection)
  return query
}

// (any) => String|ObjectId
Minq.ObjectId = function (id) {
  if (id instanceof ObjectId) {
    return id
  }
  var strId = toString(id)
  if (util.isObjectId(strId)) {
    return ObjectId(strId)
  }
  return strId
}

Minq.Query = Query