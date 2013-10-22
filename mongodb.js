var Q = require('q')
var stream = require('stream')
var through = require('through')

var MongoDb = module.exports = function MongoDb(db) {
  var self = this
  this.db = Q(db)
  this.ready = this.db.then(function (db) {
    self._db = db
    return true
  })
}

var proto = MongoDb.prototype

// (Query) => Promise
proto.run = function (query) {
  // todo: more robust query checking (valid commands, etc)
  switch(query.command) {
    case 'read':
    case 'count':
    case 'exists':
    case 'insert':
    case 'update':
    case 'findAndModify':
    case 'modifyAndFind':
    case 'pull':
    case 'upsert':
    case 'remove':
    case 'removeAll':
      return this['_' + query.command](query)
    default:
      return Q.reject(new Error('Unknown command:' + query.command))
  }
}

// (Query) => Stream
proto.runAsStream = function (query) {
  var err;
  if (!query || query.command !== 'read') {
    err = new Error('Query command must be "read"')
  }
  if (query && query.err) {
    err = query.err
  }

  var outStream = through(function (data) { this.queue(data) })

  if (err) {
    process.nextTick(function () {
      outStream.emit('error', err)
    })
    return outStream
  }

  this._find(query)
    .then(function (cursor) {
      cursor.toStream().pipe(outStream)
      outStream.end()
    })
    .then(null, function (err) {
      process.nextTick(function () {
        outStream.emit('error', err)
      })
    })

  return outStream
}

// (Query) => Promise
proto._read = function (query) {
  return this._find(query).then(function (cursor) {
    var results = Q.ninvoke(cursor, 'toArray')

    // handle expected scalar return value
    if (query.first) {
      results = results.then(function (val) {
        return val[0]
      })
    }
    return results
  })
}

// (Query) => Promise<MongoCursor>
proto._find = function(query) {
  return this._collection(query)
    .then(function (collection) {
      return Q.ninvoke(collection, 'find', query.query)
    })
}

// (Query) => Promise<MongoCollection>
proto._collection = function(query) {
  return this.db.then(function (db) {
    return db.collection(query.collection)
  })
}

// (Query) => Promise<Number>
proto._count = function (query) {
  return this._collection(query).then(function (collection) {
    return collection.count(query.query)
  })
}

// (Query) => Promise<Boolean>
proto._exists = function (query) {
  return this._count(query.query).then(function (count) {
    console.log('count', count)
    return count > 0
  })
}