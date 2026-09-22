---
title: "Fitting six business applications into one mobile shell"
description: "Designing one Expo client around multi-step tenant selection, lazy business modules, native sign-in, public deep links, and platform-specific downloads."
date: "2025-07-20"
tags: [Expo, React Native, Mobile architecture]
draft: false
---

I built one Expo application that hosts six business products behind a shared mobile shell. Users sign in, select a client, choose an application and site, then enter the module that matches that context. The products cover invoicing, approvals, administration, document processing, leave management, and system setup.

The source project uses React Native, TypeScript, React Navigation, Zustand, TanStack Query, Axios, and Expo Secure Store. Each product lives under its own domain module. The shell owns authentication, navigation chrome, stored context, and the services that cross module boundaries.

The difficult work sat between those layers. The app had to restore a half-finished login, resolve inconsistent application names, keep public approval links reachable without a session, and save files through different Android and iOS APIs.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## One shell, six modules

The application registry maps a selected application to a module key. Stable application IDs take priority. Normalized names provide aliases for cases where an API returns a product label instead of the expected ID.

Each registry entry supplies two pieces: a lazy navigator and a function that loads drawer items. The shell defers module loading and rendering until it resolves the stored application. That pattern controls application startup work without making a bundle-splitting guarantee about Metro.

```text
Root navigator
    -> authentication flow or authenticated shell
        -> application registry
            -> selected lazy navigator
            -> selected drawer-item provider
                -> module screens, queries, forms, and local state
```

The drawer provider can inspect the authenticated user and token. The leave module adds approval screens for managers and administration screens for HR managers. The document-processing module chooses its first route from token permissions and sends a user with no permitted route to an access-denied screen.

This registry keeps product knowledge out of the shell. Adding a module still requires deliberate registration, route types, translations, and aliases, but the frame does not import feature screens or duplicate role rules.

The registry also handles unsupported stored selections. It removes the invalid application and site context, returns the auth state to application selection, and shows an error. That recovery path matters after a product name changes or a user's access changes between launches.

## Restoring a multi-step account context

Authentication ends after more than a password. The platform token identifies the user, then the user chooses a client, application, and site. Each choice narrows the working context.

The app models that flow as explicit steps:

```text
SIGN_IN
    -> SELECT_CLIENT
    -> SELECT_APPLICATION
    -> SELECT_SITE
    -> INDEX
```

On launch, the root navigator reads the token and four context values from storage. A pure resolver chooses the next step. A token with no client resumes at client selection. A client and application resume at site selection. The app requires the token, client, application, site, and application URL before it enters the authenticated shell.

Before restoring the full context, the client sends the selected IDs to the platform. The response contains a refreshed access token with the active context in its claims. The app stores that token and decodes the user from it. If the refresh fails, the source falls back to the stored token.

That fallback keeps the app from discarding a session during a transient request failure, though it can leave the token and stored selection out of sync. I would make the API expose a distinct offline or retry state so the shell can explain the condition instead of entering the module with uncertain context.

Expo Secure Store holds mobile values such as the access token and selected IDs. The same storage wrapper uses browser local storage on web, with an in-memory fallback for environments where browser storage cannot be reached. Modules call the wrapper rather than choosing a platform store themselves.

## Keeping server state and UI state in their lanes

The service layer defines three Axios clients: platform, application, and notification. Request interceptors read the access token and attach a bearer header. Response interceptors clear stored auth on a `401` and show an API error for other failures.

The selected web application URL does not become the native API base. The native modules share a platform backend, while the refreshed token carries the active client, application, and site. Product APIs use route prefixes to select their domain.

TanStack Query owns request state and cache invalidation inside the modules. Zustand stores session and interface state, including the shell's current navigation items and persistent filters. This split prevents a filter panel from becoming the owner of fetched business records.

A typical request follows this path:

```ts
// Illustrative pseudocode
const token = await storage.get('access_token');

const response = await appApi.get('/product/items', {
  headers: { Authorization: `Bearer ${token}` },
  params: currentFilters,
});

return response.data;
```

The production source attaches the header in an interceptor and wraps endpoint calls in module query hooks. The example shows the data flow and omits the interceptor details.

## Native Google sign-in without breaking Expo Go

Google sign-in needs a native module. Importing that package at module load time can crash Expo Go because its binary does not contain the native implementation.

The authentication utility delays `require()` until the user reaches the SSO path. A `try/catch` records whether the native package exists. The rest of the app can start and run tests when the module is absent, while the SSO screen reports that the current build cannot perform native Google sign-in.

The SSO screen collects an organization, opens the native account picker, and receives a Google ID token. It sends that token to the backend exchange endpoint. The backend response supplies the platform access token; the client decodes the user and stores the token and user ID. The normal client-selection flow continues from there.

This design contains the native dependency within the acquisition step. Token decoding, storage, context selection, and the authenticated shell use the same path as other login methods.

## Public actions outside the authenticated shell

Some approval links arrive in email. They need to open even when the user has no active mobile session.

The root linking configuration registers a public leave-approval path and two workflow action paths. The root stack mounts those screens outside the conditional branch that chooses between the auth navigator and the application shell.

The leave feature uses a separate Axios instance for public approve and reject calls. It does not inherit the shared interceptor that clears storage on `401`. That separation protects an existing signed-in session when someone opens an expired public link.

Workflow email actions accept an encrypted route parameter. Approval starts the mutation when the screen mounts. Rejection requires a comment and guards against duplicate submissions while the request runs. After the result, the screen returns to either the app or auth route based on current session state.

## Saving files on Android and iOS

Several modules download documents and exports. Android and iOS expose different user-facing save flows, so one implementation cannot call the same native API on both systems.

On Android, the file service asks the user to choose a directory through the Storage Access Framework. It caches the directory URI in Secure Store, creates the destination file, copies base64 data from a temporary file, and removes the temporary copy. If the cached permission stops working, the service clears it and opens the directory picker again.

On iOS and other non-Android platforms, the service opens the native share sheet. The user can save to Files or hand the document to another application. The service deletes its temporary file after the sheet closes.

The platform branch sits in one helper, so invoicing PDFs, attachments, logs, and other exports share the same behavior. Folder permissions and the share sheet require native builds for meaningful testing.

## Release configuration and maintenance boundaries

The project includes EAS profiles for preview and production builds on Android and iOS. Package scripts cover APK, app bundle, TestFlight, and store submission workflows. Those files show release preparation. They do not prove that a given build reached a store or that every module achieved full product parity.

The module structure gives the app room to grow, while the registry, auth state machine, and root public routes keep each addition explicit. Shared services need stable contracts because one change can affect six products. Feature modules need their own route types, queries, translations, and permission checks so product behavior does not leak back into the shell.

That division gives day-to-day maintenance a clear path. I can change a product screen inside its module, change session behavior in the auth layer, or change device file handling in one service used by each product.
