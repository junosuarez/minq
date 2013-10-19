var Q = require('q')
var sinon = require('sinon')

var StubDb = module.exports = function StubDb() {

  this.run = sinon.stub()
  this.runAsStream = sinon.stub()

}

var method = StubDb.prototype