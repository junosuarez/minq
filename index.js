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
  expect: expect,
  //finalizers
  toArray: toArray,
  one: one,
  deferOne: deferOne,
  deferToArray: deferToArray,
  stream: stream,
  count: count,
  checkExists: checkExists,
  assertExists: assertExists,
  // mutators
  insert: insert,
  update: update,
  findAndModify: findAndModify,
  modifyAndFind: modifyAndFind,
  pull: pull,
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
  byIds: byIds,
  // static
  ObjectId: ObjectId,
  ObjectID: ObjectId,
  like: like
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
  this._.query = extend(this._.query, query)
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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()

  getCursor(self, function (err, cursor) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('toArray')
    cursor.toArray(function (err, array) {
      if (err) { return dfd.reject(err) }
      var actualCount = array ? array.length : 0
      if (typeof self._.expected === 'number' && self._.expected !== actualCount) {
        return dfd.reject(new Error('Expected ' + self._.expected + ' document' + (self._.expected === 1 ? '' : 's') +', but matched ' + actualCount))
      }
      dfd.resolve(array || [])
    })
  })

  return dfd.promise
}

// @return Promise<Object>
function one() {
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()

  self._.options.limit = 1

  getCursor(self, function (err, cursor) {
    if (err) { return dfd.reject(err) }
    log(self._.options)
    log('one')
    cursor.nextObject(function (err, doc) {
      if (err) { return dfd.reject(err) }
      var actualCount = doc ? 1 : 0;
      if (typeof self._.expected === 'number' && self._.expected !== actualCount) {
        return dfd.reject(new Error('Expected ' + self._.expected + ' document' + (self._.expected === 1 ? '' : 's') +', but matched ' + actualCount))
      }
      dfd.resolve(doc || null)
    })
  })

  return dfd.promise
}

// @return Stream
function stream() {
  var stream = through(function (data) { this.queue(data) })
  var self = this
  if (self._.err) {
    stream.emit('error', self._.err)
    return stream
  }


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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()

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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()

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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()
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
// @returns Promise<Document> - the document BEFORE the changes object has been applied
function findAndModify(changes) {
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  return Q.promise(function (resolve, reject) {
    self._.options.new = false
    self._.options.updsert = false

    getColection(self, function (err, collection) {
      if (err) { return reject(err) }
      log(self._.options)
      log('findAndModify', self._.query, changes)
      collection.findAndModify(self._.query, self._.options.sort, changes, self._.options, function (err, result) {
        if (err) { return reject(err) }
        resolve(result)
      })
    })
  })
}

// @param changes Object - a mongodb setter/unsetter
// @returns Promise<Document> - the document AFTER the changes object has been applied
function modifyAndFind(changes) {
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  return Q.promise(function (resolve, reject) {
    self._.options.new = true
    self._.options.updsert = false

    getColection(self, function (err, collection) {
      if (err) { return reject(err) }
      log(self._.options)
      log('findAndModify', self._.query, changes)
      collection.findAndModify(self._.query, self._.options.sort, changes, self._.options, function (err, result) {
        if (err) { return reject(err) }
        resolve(result)
      })
    })
  })
}


// @returns Promise<Document> - the matching document which was removed
// from the collection
function pull() {
  var self = this
  if (self._.err) { return Q.reject(self._.err) }
  return Q.promise(function (resolve, reject) {
    self._.options.remove = true
    getCollection(self, function (err, collection) {
      if (err) { return reject(err) }
      log(self._.options)
      log('pull', self._.query)
      collection.findAndModify(self._.query, self._.options.sort, {}, self._.options, function (err, result) {
        if (err) { return reject(err) }
        resolve(result)
      })
    })
  })
}

// @returns Query
function expect(count) {
  this._.expected = count
  return this
}

// @returns Promise. Rejected if the number of results does not match the expected count
function assertExists(expectedCount) {
  var self = this
  return self.checkExists(expectedCount).then(function (exists) {
    if (!exists) {
      throw new Error('Expected ' + expectedCount + ' document' + (expectedCount !== 1 ? 's' : '') +
        ', but found ' + self._.count)
    }
  })
}

// @returns Promise<Boolean> - true iff number of results matches the expected count
function checkExists(expectedCount) {
  expectedCount = expectedCount || 1
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }

  return Q.promise(function (resolve, reject) {
    getCursor(self, function (err, cursor) {
      if (err) { return reject(err) }
      log(self._.options)
      log('checkExists', self._.expected, self._.query)
      cursor.count(function (err, count) {
        if (err) { return reject(err) }
          self._.count = count
        return count === expectedCount
      })
    })
  })
}

// @param changes Object - a mongodb setter/unsetter
// @return Promise<Number> - count of updated documents
function upsert(setter) {
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()
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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  if (Object.keys(self._.query).length === 0) {
    return Q.reject(new Error('No `where` query specified. Use minq.removeAll to remove all documents.'))
  }
  var dfd = Q.defer()
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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()
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
  var self = this
  if (self._.err) {
    return Q.reject(self._.err)
  }
  var dfd = Q.defer()
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
    this._.err = new Error('id must not be blank')
    return this
  }

  this.where({_id: ObjectId(id) })
  return this
}

function byIds(ids) {
  if (!Array.isArray(ids)) {
    this._.err = new Error('ids must be an Array')
    return this
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

function extend(obj, obj2) {
  for (var key in obj2) {
    if (obj2.hasOwnProperty(key)) {
      obj[key] = obj2[key]
    }
  }
  return obj
}

module.exports.use = function (plugin) {
  plugin(module.exports)
}