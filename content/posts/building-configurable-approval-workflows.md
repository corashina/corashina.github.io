---
title: "Keeping nested approval rules consistent as they change"
description: "Editing nested workflow rules, deriving document forms from step metadata, and keeping React views consistent after a save."
date: "2025-01-04"
tags: [React, TypeScript, Workflows]
draft: false
---

I worked on [Workflow](/works/workflow), a React application for configuring and operating approval workflows. The interface covered two related jobs. Administrators defined a workflow as ordered steps, approvers, fields, and conditions. Other users opened live documents, reviewed their current step, edited permitted values, and accepted, rejected, or held the item.

Both jobs depended on the same metadata. A field added to an early step could become an input to a later condition. A field removed from the definition could leave invalid references inside nested condition groups. The document screen had to render fields from the steps reached by one workflow instance, then save the edited structure without leaving stale copies in other lists and sidebars.

The frontend used React, TypeScript, React Query, React Router, Axios, and Mantine. A parent application supplied navigation and theme configuration.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## Two modes over one workflow model

I placed API operations in hooks grouped by domain. The definition editor owned its local draft because one edit could affect fields, conditions, approvers, and step order before the server accepted a new version. Operational views used React Query because lists, details, attachments, and activities had independent fetch lifetimes.

The main data paths looked like this:

```text
Parent application
    -> configuration, theme, navigation
    -> embedded workflow UI

Definition editor
    -> workflow draft
    -> ordered steps and fields
    -> nested condition groups
    -> validation and API payload

Approval queue
    -> React Query list
    -> selected workflow item
    -> server-provided field metadata
    -> document editor and action controls
    -> save or approval mutation
    -> affected query caches refresh
```

The router exposed approval queues, definition editing, history, and substitutions. A shared Axios instance added the session to requests and converted backend errors into translated notifications. On an expired session, the embedded application notified its parent.

That boundary kept the workflow UI focused on its own routes. The server still owned authorization and workflow transitions. Client-side checks improved the editing experience, but they did not establish a security boundary.

## Keeping nested conditions valid

A workflow condition was a tree. Each group contained conditions and child groups, with AND or OR connectors at both levels. A condition referred to a configured field and one of the operators valid for that field type.

Editing a field could invalidate several places in the tree. Removing a field required a recursive walk through the global condition group and the condition groups attached to individual steps. The editor removed matching conditions, pruned empty child groups, and returned `null` for a group with no remaining content.

Changing a field required more selective repairs. A new field name propagated to condition labels. A change to an options field cleared values that no longer existed. A change to the field type cleared operators that did not belong to the new operator set. Boolean values needed special handling because the UI used translated labels while the API expected `0` and `1`.

The following pseudocode shows the shape of the recursive cleanup. It is illustrative and omits application-specific types:

```ts
function removeField(group, deletedFieldId) {
  if (!group) return null

  const conditions = group.conditions.filter(
    condition => condition.fieldId !== deletedFieldId
  )

  const children = group.children
    .map(child => removeField(child, deletedFieldId))
    .filter(child => child && (child.conditions.length || child.children.length))

  if (conditions.length === 0 && children.length === 0) return null
  return { ...group, conditions, children }
}
```

The editor also constrained the fields available to each step. A condition on step four could reference persisted fields from steps one through three. It could not select a field from the current step or a future step. New fields without a server ID stayed out of the selector until the API assigned an identity. That rule avoided condition payloads which referred to temporary client keys.

Step ordering introduced another dependency. Moving a step changed its position and the set of fields visible to later conditions. I treated the array order as the source for display, then rewrote the one-based step indexes after each move or removal. The condition selectors derived their choices from that ordered array, so a reorder did not need a second mutable index map.

## Converting an editor draft into an API payload

The form checked identity fields, effective dates, an approver on each step, and dynamic fields before serialization. An options field needed at least one option. Empty fields counted as untouched placeholders, while an incomplete field produced an error.

Serialization then converted UI conventions into the API model. Date-only values gained explicit start-of-day or end-of-day times. Boolean field options changed from translation keys to numeric strings. The serializer walked nested condition groups and converted boolean condition values to numbers. It sent global fields and step fields as separate collections because their scopes differed.

The submit boundary kept these conversions in one place. Controls worked with translated labels, while API hooks received one normalized structure. The form component still grew large because it retained transformations that affected fields, conditions, and steps together.

## Building filters for typed document fields

The approval queue combined fixed workflow filters with fields defined by each document type. Fixed filters such as status, category, step, and creation date mapped to ordinary request parameters. Dynamic document fields used a condition expression understood by the API.

One row in the filter builder held a field, operator, and value. Date rows also held a range type and optional endpoints. The request builder separated fixed rows from document rows, formatted values according to field type, and joined document conditions with AND.

Dates needed a clear interval convention. For an `on` filter, the UI produced a lower bound at the selected date and an exclusive upper bound at the next date. A range from 10 June through 12 June became:

```text
documentDate ge 2026-06-10 AND documentDate lt 2026-06-13
```

The same convention handled months, quarters, overdue items, and user-entered ranges. It avoided equality against timestamps and included the whole final calendar day.

Users could save filters per user and entity type and mark one as a favourite. I stored those preferences under scoped local-storage keys. Restoring a filter rebuilt the request and chose the document-search endpoint only if document conditions existed. The preferences remained tied to one browser.

## Rendering document fields from workflow progress

The structured document editor did not use a fixed set of inputs. It fetched field configuration for the document type and selected fields whose step IDs appeared in the workflow instance. It ignored fields outside the structured result namespace and resolved duplicates in favour of the later applicable step.

One subset of fields described a journal table. The UI converted field metadata into columns, mapped API types to text, number, select, or boolean controls, and applied configured ordering and widths. Some required-field rules came from the document specification, with the API configuration as a fallback.

The editor split a large document into data, positions, prices, journal rows, attachments, and comments. Each editable tab reported its validity to the parent. The approval action stopped before confirmation if a required tab contained missing values and named each affected tab.

Server-driven rendering reduced duplication between workflow types, but metadata errors became UI errors. A missing step ID could hide a field. Conflicting field definitions needed deterministic precedence. I made those rules explicit in the transformation from API fields to editor fields so visual components did not each invent an interpretation.

## Saving across several cached views

The detail screen loaded the item, field configuration, activities, attachments, comments, and table options. A loader registry tracked those sources by key and withheld the composed view until the active set became empty.

Saving required more care. The editor could produce a list of changed values and a rebuilt full document. For document types that used both operations, it sent the field changes first and saved the full structure after success. A ref blocked concurrent saves. A cancellation flag distinguished leaving edit mode through Save from leaving through Cancel.

The same item appeared under several query keys and in mobile or desktop parents. After a save, the UI refetched each relevant key. In two paths it cloned cached data because structural sharing could preserve the old object identity and prevent a dependent form from reinitializing.

I kept edit mode open after an error. The user retained the draft and could retry. Successful saves cleared the initialization guard, fetched fresh server data, and let the form rebuild from that response.

Several contexts consumed the document through different query keys, which made cache reconciliation verbose. A canonical cache identity could reduce that work. Within the existing contracts, the code refreshed each named consumer.

The most demanding work sat between features: a field definition affected a rule tree, a step order affected available operands, and one save affected several screens. I treated those relationships as data transformations with named boundaries. The application depended on backend validation, while the frontend made its part of each relationship explicit and inspectable.
