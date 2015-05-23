var toString = require('to-string')

module.exports.extend = function extend (obj, obj2) {
  for (var key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      obj[key] = obj2[key]
    }
  }
  return obj
}

var objIdPattern = /^[0-9a-fA-F]{24}$/
var isObjectId = function (alleged) {
  return (!!alleged && objIdPattern.test(toString(alleged)))
}

module.exports.isObjectId = isObjectId
