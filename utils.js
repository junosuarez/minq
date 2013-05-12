var toString = require('to-string')

var objIdPattern = /^[0-9a-fA-F]{24}$/;
var isObjectId = function (alleged) {
  return (!!alleged && objIdPattern.test(toString(alleged)))
}

module.exports.isObjectId = isObjectId