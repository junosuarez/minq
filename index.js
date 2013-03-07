var Q = require('q')
var through = require('through')
var mongodb = require('mongodb')
var maskurl = require('maskurl')
var quotemeta = require('quotemeta')

var connection

function Query(db, collection) {
  if (!(this instanceof Query)) {
    return new Query(db, collection)
  }

  this._ = {
    db: db || connection,
    collection: collection,
    query: {},
    projection: null,
    options: {
      safe: true
    }
  }
}

Query.prototype = {
  // query
  collection: collection,
  where: where,
  // options
  select: select,
  sort: sort,
  limit: limit,
  skip: skip,
  //finalizers
  toArray: toArray,
  one: one,
  deferOne: deferOne,
  deferToArray: deferToArray,
  stream: stream,
  count: count,
  // mutators
  insert: insert,
  update: update,
  upsert: upsert,
  remove: remove,
  removeAll: removeAll,
  drop: drop,
  // linq aliases
  from: collection,
  take: limit,
  orderBy: sort,
  first: one, // note, does not throw (unlike linq), equivalent to firstOrDefault
  firstOrDefault: one,
  // convenience
  byId: byId,
  byIds: byIds
}

// deferred
// returns a function which executes the query
// *thunk*
function deferOne() {
  var self = this;
  return function () {
    return self.one()
  }
}

function deferToArray() {
  var self = this;
  return function () {
    return self.toArray()
  }
}

// query
//

// @param collection String
function collection(collection) {
  return new Query(this._.db, collection)
}

// @param query Object
function where(query) {
  this._.query = query
  return this
}

// options
//

// @param projection Object
function select(projection) {
  this._.projection = projection
  return this
}

// @param sort Object
function sort(sort) {
  this._.options.sort = sort
  return this
}

// @param limit Number
function limit(limit) {
  this._.options.limit = limit
  return this
}

// @param skip Number
function skip(skip) {
  this._.options.skip = skip
  return this
}

// finalizers
//

// @return Promise<Array>
function toArray() {
  var dfd = Q.defer()
  var self = this

  getCursor(self, function (err, cursor) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('toArray')
    cursor.toArray(function (err, array) {
      if (err) { return dfd.reject(err) }
        dfd.resolve(array || [])
    })
  })

  return dfd.promise
}

// @return Promise<Object>
function one() {
  var dfd = Q.defer()
  var self = this

  self._.options.limit = 1

  getCursor(self, function (err, cursor) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('one')
    cursor.nextObject(function (err, doc) {
      if (err) { return dfd.reject(err) }
        dfd.resolve(doc || null)
    })
  })

  return dfd.promise
}

// @return Stream
function stream() {
  var stream = through(function (data) { this.queue(data) })
  var self = this

  getCursor(self, function (err, cursor) {
    if (err) {
      stream.emit('error', err)
      stream.emit('end')
      return;
    }
    log(self._.options)
    log('streaming...')
    cursor.stream().pipe(stream)
    stream.on('end', function () { log('stream end')})
  })

  return stream
}

// @return Promise<Number>
function count() {
  var dfd = Q.defer()
  var self = this

  getCursor(self, function (err, cursor) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('count')
    cursor.count(function (err, count) {
      if (err) { return dfd.reject(err) }
      dfd.resolve(count)
    })
  })

  return dfd.promise
}

// mutators
//

// @param doc Object|Array<Object>
// @return Promise<Object>|Promise<Array<Object>>
function insert (doc) {
  var dfd = Q.defer()
  var self = this

  getCollection(self, function (err, collection) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('insert', doc)
    collection.insert(doc, self._.options, function (err, result) {
      if (err) { return dfd.reject(err) }
      dfd.resolve(result)
    })
  })

  return dfd.promise
}

// @param changes Object - a mongodb setter/unsetter
// @return Promise<Number> - count of updated documents
function update(changes) {
  var dfd = Q.defer()
  var self = this
  var restoreId = false


  self._.options.upsert = false
  self._.options['new'] = true

  if ('_id' in changes) {
    self._.query._id = restoreId = changes._id
    delete changes._id
  }

  getCollection(self, function (err, collection) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('update', changes)
    collection.update(self._.query, changes, self._.options, function (err, result) {
      if (err) { dfd.reject(err) }
      if (restoreId) { setter._id = restoreId }
      dfd.resolve(result)
    })
  })

  return dfd.promise
}

// @param changes Object - a mongodb setter/unsetter
// @return Promise<Number> - count of updated documents
function upsert(setter) {
  var dfd = Q.defer()
  var self = this
  var restoreId = false

  self._.options.upsert = true

  if ('_id' in setter) {
    self._.query._id = restoreId = setter._id
    delete setter._id
  }

  getCollection(self, function (err, collection) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('upsert', setter)
    collection.update(self._.query, '_id', changes, self._.options, function (err, result) {
      if (err) { dfd.reject(err) }
      if (restoreId) { setter._id = restoreId }
      dfd.resolve(result)
    })
  })

  return dfd.promise
}

