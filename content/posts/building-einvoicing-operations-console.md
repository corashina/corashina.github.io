---
title: "Handling partial failure in bulk document operations"
description: "Workflow-driven document actions, server filters, partial batch failures, and CSV import progress in a React e-invoicing console."
date: "2024-08-22"
tags: [React, TypeScript, E-invoicing]
draft: false
---

I worked on the frontend of an [e-invoicing operations product](/works/einvoicing/). Its users needed to find a document among many records, understand its current state, take the actions the backend allowed, and investigate errors without leaving the application. Administrators also needed screens for integration rules, external systems, calendars, notification rules, PDF layouts, and party data.

The difficult work sat in the seams between those features. A bulk action can succeed for three documents and fail on the fourth. A filter needs a human label in the browser and an exact operator in the API query. A CSV import can outlive the modal that started it. An action offered by the backend can still be inappropriate for a user's role or the production environment.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## Building around document workflows

The application organizes the main work around documents, logs, a dashboard, and administration. React Query handles remote state. Redux stores interface state such as filters, selected documents, open drawers, and action dialogs. A shared API client carries requests to the e-invoicing service.

The main document path looks like this:

```text
saved and current filters
    -> serialized query parameters
    -> paginated document response
    -> row selection and details drawer
    -> backend-provided action IDs
    -> UI action registry
    -> confirmation or input modal
    -> one API request per document
    -> refresh list and clear selection
```

The documents query includes its filter object in the React Query key. While a new page loads, `keepPreviousData` retains the previous response. This avoids replacing a table with an empty state during each page or filter transition.

The API remains responsible for workflow state. Each document response can provide the action IDs available for that record. The client maps those IDs through one action registry that defines the label, icon, color, modal requirement, and API method. The registry covers approval, acknowledgement, retry, error dismissal, email, cancellation, and PDF refresh.

That registry removed action details from table cells and menus. A component can render an action from one definition, while the hook that executes it uses the same API method and modal rule.

## Applying UI policy after server policy

An action ID from the backend still passes through client-side policy. The hook drops unknown IDs, reserves some actions for master users, and removes development actions in production. The PDF refresh action uses both restrictions.

For a modal action on one selected document, the client resolves that document and checks its assignment before opening the action form. If another user owns it, the application asks for confirmation before continuing. Actions that need a comment or recipient collect those values in the modal.

This layered approach has a clear division:

| Layer | Decision |
| --- | --- |
| Backend response | Which workflow actions apply to the document state |
| UI action registry | How each action looks and which API call it uses |
| Client policy | Whether role and environment allow the control |
| Action dialog | Whether the user confirms and supplies required input |

Client-side hiding improves the interface, but it cannot enforce authorization. The API still needs to reject an unauthorized action.

## Handling bulk work without hiding partial progress

Bulk actions run one at a time. The hook waits for one document request to finish before sending the next. For modal actions, it tracks the current item and total count. On success, it refreshes the list, closes the details panel, clears selected rows, and shows a notification.

Sequential requests have a useful property in an operations screen: they limit concurrent mutations and give the progress indicator a concrete meaning. They also expose a tradeoff. If request four fails, documents one through three may already have changed. The batch has no transaction boundary in the client.

The UI reports the error, but the reviewed code does not keep a per-document result ledger for the batch. A stronger version could retain succeeded and failed IDs, then let the operator retry the remainder. I would avoid describing this flow as atomic bulk processing.

## Translating flexible filters into API queries

Invoice operations need more than a free-text box. The document filter model includes status, status group, document type, origin, owner, processing stage, company, party, integration rule, source and target identifiers, progress, overdue state, offline state, error state, required user action, and assignee.

Several identifiers support comparison modes. The UI stores a clean value plus a mode such as equals, contains, starts with, greater than, or less than. A converter encodes that choice into the string format expected by the API:

```text
equals               ABC
not equal            !=ABC
starts with          ABC*
contains             *ABC*
greater or equal     >=ABC
```

The reverse converter reads a query value back into the control state. That two-way path matters for saved filters and URLs. Users should see the mode they selected after a reload, not the encoded punctuation.

The documents and logs modules keep separate filter models because their search domains differ. Both send filters to the server instead of downloading a large collection for browser-side filtering.

## Making long-running imports understandable

The party catalog includes a multi-stage CSV import. An administrator chooses an external-system instance and an optional integration rule, then selects a CSV file. The UI parses enough data to show headers and a preview. The administrator selects delimiter and encoding and maps source columns to party ID, name, email, and language.

The upload and processing stages use different commands. The browser requests a storage location, uploads the file, starts processing with the selected mappings, and polls an import-status endpoint. The modal handles completed, processing, error, cancellation, and unexpected states.

```text
CSV selection
    -> local header parsing and preview
    -> storage URL request
    -> file upload
    -> import creation
    -> processing request
    -> status polling
       -> completed: refresh party list
       -> error: download details CSV
       -> cancelled: stop and preserve clear feedback
```

Error handling does more than show a red toast. If the backend provides a details CSV, the client downloads it for the administrator. The user can inspect rejected rows outside the modal. Completion and error paths also cancel or clean up the import state so a stale job does not remain attached to the next modal session.

Polling makes the workflow recoverable within one browser session, but the reviewed component holds much of its orchestration state in component memory. Closing the page can lose the screen's progress even if server processing continues. A durable jobs page keyed by import ID would give users a stronger return path.

## Putting failures next to the work

The logs area uses the same table pattern as documents, with dynamic filters, saved filter selection, export, mobile cards, and a details sidebar. A mutation lets an operator resolve a critical error. The dashboard summarizes statuses and errors and adds an activity feed.

Document details bring actions, comments, previews, downloads, assignment, and status into one workspace. The application can request PDF, XML, and rendered previews from separate endpoints. It also supports comments and forwarding, which keeps operational discussion attached to the document ID.

The administration area broadens the scope. Users can manage integration rules, rule security, external-system instances, notification rules, calendars, features, PDF layouts, sites, and a party catalog. These are configuration surfaces for a larger backend. The frontend demonstrates how operators edit that configuration; it does not reveal the backend execution engine for each rule.

## Supporting desktop and mobile work

The code contains dedicated mobile presentations for documents, logs, dashboard status, and administration records. Desktop tables can expose dense columns and sidebars, while mobile cards select a smaller set of fields and actions.

A CSS breakpoint around one table would not solve the layout problem. A wide operational grid does not compress into a useful phone view. The application chooses a separate information hierarchy while reusing API hooks, stores, action configuration, and domain models.

That duplication has a maintenance cost. A new field or action may need treatment in both the table and card presentation. Shared hooks keep behavior aligned, but the team still has to review two render paths.

## What the frontend owns

My work centered on React state, filter serialization, action orchestration, responsive views, long-running import UX, and the contracts between those features and the API. The backend owns regulatory validation, communication with the national platform, authorization, and transaction boundaries. I cover the separate XML-to-document renderer in [XSLT and .NET: Rendering invoice XML as readable HTML and PDF](/blog/rendering-invoice-xml-with-xslt/).

The interface models operational state where users make decisions. It shows available actions, blocked controls, batch progress, and row-level import failures. Those details let an operator recover from partial work without reconstructing the state from several screens.
