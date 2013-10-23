var Q = require('q')
var DefaultProvider = require('./mongodb')
var Query = require('./query')

var Minq = module.exports = function Minq (provider) {
  if (typeof provider !== 'object') {
    throw new TypeError('Missing required parameter: provider')
  }
  var self = this
  this.provider = provider
  this.ready = Q(this.provider.ready)
    .then(this.initialize)
    .then(function (provider) {
      return self
    })

}

Minq.connect = function (connectionString, options) {
  var minq = new Minq(DefaultProvider.connect(connectionString, options))
  return minq.ready
}

var proto = Minq.prototype

proto.disconnect = function () {
  return this.provider.disconnect && Q(this.provider.disconnect()) || Q()
}

proto.initialize = function () {
  var self = this
  return this.provider.getCollectionNames().then(function (names) {
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
  var query = new Query(this.provider)
  query.from(collection)
  return query
}