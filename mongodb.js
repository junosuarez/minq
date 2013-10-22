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
    return count > 0
  })
}

// (Query) => Promise
proto._insert = function (query) {
  return this._collection(query).then(function (collection){
    return Q.ninvoke(collection, 'insert', query.commandArg, query.options)
  })
}

// (Query) => Promise
proto._update = function (query) {
  return this._collection(query).then(function (collection){

    var restoreId
    // mongodb doesn't allow a doc to be update with an _id property
    // so we convert it into a where clause.
    // Below, we restore it to the query before returning flow back to the
    // calling function. This is an optimization over copying the entire
    // document object, although immutability is what we really want.
    // By reattaching it after the underlying query but before resolving
    // the promise we can similuate immutability. It's threadsafe because JS.
    if (query.commandArg._id) {
      restoreId = query.commandArg._id
      delete query.commandArg._id
      query.query._id = restoreId
    }
    var op = Q.ninvoke(collection, 'update', query.query, query.commandArg, query.options)

    if (restoreId) {
      op = op.then(function (val) {
        query.commandArg._id = restoreId
        return val
      }, function (err) {
        query.commandArg._id = restoreId
        throw err
      })
    }

    return op
  })
}

// returns the document BEFORE the changes object has been applied
proto._findAndModify = function (query) {
  query.options.sort = query.options.sort || {_id: 1}
  query.options.new = false
  query.options.upsert = false
  return this._collection(query).then(function (collection) {
    return Q.ninvoke(collection, 'findAndModify', query.query, query.options.sort, query.commandArg, query.options)
  })
}

// returns the document AFTER the changes object has been applied
proto._modifyAndFind = function (query) {
  query.options.sort = query.options.sort || {_id: 1}
  query.options.new = true
  query.options.upsert = false
  return this._collection(query).then(function (collection) {
    return Q.ninvoke(collection, 'findAndModify', query.query, query.options.sort, query.commandArg, query.options)
  })
}

proto._pull = function (query) {
  return this._collection(query).then(function (collection) {
    return Q.ninvoke(collection, 'findAndRemove', query.query, query.options.sort, query.options)
  })
}

proto._upsert = function  (query) {
  query.query = query.query || {}
  query.options.upsert = true
  return this._collection(query).then(function (collection) {
    return Q.ninvoke(collection, 'update', query.query, query.commandArg, query.options)
  })
}

proto._remove = function (query) {
  if (!query.query || !Object.keys(query.query).length) {
    return new Q.reject(new Error('No `where` query specified. Use `removeAll` to remove all documents in a collection.'))
  }
  return this._collection(query).then(function (collection) {
    return Q.ninvoke(collection, 'remove', query.query, query.options)
  })
}

proto._removeAll = function (query) {
  return this._collection(query).then(function (collection) {
    return Q.ninvoke(collection, 'remove', query.options)
  })
}