// Removes documents matching the `where` query from a collection
// @return Promise<Number> - count of removed documents
function remove() {
  if (Object.keys(this._.query).length === 0) {
    return Q.reject('No `where` query specified. Use minq.removeAll to remove all documents.')
  }
  var dfd = Q.defer()
  var self = this
  log(self._.options)
  log('remove')

  getCollection(self, function (err, collection) {
    collection.remove(self._.query, self._.options, function (err, count) {
      if (err) { return dfd.reject(err) }
      dfd.resolve(count)
    })
  })

  return dfd.promise
}

// Removes all documents from a collection
// @return Promise<Number> - count of removed documents
function removeAll() {
  var dfd = Q.defer()
  var self = this
  log('removeAll')

  getCollection(self, function (err, collection) {
    collection.remove(self._.options, function (err, count) {
      if (err) { return dfd.reject(err) }
      dfd.resolve(count)
    })
  })

  return dfd.promise
}

// Drops an entire collection
// @return Promise
function drop(collection) {
  var dfd = Q.defer()
  var self = this
  log('drop')

  if (collection) {
    self._.collection = collection
  }

  getCollection(self, function (err, collection) {
    collection.drop(function (err, result) {
      if (err) { return dfd.reject(err) }
      dfd.resolve(result)
    })
  })

  return dfd.promise
}

// helpers

function getCollection(self, cb) {
  Q.when(self._.db, function (db) {
    if (!self._.collection) {
      cb(new ArgumentError('Collection must be specified'))
    }
    try {
      db.collection(self._.collection, function (err, collection) {
        if (err) { return cb(err) }
        log('from ', self._.collection)
        return cb(null, collection)
      })
    } catch (e) {
      if (!db) { cb(new Error('db not specified'))}
      cb(e)
    }
  })
}

function getCursor(self, cb) {
  Q.when(self._.db, function (db) {
    try{
      db.collection(self._.collection, function (err, collection) {
        if (err) { return cb(err) }
        var q = [self._.query]
        if (self._.projection) {
          q.push(self._.projection)
        } else {
          q.push({}) // select all
        }
        q.push(self._.options)
        log('from ', self._.collection)
        log('where ', q[0])
        if (self._.projection) { log('select ', q[1]) }
        cb(null, collection.find.apply(collection, q))
      })
    } catch (e) {
      if (!db) { cb(new Error('db not specified'))}
      cb(e)
    }
  })
}

module.exports = Query

// contextual constructor
// @param collection String
module.exports.from = module.exports.collection = function (collection) {
  return new Query(connection, collection)
}

module.exports.drop = function (collection) {
  return module.exports.collection(collection).drop()
}

module.exports.getCollections = function () {
  return Q.when(connection).then(function (db) {
    var dfd = Q.defer()

    db.collectionNames(function (err, names) {
      if (err) { return dfd.reject(err) }
      try {
        names = names.map(function (x) { return x.name.replace(/^\w*\./, '') })
        dfd.resolve(names)
      } catch (e) {
        return dfd.reject(e)
      }
    })

    return dfd.promise
  })
}

// convenience
module.exports.connect = connect

function ObjectId(id) {
  if (this instanceof ObjectId || typeof id === 'string') {
    return new mongodb.ObjectID(id)
  }
  if (typeof id === 'object') {
    return new mongodb.ObjectID(id.toString())
  }
  return new mongodb.ObjectID()
}

function byId(id) {
  if (!id) {
    return Q.reject(new Error('id must not be blank'))
  }

  this.where({_id: ObjectId(id) })
  return this
}

function byIds(ids) {
  if (!Array.isArray(ids)) {
    return Q.reject(new Error('ids must be an Array'))
  }

  this.where({_id: {$in: ids.map(ObjectId)} })
  return this
}

module.exports.ObjectId = ObjectId
module.exports.ObjectID = ObjectId
module.exports.like = like

function like(string) {
  return new RegExp(quotemeta(string), 'i')
}



function log() {
  if (!module.exports.verbose) { return }
  var vals = Array.prototype.slice.call(arguments)
  vals.unshift('minq -')
  console.log.apply(console, vals)
}

// open and set the default db connection
// (global setting for all references to this module)
// @param connectionString  String   a mongodb connection string,
//         see http://docs.mongodb.org/manual/reference/connection-string/
// @param options   Object  MongoClient connection options
// @return Promise<Function>  returns a function which can be invoked to close the mongodb connection
//
// for argument syntax, see http://mongodb.github.com/node-mongodb-native/driver-articles/mongoclient.html
function connect(connectionString, options) {
  log('connecting to', maskurl(connectionString))

  return connection = Q.nfcall(
    mongodb.MongoClient.connect,
    connectionString,
    options
  ).then(function (db){
    log('connected')
    return connection = db;
  })

}

module.exports.use = function (plugin) {
  plugin(module.exports)
}