# minq
fluent queries for mongodb using promises

## installation

    $ npm install minq

## usage example
```js
var Minq = require('minq')

Minq.connect(connectionString).then(function (db) {})

db.from('foo')
  .where({name: /John/i})
  .select(['name', 'email', 'homeAddress.zipCode'])
  .limit(1000)
// => Promise<Array>

db.from('foo')
  .skip(20)
  .limit(50)
  .sort('name')
// => Promise<Array>
```
As a bonus, convenience collection accessors are added to the `db` object:
```js
db.foo
// equivalent to db.from('foo')
```

To return a scalar (single) value:
```js
db.foo.first().then(function (aFoo) {
  console.log(aFoo
})
```

We can end a query by `.pipe`ing to a stream:
```js
db.foo.pipe(process.stdout)
```

Or we can enumerate over a query in a streaming fashion, with a promise to
indicate when the whole stream is done (including processing other tasks):
```js
db.spiders
  .where({scary: false})
  .forEach(function (spider) {
    return db.spiders
      .byId(spider._id)
      .update({$set:{scary: true}})
  })
  .then(function () {
    console.log('Fixed some misinformation about some spiders!')
  })
```

Other commands:
```js
db.foo
  .where({email: /lol\.com$/)
  .count()
// => Promise<Number>

db.foo
  .insert({name: 'Melissa', email: 'm@m.com'})
// => Promise

db.foo
  .upsert({_id: 15, name: 'Cian'})
// => Promise
```

