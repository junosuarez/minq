# minq
fluent queries for mongodb using promises

inspired by linq. WIP.

## installation

    $ npm install minq

## usage

    var db = myInitializedMongoDbConnection

    var minq = require('minq')(db)

    minq
      .collection('foo')
      .where({name: minq.like('John')})
      .select({name: 1, email: 1})
      .limit(1000)
      .toArray()

    minq
      .collection('foo')
      .skip(20)
      .limit(50)
      .sort('name')
      .toArray()

or, somewhat linq-ier:

    minq
      .from('foo')
      .skip(20)
      .take(50)
      .orderBy('name')
      .toArray()

    minq
      .collection('foo')
      .where({name: /foo/})
      .select({name: 1, email: 1})
      .one()

    minq
      .collection('foo')
      .stream()

    minq
      .collection('foo')
      .where({email: /lol\.com$/)
      .count()

    minq
      .collection('foo')
      .insert({name: 'Melissa', email: 'm@m.com'})

minq queries are contstructed starting with a db and collection, then by adding various options and constraints, and ending with a finalizer. Finalizers return a [Q promise](https://npmjs.org/package/q).

Read Finalizers are: `.toArray` `.one` `.stream` `.count`

Note, `.stream` returns a node Stream, not a promise

Mutator Finalizers are: `.insert` `.update` `.upsert` `.remove` `.removeAll`

## api reference

### minq(db) => Query
where db is a mongodb db connection object

### minq.like(string) => RegExp
builds a RegExp for use with a where clause, `minq.like` helps by escaping characters for you. It creates a case-insensitive regex.

### Query.collection(collectionName) => Query
returns a new Query object configured with the collection name.
alias: `from`

### Query.where(query) => Query
(optional) `query` is a mongodb [query object](http://mongodb.github.com/node-mongodb-native/markdown-docs/queries.html#query-object), with standard `$` operators

### Query.select(fields) => Query
(optional) `fields` is a mongodb projection object, with keys corresponding to the fields of the document you want to return

### Query.sort(by) => Query
(optional) `by` is a mongodb [sort order](http://mongodb.github.com/node-mongodb-native/markdown-docs/queries.html#query-options) option.
alias: `orderBy`

### Query.limit(number) => Query
(optional) `number` is a Number for the maximum number of documents you want to return.
alias: `take`


### Query.skip(number) => Query
(optional) `number` is a Number for the number of documents which otherwise match the query that you want to skip in the result

### Query.toArray() => Promise<Array>
Read Finalizer. The promise is resolved with the array of documents matching your query or an empty array.

### Query.one() => Promise<Object>
Read Finalizer. The promise is resolved with the document matching your query or `null`.
alias: `first`, `firstOrDefault`. Note, `first` does not throw on null, unlike in linq. Think of it as `firstOrDefault`.

### Query.stream() => Stream<Object>
Read Finalizer. The stream is a mongo [read stream](http://mongodb.github.com/node-mongodb-native/api-generated/cursorstream.html) of documents matching your query.

### Query.insert(doc) => Promise<Object>
Mutator Finalizer. Insert a document collection. The promise is the inserted object, including _id if assigned by db.

### Query.update(changes) => Promise<Number>
Mutator Finalizer. Update documents in a collection with `changes`, a mongodb [setter or unsetter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update). Use with `Query.where` or include `_id` on the `changes` object. The promise is the count of updated documents.

### Query.upsert(setter) => Promise<Number>
Mutator Finalizer. Create or update a document in a collection with `setter`, a mongodb [setter](http://mongodb.github.com/node-mongodb-native/markdown-docs/insert.html#update). The promise is the count of updated documents.

### Query.remove() => Promise<Number>
Mutator Finalizer. Remove documents matching a `where` query. The promise is the number of documents removed. Rejected if no `where` query is specified.

### Query.removeAll() => Promise<Number>
Mutator Finalizer. Remove all documents in a collection. The promise is the number of documents removed.

## running the tests

    $ npm install
    $ npm test

## contributors

jden <jason@denizac.org>

## license
MIT. (c) jden <jason@denizac.org>. See LICENSE.md.