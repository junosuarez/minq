module.exports.extend = function extend(obj, obj2) {
  for (var key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      obj[key] = obj2[key]
    }
  }
  return obj
}