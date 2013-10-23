var Q = require('q')
var defaultProvider = require('./mongodb')

var Minq = module.exports = function Minq (provider) {
  var self = this
  this.provider = Q(provider)
  this.ready = this.provider.then(function (provider) {
    self._provider = provider
    return self
  })

}

function chop(x) {
  var y = Object.create(Minq.prototype)
  for (prop in x) {
    if (prop !== 'then') {
      y[prop] = x[prop]
    }
  }
  y.it = x
  return y
}

Minq.connect = function (connectionString, options) {
  var minq = new Minq(defaultProvider.connect(connectionString, options))
  return minq.ready
}

var proto = Minq.prototype