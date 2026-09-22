---
title: "Coordinating orders, stock, and worker threads"
description: "A Java client-server simulation where kitchen staff, delivery drones, and persistence share changing business state."
date: "2018-05-19"
tags: [Java, Concurrency, Networking]
draft: false
---

Sushi-Go was a coursework management system with separate customer and server interfaces. Customers could register, log in, assemble a basket, and place orders. The server interface managed dishes, ingredients, suppliers, staff, and delivery drones.

Staff and drones ran as worker threads. A staff member consumed ingredients to prepare dishes. A drone checked stock or delivered an order. Another thread saved the system to a text file while socket messages and interface actions could change the same model.

The last Java source update was on 19 May 2018, after work beginning in April. Later repository updates added documentation, sample data, and licensing. The discussion here follows that source snapshot.

## Following an order across the socket

The client uses a `Comms` class to send serialized Java objects over a socket. Requests include message objects for login, catalogue reads, and cancellation, plus domain objects for registration and new orders.

On the server, `ServerReceive` reads an object, checks its type, and dispatches it to the corresponding operation. A request for dishes returns the dish list; an order adds an entry to the server's order collection.

```text
Customer basket
    -> serialized order over a socket
    -> server order collection
    -> drone checks dish availability
    -> delivery simulation updates status
    -> completed order is removed
```

Using serialized objects reduces mapping code in a Java-only prototype. It also couples the protocol to the domain classes. A class change can affect network compatibility, and receiving an object is not enough to establish that its contents represent an authorized action.

The snapshot has a further limit: the accept loop reassigns a shared receiver's socket rather than creating an independent receiver per connection. The README's multi-client description therefore exceeds what I would claim from the connection-handling code. The [communication helper](https://github.com/corashina/Sushi-Go/blob/d72d7d84a3f585ef5fbaa9e02ebb805fec54afcb/common/Comms.java) and [server entry point](https://github.com/corashina/Sushi-Go/blob/d72d7d84a3f585ef5fbaa9e02ebb805fec54afcb/ServerApplication.java) show the intended request flow and that implementation constraint.

## Giving workers visible progress

Each staff member and drone implements `Runnable`. Adding a worker starts its thread. The worker updates status text while waiting, so the management interface can show activity such as preparation or delivery time remaining.

Staff inspect dishes against restock thresholds, check the required ingredients, subtract those ingredients, wait for preparation, and increase dish stock. Drones inspect ingredient thresholds and order availability, then simulate travel with timed waits.

The model therefore mixes business transitions with the passage of simulated time. A preparation operation lasts long enough for another thread or interface action to modify a related collection. Code that appears sequential inside one worker must still account for those concurrent changes.

The worker calls `server.notifyUpdate()` to refresh the interface. Because this can originate from a worker thread, a stronger Swing implementation would marshal the refresh onto the event dispatch thread and give the view a stable snapshot to read.

## Choosing what a lock protects

Dishes, ingredients, and orders expose locks. Workers acquire a relevant lock around parts of preparation, restocking, or delivery. That expresses the intention that two workers should not perform the same operation on one item at the same time.

The hard part is the scope of the protected operation. Locking a dish does not protect an ingredient shared by a different dish. Reading ingredient stock, deciding that there is enough, and subtracting it must form a coherent reservation if several staff members can consume that ingredient.

The archived staff loop also has a path that continues to another dish after acquiring a lock, without releasing it. Holding a lock through timed waits increases the cost of such a mistake. A `try/finally` release pattern would protect cleanup, while shorter reservation operations would reduce how much work needs to happen under the lock.

The [staff](https://github.com/corashina/Sushi-Go/blob/d72d7d84a3f585ef5fbaa9e02ebb805fec54afcb/common/Staff.java) and [drone](https://github.com/corashina/Sushi-Go/blob/d72d7d84a3f585ef5fbaa9e02ebb805fec54afcb/common/Drone.java) implementations are useful examples of the difference between adding locks and defining a transaction. The latter requires naming the invariant, such as “stock cannot be reserved twice,” and keeping the whole check-and-update operation consistent with it.

## Stopping a worker during an operation

Removing a drone interrupts its thread. The drone code catches interruption during a wait, releases a lock on that path, and restores the interrupted status so its loop can terminate.

Staff removal does not retain and interrupt the corresponding thread in the same way. The two worker types therefore have different lifecycle behaviour even though both appear as removable entries in the interface.

That mismatch suggests a shared worker-lifecycle abstraction: start, request stop, release held resources, and confirm termination. Collection removal alone cannot stop the computation associated with the removed object.

## Saving a changing model

A persistence thread writes suppliers, recipes, users, workers, orders, and stock to a text file every ten seconds. Startup reconstructs the model by reading records and resolving their references.

The format is inspectable and works as a simple coursework configuration mechanism. It is not an atomic snapshot: state can change while the writer traverses it, and the writer overwrites the destination file in place. Capturing a consistent model snapshot and replacing the saved file only after a complete write would address separate consistency and crash-recovery problems.

The project brought networking, mutable business objects, and background work into one application. Its demanding cases were operations spanning more than one object: reserve ingredients, complete an order, remove a running worker, or save relationships while they change. Those operations need explicit boundaries that a thread or a lock does not supply on its own.
