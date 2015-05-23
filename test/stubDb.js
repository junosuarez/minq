var sinon = require('sinon')

module.exports = function StubDb () {

  this.run = sinon.stub()
  this.runAsStream = sinon.stub()

}
