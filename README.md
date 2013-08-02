# minq
fluent queries for mongodb using promises

## installation

    $ npm install minq

## usage example

    var minq = require('minq')

    minq.connect(connectionString)

    minq
      .from('foo')
      .where({name: minq.like('John')})
      .select(['name', 'email', 'homeAddress.zipCode'])
      .limit(1000)
      .toArray()

    minq
      .from('foo')
      .skip(20)
      .limit(50)
      .sort('name')
      .toArray()

    minq
      .from('foo')
      .stream()

    minq
      .from('foo')
      .where({email: /lol\.com$/)
      .count()

    minq
      .from('foo')
      .insert({name: 'Melissa', email: 'm@m.com'})

    minq
      .drop('foo')

## tools
- test harness with [rope](https://github.com/jden/rope)
- CLI repl with [minq-repl](https://github.com/jden/minq-repl)

## good to know

minq queries are contstructed starting with a db and collection, then by adding various options and constraints, and ending with a finalizer. Finalizers return a [Q promise](https://npmjs.org/package/q).

For `.one` and `.toArray`, an .`expect(number)` option can be used. If the query does not match the expected number, the promise will be rejected.

Read Finalizers are: `.toArray` `.one` `.stream` `.count` `.assertExists` `.checkExists`

Note, `.stream` returns a node Stream, not a promise

Mutator Finalizers are: `.insert` `.update` `.upsert` `.remove` `.removeAll` `.pull` `.findAndModify`

## api reference

Uses [jsig](https://github.org/jden/jsig) notation.

### `minq(db: Object) => Query`
where db is a [mongodb db connection](http://mongodb.github.com/node-mongodb-native/api-generated/db.html) object

### `minq.like(pattern: String) => RegExp`
builds a RegExp for use with a where clause, `minq.like` helps by escaping characters for you. It creates a case-insensitive regex. See [like](https://npm.im/like)

### `minq.connect(connectionString: String) => Promise`
Set the default connection for minq to use. `connectionString` should be a [MongoDb uri](http://docs.mongodb.org/manual/reference/connection-string/)

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

### `Query.deferToArray => () => Promise<Array>`
[Thunked](http://en.wikipedia.org/wiki/Thunk_(functional_programming)) `Query.toArray`.

### `Query.deferOne => () => Promise<Object>`
[Thunked](http://en.wikipedia.org/wiki/Thunk_(functional_programming)) `Query.one`. Other Finalizers begin executing a query immediately. This method returns a function which can be called to invoke a query and return a promise of the response. This can be useful for memoized caching and other situations.

### `Query.stream() => ReadStream<Object>`
Read Finalizer. The stream is a mongo [read stream](http://mongodb.github.com/node-mongodb-native/api-generated/cursorstream.html) of documents matching your query.

### `Query.insert(doc: Object) => Promise<Object>`
Mutator Finalizer. Insert a document collection. The promise is the inserted object, including _id if assigned by db.

### `Query.update(changes: Object) => Promise<Number>`
Mutator Finalizer. Update documents in a collection with `changes`, a mongodb [setter or unsetter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update). Use with `Query.where` or include `_id` on the `changes` object. The promise is the count of updated documents.

### `Query.upsert(setter: Object) => Promise<Number>`
Mutator Finalizer. Create or update a document in a collection with `setter`, a mongodb [setter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update). The promise is the count of updated documents.

### `Query.remove() => Promise<Number>`
Mutator Finalizer. Remove documents matching a `where` query. The promise is the number of documents removed. Rejected if no `where` query is specified.

### `Query.removeAll() => Promise<Number>`
Mutator Finalizer. Remove all documents in a collection. The promise is the number of documents removed.

### `Query.drop(collection: String) => Promise`
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