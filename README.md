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

Or we can enumerate over a query in a streaming fashion, with a promise to indicate when the whole stream is done (including processing other tasks):
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

Other commands:
```
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

Minq queries are contstructed starting with a db and collection, then by adding various options and constraints.

Minq queries implement the [Promises/A+](https://github.com/promises-aplus/promises-spec) interface - that is, you get the asynchronous value of the query results by calling the `.then()` method.

Read queries can also be treated as a Node.js stream, using the `.pipe()` method. If an error occurs when building or executing the query, it will be sent as a stream error. Streaming is useful when dealing with a large number of query results.



## api reference

- Minq
  - .connect()
  - #ready
  - #disconnect
  -
- Minq.Query


Uses [jsig](https://github.org/jden/jsig) notation.

### `minq(db: Object) => Query`
where db is a [mongodb db connection](http://mongodb.github.com/node-mongodb-native/api-generated/db.html) object

### `minq.like(pattern: String) => RegExp`
builds a RegExp for use with a where clause, `minq.like` helps by escaping characters for you. It creates a case-insensitive regex. See [like](https://npm.im/like)

### `minq.connect(connectionString: String) => Promise<MinqDb>`
Set the default connection for minq to use. `connectionString` should be a [MongoDb uri](http://docs.mongodb.org/manual/reference/connection-string/)

```
type MinqDb : {
  $collectionName: Query
}
```

MinqDb is an object with property getters for each collection, similar to the `db` object in `mongoshell`.

Example:

```js
minq.connect(cs).then(function (db) {
  return db.users.where({email: /@gmail.com$/}).toArray()
})
```

### `minq.getCollections() => Promise<Array<String>>`
Returns a promise for an array of strings containing the collection names for the default connection.

### `Query#clone() => Query`

Deep clones a query object (most useful before the query has been executed!)

### `Query#from(collectionName: String) => Query`
returns a new Query object configured with the collection name.
alias: `Query#collection`

### `Query#where(query: Object) => Query`
(optional) `query` is a mongodb [query object](http://mongodb.github.com/node-mongodb-native/markdown-docs/queries.html#query-object), with standard `$` operators

`where` can be called multiple times to add multiple query terms. Mongodb joins them with logical `AND`, see [$and](http://docs.mongodb.org/manual/reference/operator/and/#_S_and).

### `Query#select(fields: Object) => Query`
(optional) `fields` is a mongodb projection object, with keys corresponding to the fields of the document you want to return

### `Query#options(opts: Object) => Query`
(optional) configure any additional options, for example [`{multi: true}`](http://docs.mongodb.org/manual/applications/update/#update-multiple-documents&gsc.tab=0)

### `Query#sort(by: Object|Array) => Query`
(optional) `by` is a mongodb [sort order](http://mongodb.github.com/node-mongodb-native/markdown-docs/queries.html#query-options) option.
alias: `Query#orderBy`

### `Query#limit(number: Number) => Query`
(optional) `number` is a Number for the maximum number of documents you want to return.
alias: `Query#take`

### `Query#skip(number: Number) => Query`
(optional) `number` is a Number for the number of documents which otherwise match the query that you want to skip in the result

### `Query#toArray() => Promise<Array>`
Read Finalizer. The promise is resolved with the array of documents matching your query or an empty array.

### `Query#one() => Promise<Object>`
Read Finalizer. The promise is resolved with the document matching your query or `null`.
alias: `Query#first`, `Query#firstOrDefault`. Note, `first` does not throw on null, unlike in linq. Think of it as `firstOrDefault`.

### `Query#deferToArray => () => Promise<Array>`
[Thunked](http://en.wikipedia.org/wiki/Thunk_(functional_programming)) `Query.toArray`.

### `Query#deferOne => () => Promise<Object>`
[Thunked](http://en.wikipedia.org/wiki/Thunk_(functional_programming)) `Query.one`. Other Finalizers begin executing a query immediately. This method returns a function which can be called to invoke a query and return a promise of the response. This can be useful for memoized caching and other situations.

### `Query#stream() => ReadStream<Object>`
Read Finalizer. The stream is a mongo [read stream](http://mongodb.github.com/node-mongodb-native/api-generated/cursorstream.html) of documents matching your query.

### `Query#forEach(iterator: (Object) => Promise?) => Promise`
Read Finalizer. Streams the results of a query. If `iterator`
returns a promise, will await each of the promises,
for example if performing batch updates.
Returns a void Promise to rejoin program execution
once all results have been iterated.

### `Query#insert(doc: Object) => Promise<Object>`
Mutator Finalizer. Insert a document collection. The promise is the inserted object, including _id if assigned by db.

### `Query#update(changes: Object) => Promise<Number>`
Mutator Finalizer. Update documents in a collection with `changes`, a mongodb [setter or unsetter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update). Use with `Query.where` or include `_id` on the `changes` object. The promise is the count of updated documents.

### `Query#upsert(setter: Object) => Promise<Number>`
Mutator Finalizer. Create or update a document in a collection with `setter`, a mongodb [setter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update). The promise is the count of updated documents.

### `Query#remove() => Promise<Number>`
Mutator Finalizer. Remove documents matching a `where` query. The promise is the number of documents removed. Rejected if no `where` query is specified.

### `Query#removeAll() => Promise<Number>`
Mutator Finalizer. Remove all documents in a collection. The promise is the number of documents removed.

### `Query#drop(collection: String) => Promise`
Finalizer. Drop an entire collection.

## running the tests

    $ npm install
    $ npm test

## contributors

jden <jason@denizac.org>

## license
MIT. (c) jden <jason@denizac.org>. See LICENSE.md.

<a href="http://promises-aplus.github.io/promises-spec/"><img src="https://secure.gravatar.com/avatar/1f78ca80239fd9154da65f3678b834c2?s=400&d=https://a248.e.akamai.net/assets.github.com%2Fimages%2Fgravatars%2Fgravatar-user-420.png" width="200" /></a>

<img src="http://upload.wikimedia.org/wikipedia/en/e/eb/MongoDB_Logo.png"/>