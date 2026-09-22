---
title: "Keeping application context consistent across a platform"
description: "The engineering behind platform setup, staged login, and communication between a React shell and embedded business applications."
date: "2024-04-10"
tags: [React, TypeScript, Architecture, Enterprise software]
draft: false
---

I worked on [XELapps](/works/xelapps) at Xelto, where users could access several business applications through a shared platform. An administrator assigned applications to clients, created sites, and managed user access. A person signing in then selected the context in which they wanted to work.

That context affected much more than the page title. Selecting a different client could change the available applications. Selecting an application changed the available sites, navigation, and embedded frontend. Each transition had to carry the right identifiers into the next request and discard state from the previous selection.

The web implementation used React and TypeScript, with Redux for interface state, React Query for server data, and Axios for API access. Separate setup and administration applications managed the relationships that the platform shell consumed at login.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## Modelling the context before building the screens

The distinction between a client, an application, and a site shaped the forms and API hooks. A site record included both a client ID and an application ID. An application had its own identity and URL; assigning it to a client created a relationship rather than another application definition.

The setup flow followed those relationships:

```text
Application catalogue
    -> assign application to client
    -> create a site for that client and application
    -> assign user access

User signs in
    -> choose client
    -> choose application
    -> choose site
    -> establish session context
    -> open embedded application
```

The site form fetched applications assigned to the selected client. It required an application and a site name before submission. The assignment form used the application catalogue instead. Both screens contained a select input, but the lists represented different questions: which application exists, and which application this client can use.

User administration added another view of the same model. The site-assignment dialog loaded sites for a particular client and application, initialized the selection from the user's existing assignments, and sent the selected IDs on save. Keeping the client and application visible in that dialog gave the operator context for the change.

I used form validation and pending states around these mutations. After a successful assignment or site creation, the UI invalidated the relevant query and closed the dialog. The backend remained responsible for accepting or rejecting the relationship; the form helped the operator submit a coherent request.

## Login as a sequence of dependent choices

The authentication flow had named steps for sign-in, client selection, application selection, and site selection. It also had separate states for password recovery and SSO. This made intermediate login screens part of the application state rather than a chain of unrelated redirects.

Application selection stored the selected application ID and URL before moving to the site step. If the server returned one application, the UI could select it without requiring another click. Site lookup included the user, client, and application in its React Query key.

Those keys matter when a person moves between contexts. Two responses can have the same shape while belonging to different clients. A cache key needs enough identity to distinguish them. The setup application used the same approach for queries such as a client's applications and the sites belonging to a client/application pair.

Moving backward required cleanup as well as navigation. Returning from site selection to application selection removed the site and application selections. Changing the client discarded downstream application, site, and menu state. Otherwise, an old selection could survive behind a new screen and influence a later request.

Once the required identifiers were available, the shell requested a token for the selected context. It then mapped the returned claims into user state and applied the user's language settings. Decoding a JWT supplied display and session context to the frontend; server-side token validation and authorization were separate responsibilities.

## Waiting for an embedded application to be ready

The shell hosted business frontends in an iframe. It owned the outer header and browser navigation, while each embedded application supplied its own screens. The two sides exchanged messages for configuration, menus, redirects, page titles, and session events.

An iframe load event does not establish that React has mounted its message listener or that the application can process configuration. The shell therefore waited for a `READY` message before sending `CONFIG`.

The configuration included the current token, the parent origin, shared CSS references, and theme data. The child could then initialize its context and return navigation information. The shell stored the supplied menu and routes, so the header could represent whichever business application the user had selected.

The handshake also accounted for an application that had reached its own error screen. A readiness message with an error status removed the shell's loading cover, allowing the embedded error to remain visible. Keeping the cover in place would hide the explanation behind an indefinite spinner.

This protocol created a lifecycle dependency that ordinary prop passing would not have. The sender and receiver lived in separate browser documents, and either could initialize first. Named messages made that coordination visible, but they still needed careful handling on both sides.

## Translation loading was part of initialization

The administration and setup applications waited for translations before sending their navigation labels. They also had to accept host configuration during that period. Configuration readiness and translation readiness could arrive in either order.

The message handler tracked whether it had received configuration and whether it had sent navigation. References held those flags without triggering another render for each protocol event. An effect could send navigation after translations became available if the earlier configuration handler had been unable to do so.

This kept communication logic in a provider instead of distributing it across forms and tables. It also exposed the cost of coordinating several flags and effects: the handler had to manage repeated messages, initialization guards, and listener cleanup. In a future refactor, I would model those states as explicit transitions and test both arrival orders, including remounts.

## Keeping navigation and session changes together

The embedded application could ask the parent to change its title, update search parameters, or navigate to another route. The parent translated those messages into its own router operations. The iframe URL included the selected application's base URL and the current path, search, and hash, which connected embedded screens to browser navigation.

Session events crossed the same boundary. A child could report that the session had expired; the shell then cleared React Query data, removed authentication state, and returned the user to the login flow. Ordinary API requests also passed through centralized unauthorized-response handling.

This gave the shell responsibility for ending the overall session while leaving domain-specific work inside the child application. It also meant that stale menus, cached data, and authentication records had to be considered together during logout.

The protocol also creates a trust boundary. Choosing a target origin for outgoing configuration is separate from validating the origin, sender window, and payload of an incoming message. I would review those receiving-side checks as a distinct part of any attempt to reuse this contract with another application. The message names describe operations; they do not establish who may request them.

## Maintaining the shared contract

The setup screens and the shell used the same underlying relationships for different jobs. Administrators created and assigned them. Users selected them. Embedded applications consumed the resulting context.

Changes therefore needed to preserve the path from configuration to use. A new application required a catalogue entry, a client assignment, an appropriate site, and a frontend capable of participating in the shell's initialization and navigation protocol. A working setup form covered only one part of that path.

The most useful boundary in this work was the distinction between shared platform context and business-specific state. The shell managed selection, navigation, and session lifetime. Workflow, document processing, and other applications kept their own forms and operations. That division made it possible to reason about a context switch without reading the implementation of an invoice editor, while still leaving a concrete messaging contract to maintain between them.
