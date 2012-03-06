Extensions to Backbone.js to support MongoDB use as a back-end data store. 

# Overview

Adds a Backbone.Sync implementation for working with MongoDB databases. 
Thus you can use Backbone models as usual, just needsa `collectionName` attribute in the Model definition
that specifies the MongoDB collection to work with.

Moreover, it extends Backbone.Model and Backbone.Collection with some meaningful features. The general idea
of extension was to provide the usual success/error callback handling of Backbone together with MongoDB integration.

1.  Controllers have a `find`, `findOne` and `_withCollection` methods that allow you to query for 
many models, one model or do arbitrary operations on the related MongoDB collection, respectively.
2.  Models can be set up easily to handle embedded and related documents, using a `nestAs` attribute 
in the model's definition.

These extra features are documented below. 

# Usage

## Server side

Example:

    var Db = require('backbone-mongodb/lib/db),
      db = new Db({
        name: 'test',
        host: '127.0.0.1',
        'port': 27017
        })
      db.on('connected', function(err){
        ...
        })

    require('backbone-mongodb');
    ...
    var MyCollection = Backbone.Collection.extend({
        collectionName: 'myCollection'
        })

`collectionName` can be specified for Model definitions too.

## In the browser

Just include the `backbone-mongodb.js` file from the public folder.

# API

## Database access

The `lib/db.js` file specifies the database access and setup methods.

Example:

    var Db = require('backbone-mongodb/lib/db),
      db = new Db({
        name: 'test',
        host: '127.0.0.1',
        port: 27017,
        autoconnect: true
        })
      db.on('connected', function(err){
        ...
        })

The returned database object supports events. 

Exported methods are:

* `open()`
* `close()`
* `getConnection()`

## Controller extensions

### find method

The find method returns a new collection that satisfy the search criteria.

**Signature:** `find(args, options)`

  * args: JSON object to be passed on to MongoDB's find
  * options: either a JSON object with success/error callbacks, or a NodeJS callback function

### findOne method

The findOne method returns a new Model instance associated with the given collection.


**Signature:** `findOne(args, options)`

  * args: JSON object to be passed on to MongoDB's find
  * options: either a JSON object with success/error callbacks, or a NodeJS callback function

### \_withCollection method

The withCollection method returns a reference to the related MongoDB collection. Thus arbitrary operations
can be performed on the collection.

**Signature:** `_withCollection(callback)`

  * callback: a usual NodeJS callback function

## Model extensions

### nestAs attribute

Using the `nestAs` attribute four types of nesting are possible. One can nest:

  1. another model from a JSON argument
  2. another collection from JSON array as an argument
  3. another model from model & ID as an argument
  4. another collection from list of IDs as an argument

Example:

    var MyModel = Backbone.Model.extend({
          nestAs: {
            case1: MyModel,
            case2: MyCollection,
            case3: MyCollection,
            case4: MyCollection
          }
      }),
        MyCollection = Backbone.Collection.extend({
          model: MyModel
      });
    var myModel = new MyModel({subdata: 'subvalue'});
    myModel.save(null, {success: function(newModel){
        var mainModel = new MyModel({
            case1: {subdata: 'subvalue'},
            case2: newModel.id,
            case3: [{subdata: 'subvalue'}],
            case4: [newModel.id]
          })
        console.log(mainModel.case1);
        console.log(mainModel.case2);
        console.log(mainModel.case3);
        console.log(mainModel.case4);
        }})
    
As you can see in the example above

  * all the cases give you the nested attribute as a direct attribute of the
  model, `mainModel.attributeName`;
  * the first case requires you to give the resulting model, while the other 
  cases require a collection;

The code in the background registers several event listeners to handle changes
in values in both directions as much as possible.

# TODO

1. There is a known bug with case2 and case4 as the initializer function's async calls are not finished before the Model instance is already returned. 

# Credit

The original idea came from donedotcom.