## tools
- test harness with [rope](https://github.com/jden/rope)
- CLI repl with [minq-repl](https://github.com/jden/minq-repl)

## good to know

Minq queries are contstructed starting with a db and collection, then by adding
various options and constraints.

Minq queries implement the [Promises/A+](https://github.com/promises-aplus/promises-spec) interface - that is, you get the asynchronous value of the query results by calling the `.then()` method.

Read queries can also be treated as a Node.js stream, using the `.pipe()` method.
If an error occurs when building or executing the query, it will be sent as a
stream error. Streaming is useful when dealing with a large number of query
results.



## api reference

- Minq
  - .connect()
  - #ready
  - #disconnect
  - #from()

- Query
  - #clone()
  - #from()
  - #where()
  - #not()
  - #select()
  - #limit()
  - #skip()
  - #sort()
  - #options()
  - #first()
  - #firstOrDefault()
  - #byId()
  - #byIds()
  - #count()
  - #exists()
  - #aggregate()
  - #assert()
  - #expect()
  - #then()
  - #pipe()
  - #forEach()
  - #insert()
  - #update()
  - #findAndModify()
  - #modifyAndFind()
  - #pull()
  - #upsert()
  - #remove()
  - #removeAll()

Uses [jsig](https://github.org/jden/jsig) notation. `Object.Function` denotes
a function available on the constructor. `Object#Method` denotes a method
on a particular instance of Object.

## `new Minq(MinqStore?) => instanceof Minq`
`MinqStore` is an interface for Minq storage engines. By default, uses
MongoDb node native driver. You can supply your own for other use cases,
like testing or memory-backed stores. Currently the best documentation for
`MinqStore` interface is in the `mongodb.js` and `test/mongodb.test.js`
files.

### `Minq.connect(connectionString: String) => Promise<instanceof Minq>)`
*This is the recommended way to create and work with Minq in most cases.*
A factory function to create a new MongoDb connection and wrap it in a Minq
object. `connectionString` should be a [MongoDb uri](http://docs.mongodb.org/manual/reference/connection-string/)

Example:
```js
var Minq = require('minq')

Minq.connect('mongodb://localhost/mydb').then(function (minq) {
  // we now have an active db connection
  ...
})
```

Once the db connection is established, the Minq instance has property
getters for each collection, similar to the `db` object in the MongDb shell:

```js
minq.myCollection.first()

// is equivalent to

minq.from('myCollection').first()
```

### `Minq#from(collectionName : String) => instanceof Query`
Begins a new `Query` builder object in the context of the current active
`MongoStore`. *This is the recommended way to create queries.*

### `Minq#store : MinqStore`
Accessor property for the current active `MinqStore`.


## `new Query(store : MongoStore) => instanceof Query`
*The recommended way to create a `Query` is `Minq#from()` (see above)*
Creates a new query in the context of `store`.

`Query`s are the basic API for interacting with a database in Minq.
The syntax is meant to by fluent (chained), and the names of the commands
are inspired by SQL.

Partial `Query` objects can be passed around to different parts of a program.
For example, one function might add a `where` clause, and another might
handle the `select` projection, while a third might deal with `sort` or `skip`.

`Query`s are executed when they produce a side effect (in the case of a write
query, like `update`) or their value is accessed. Consider:

```js
var Minq = require('minq')
Minq.connect('mongodb://localhost/db').then(function (minq) {
  var query = minq.from('users')
                  .where({email: 'do-not-reply@zombo.com'})
                  .first()
  // the query has not yet been evaluated
  query.then(function (user) {
    // when the query is accessed via `then`, it forces evaluation of the query
    ...
  })
})
```

Read queries will always return a set of results, unless `.first()` is specified.

Result sets can be used as a Promise<Array> using `then`, a ReadableStream using
`pipe`, or by enumerating each result using `forEach`. See the documentation for
those methods.

### `Query#clone() => instanceof Query`

Deep clones a query object (most useful before the query has been executed!)

### `Query#from(collectionName: String) => Query`
Sets the collection name.

### `Query#where(query: Object) => Query`
`query` is a mongodb [query object](http://mongodb.github.com/node-mongodb-native/markdown-docs/queries.html#query-object), with standard `$` operators

`where` can be called multiple times to add multiple query terms. Mongodb joins
them with logical `AND`, see [$and](http://docs.mongodb.org/manual/reference/operator/and/#_S_and).

### `Query#not(property : String) => Query`
Adds to the `where` clause of a query, checking that a value is not JavaScript falsy.

Equivalent to `where({'property': {$nin: [undefined, null, false, 0]}})`.

### `Query#select(fields: Object|Array<String>) => Query`
`fields` is a mongodb projection object, with keys corresponding to the fields
of the document you want to return. `fields` can also be an array of strings
indicating the property names.

Example:
```
query.select(['a.b','c','d'])

// is equivalent to

query.select({
  'a.b': true,
  'c': true,
  'd': true
})
```

### `Query#options(opts: Object) => Query`
configure any additional options, for example [`{multi: true}`](http://docs.mongodb.org/manual/applications/update/#update-multiple-documents&gsc.tab=0)

### `Query#sort(by: Object|Array) => Query`
`by` is a mongodb [sort order](http://mongodb.github.com/node-mongodb-native/markdown-docs/queries.html#query-options) option.
alias: `Query#orderBy`

### `Query#limit(number: Number) => Query`
`number` is a Number for the maximum number of documents you want to return.
alias: `Query#take`

### `Query#skip(number: Number) => Query`
`number` is a Number for the number of documents which otherwise match the query
that you want to skip in the result

### `Query#first() => Query`
Specifies that a scalar (single document) return value is expected, rather than
a set of results. The query will error if no document is found.

### `Query#firstOrDefault(default: Object) => Query`
Specifies that a scalar (single document) return value is expected, rather than
a set of results. If no matching document is found, the `default` parameter
is used as the result.

### `Query.then(onFulfilled : Function, onRejected : Function) => Promise`
Forces query evaluation. Conforms to the [Promises/A+](http://promises-aplus.github.io/promises-spec/) interface.
Fulfilled with the result set as an Array (or a single object if `.first()` is
specified)

### `Query.pipe(WritableStream) => Stream`
Forces query evaluation. Conforms to the node ReadableStream interface.
Emits an object for each document in the result set. Only suitable for read
queries.


### `Query#forEach(iterator: (Object) => Promise?) => Promise`
Forces query evaluation. Only suitable for read queries.
Streams the results of a query. If `iterator` returns a promise, will await
each of the promises, for example if performing batch updates.

Returns a void Promise to rejoin program execution
once all results have been iterated.

Example:
```js
minq.from('users')
  .where({'canEmail': true})
  .select(['name','email'])
  .forEach(function (user) {
    // the hypothetical sendEmail function returns a promise
    return sendEmail({
      to: user.email,
      subject: 'Hi ' + user.name,
      body: 'Please ignore, just a test'
    })
  })
  .then(function () {
    // once all of the promises in the iterator have been fulfilled,
    // this function will be called
    console.log('done sending emails')
  }, function (err) {
    // if there is an error, this function will be called instead
    console.log('an unexpected error occured:', err)
  })
```

The implementation of `forEach` uses [`charybdis`](https://npm.im/charybdis) -
please refer to
that module's documentation for more info.

### `Query#insert(doc: Object) => Promise<Object>`
Insert a document collection. The promise is the inserted object, including _id
if assigned by db.

### `Query#update(changes: Object) => Promise<Number>`
Update documents in a collection with `changes`, a mongodb [setter or unsetter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update).
Use with `Query.where` or include `_id` on the `changes` object. The promise
is the count of updated documents.

### `Query#upsert(setter: Object) => Promise<Number>`
Create or update a document in a collection with `setter`, a mongodb [setter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update).
The promise is the count of updated documents.

### `Query#remove() => Promise<Number>`
Remove documents matching a `where` query. The promise is the number of
documents removed. Rejected if no `where` query is specified.

### `Query#removeAll() => Promise<Number>`
Remove all documents in a collection. The promise is the number of
documents removed.


## running the tests

    $ npm install
    $ npm test

As well, integration tests:

    $ sudo mongod
    $ npm run test-integration

## contributors

jden <jason@denizac.org>

## license
MIT. (c) MMXIII jden <jason@denizac.org>. See LICENSE.md.

<a href="http://promises-aplus.github.io/promises-spec/"><img src="https://secure.gravatar.com/avatar/1f78ca80239fd9154da65f3678b834c2?s=400&d=https://a248.e.akamai.net/assets.github.com%2Fimages%2Fgravatars%2Fgravatar-user-420.png" width="200" /></a>

<img src="http://upload.wikimedia.org/wikipedia/en/e/eb/MongoDB_Logo.png"/>