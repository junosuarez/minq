var Promise = require('bluebird')
var through = require('through')
var mongodb = require('mongodb')
var resourceError = require('resource-error')
var invoke = require('ninvoke')

var MongoDb = module.exports = function MongoDb (db) {
  var self = this
  this.db = Promise.resolve(db)
  this.ready = this.db.then(function (db) {
    self._db = db
    return self
  })
}

MongoDb.connect = function (connectionString, options) {
  // create new MongoDbProvider from new MongoClient
  var db = invoke(mongodb.MongoClient, 'connect',
    connectionString, options)
  return new MongoDb(db)
}

var proto = MongoDb.prototype

proto.disconnect = function () {
  return this.db.then(function (db) {
    var forceClose = true
    return invoke(db, 'close', forceClose)
  })
}

proto.getCollectionNames = function () {
  return this.db.then(function (db) {
    return invoke(db, 'collectionNames').then(function (names) {
      return names.map(function (name) {
        return name.name.replace(/^[^\.]*\./, '')
      })
    })
  })
}

proto.dropCollection = function (collectionName) {
  return this._collection({collection: collectionName})
    .then(function (collection) {
      return invoke(collection, 'drop')
    })
}

// (Query) => Promise
proto.run = function (query) {
  var self = this
  // todo: more robust query checking (valid commands, etc)
  switch (query.command) {
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
    case 'aggregate':
      return self._collection(query).then(function (collection) {
        return self['_' + query.command](collection, query)
      })
    default:
      return Promise.reject(new Error('Unknown command:' + query.command))
  }
}

// (Query) => Stream
proto.runAsStream = function (query) {
  var err
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
  var self = this
  self._collection(query).then(function (collection) {
    return self._find(collection, query)
      .then(function (cursor) {
        cursor.stream().pipe(outStream)
      })
  })
  .catch(function (err) {
    process.nextTick(function () {
      outStream.emit('error', err)
    })
  })

  return outStream
}

// (Query) => Promise
proto._read = function (collection, query) {
  return this._find(collection, query).then(function (cursor) {
    var results = invoke(cursor, 'toArray')

    // handle expected scalar return value
    if (query.first) {
      results = results.then(function (results) {
        if (results.length) {
          return results[0]
        }
        if ('_default' in query) {
          return query._default
        }
        throw new resourceError.NotFound(
          'Query returned no results and no default value specified: ' +
          query.collection + ' ' + JSON.stringify(query.query))
      })
    }
    return results
  })
}

// (MongoCollection, Query) => Promise<MongoCursor>
proto._find = function (collection, query) {
  query.options = query.options || {}
  query.options.fields = query.options.fields || {}
  return invoke(collection, 'find', query.query, query.options)
}

// (Query) => Promise<MongoCollection>
proto._collection = function (query) {
  return this.db.then(function (db) {
    return db.collection(query.collection)
  })
}

// (MongoCollection, Query) => Promise<Number>
proto._count = function (collection, query) {
  return invoke(collection, 'count', query.query)
}

// (MongoCollection?, Query) => Promise<Boolean>
proto._exists = function (collection, query) {
  return this._count(collection, query.query).then(function (count) {
    return count > 0
  })
}

// (Query) => Promise
proto._aggregate = function (collection, query) {
  if (!Array.isArray(query.commandArg)) {
    return Promise.reject(new TypeError('Argument must be an array'))
  }
  return invoke(collection, 'aggregate', query.commandArg, query.options)
}

// (Query) => Promise
proto._insert = function (collection, query) {
  return invoke(collection, 'insert', query.commandArg, query.options)
}

// (Query) => Promise
proto._update = function (collection, query) {
  return invoke(collection, 'update',
    query.query, query.commandArg, query.options)
}

// returns the document BEFORE the changes object has been applied
proto._findAndModify = function (collection, query) {
  query.options.sort = query.options.sort || {_id: 1}
  query.options.new = false
  query.options.upsert = false

  return invoke(collection, 'findAndModify',
    query.query, query.options.sort, query.commandArg, query.options)
}

// returns the document AFTER the changes object has been applied
proto._modifyAndFind = function (collection, query) {
  query.options.sort = query.options.sort || {_id: 1}
  query.options.new = true
  query.options.upsert = false

  return invoke(collection, 'findAndModify',
    query.query, query.options.sort, query.commandArg, query.options)
}

proto._pull = function (collection, query) {
  return invoke(collection, 'findAndRemove',
    query.query, query.options.sort, query.options)
}

proto._upsert = function (collection, query) {
  query.query = query.query || {}
  query.options.upsert = true
  return invoke(collection, 'update',
    query.query, query.commandArg, query.options)
}

proto._remove = function (collection, query) {
  if (!query.query || !Object.keys(query.query).length) {
    return Promise.reject(
      new resourceError.Invalid('No `where` query specified. ' +
        'Use `removeAll` to remove all documents in a collection.'))
  }

  return invoke(collection, 'remove', query.query, query.options)
}

proto._removeAll = function (collection, query) {
  return invoke(collection, 'remove', query.options)
}
