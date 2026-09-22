---
title: "Building a social feed with serverless functions"
description: "HTTP function boundaries, reusable database connections, and consistency problems in a small social application."
date: "2019-11-18"
tags: [Azure Functions, Node.js, React, MongoDB]
draft: false
---

The Serverless Azure App project implements a small social application: register an account, publish a short post, follow another user, and read a feed containing posts from those relationships. React provides the interface. Azure Functions hosts the HTTP handlers, with Express inside each function and Mongoose for the database model.

The interesting part is where the application puts shared work. Authentication and database setup appear across several endpoints, while a follow operation changes two users and a feed reads across those relationships. Splitting handlers into functions does not make those dependencies disappear.

The code was uploaded on 13 November 2019, followed by a data-file addition on 18 November. This retrospective uses that final repository date and describes the prototype preserved in the source.

## Mapping requests to function boundaries

The server groups routes into directories such as `Posts`, `PostId`, `Users`, `UserPosts`, and `Follow`. Each directory contains an HTTP binding declaration and an Express application exported through `azure-function-express`.

For example, the posts collection declares GET, POST, and DELETE methods in `function.json`. The Express handlers then implement operations on `/api/posts`. The function configuration and the application routes must agree about which requests they accept.

Common modules provide body parsing, token verification, and database access:

```text
React request
    -> Azure HTTP trigger
    -> Express handler and middleware
    -> shared database module
    -> Mongoose query
    -> response used to update component state
```

This structure allows ordinary Express middleware to sit inside a function entry point. It also introduces two places to inspect when an endpoint does not match a request: the trigger binding and the Express route. The [posts handler](https://github.com/corashina/Serverless-Azure-App/blob/03af633fb79b14da95e29e843827ad109f524103/server/Posts/index.js) shows that arrangement.

## Reusing the database connection

Opening a database connection for each HTTP operation adds work unrelated to the requested query. The shared database module stores its connection and models in module-level variables and returns them to handlers on later calls within the same running instance.

That cache belongs to the process executing the module. A new instance starts with empty variables, so the code still needs an initialization path. It must not depend on a previous request having registered the models.

The implementation awaits the initial connection before assigning the cached value. Concurrent callers arriving during that wait can both observe an empty cache. A stronger initialization pattern would cache the pending promise, allowing them to await the same attempt and defining how a failed attempt can be retried.

That improvement is distinct from the reuse already present in the [database module](https://github.com/corashina/Serverless-Azure-App/blob/03af633fb79b14da95e29e843827ad109f524103/server/utils/db.js). The source establishes connection reuse within a warm instance, not a measured reduction in latency.

## Assembling a feed from relationships

User documents contain lists of followed usernames and followers. Posts contain an author string. To load the home feed, the authentication endpoint retrieves the current user and queries posts whose author appears in the user's following list or matches the user's own username.

This keeps the prototype's feed query compact. It also makes username consistency part of data integrity. Some handlers use the username as an author, while other checks compare authors against a user identifier. Those values represent different identities and cannot be substituted without a conversion.

The React home component receives the user and posts together. After a successful post creation, it appends the returned post to local state. After deletion, it filters out the returned identifier. The interface therefore relies on the mutation response to describe the accepted server result.

The feed is an unpaginated query in this version. A larger dataset would need an ordering and pagination contract before the UI could treat it as a stable sequence. The [feed handler](https://github.com/corashina/Serverless-Azure-App/blob/03af633fb79b14da95e29e843827ad109f524103/server/AuthenticateUser/index.js) and [home component](https://github.com/corashina/Serverless-Azure-App/blob/03af633fb79b14da95e29e843827ad109f524103/client/src/routes/Home.js) expose both sides of that boundary.

## Updating both sides of a follow

Following another account updates the current user's `following` array and the target user's `followers` array in sequence. The endpoint checks both lists before deciding whether to follow or unfollow.

The failure case is a partial update. The first write can succeed while the second fails, leaving the two documents in disagreement. The endpoint recognizes an inconsistent pair of lists, but does not repair it.

A toggle also has ambiguous retry behaviour. Repeating a successful request can undo the relationship instead of confirming it. An explicit desired state, such as “follow this account,” would make retries easier to define. Atomic relationship updates or a single authoritative relationship record would address a different problem: preventing the two stored views from diverging.

These are changes I would make to the [follow handler](https://github.com/corashina/Serverless-Azure-App/blob/03af633fb79b14da95e29e843827ad109f524103/server/Follow/index.js), rather than guarantees provided by the prototype.

## Keeping failed requests from continuing

Several archived handlers send an error response without returning. Sending an HTTP response does not stop the JavaScript function, so later database work can still run. The authentication middleware also needs a clear success path before handing control to the route.

The same distinction applies to authorization. Hiding a delete icon in React is useful interface behaviour, but the server must verify ownership for the request itself. The archived delete handler does not enforce that check.

The prototype provides a useful end-to-end slice from React through function bindings to persisted documents. The next engineering work would concentrate on those request boundaries: stop after rejection, identify records consistently, and define mutations that remain safe under partial failure and retries.
