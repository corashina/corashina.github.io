---
title: "From a client questionnaire to a printable weekly meal plan"
description: "Connecting intake forms, recipe editing, persisted schedules, and PDF output in a React and Redux application."
date: "2018-08-13"
tags: [React, Redux, Node.js, MongoDB]
draft: false
---

Fitmed was a prototype system for dietitians, built with React, Redux, Express, and MongoDB. A client could provide dietary preferences and view a plan. An administrator could maintain recipes, place them into a weekly schedule, and add comments. The client could then download the schedule, recipes, and a shopping list as a PDF.

I worked on this project with another contributor during July and August 2018. This account focuses on the PDF export milestone of 13 August, before later revisions in January 2019.

The engineering problem was carrying one plan through several representations: a questionnaire, an editable schedule, a database document, and a printable document. Each representation needed enough shared structure to remain consistent with the others.

## Modelling the work around a weekly schedule

The data model separates products, recipes, and diets. Products hold nutritional information. Recipes combine ingredients with preparation text and nutritional values. A diet records the client's intake information and the meal schedule.

The schedule has four meal periods across seven days. The prototype represents these as 28 named fields, such as `time_01_monday`, with separate fields for the four meal times.

This maps directly onto a table in the interface. The client and administrator can address a cell by name, and the PDF generator can group those fields into seven-column rows. It avoids a transformation layer between the database shape and the initial screen layout.

The cost appears when the structure changes. A fifth meal period or a different planning duration would require changes in several places. An array of days and meals would make that structure more flexible, but the archived version uses explicit fields. The [diet model](https://github.com/corashina/Fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/models/Diet.js) shows both the questionnaire and schedule in the same document.

## Following an edit through the application

The administrator selects a recipe and a target meal field. A Redux action sends the recipe data and field name to an Express endpoint. The server updates the diet with MongoDB's `$addToSet`, reads the resulting document, and returns it. The reducer replaces its diet state with that response.

```text
Select recipe and meal slot
    -> Redux action sends the mutation
    -> Express authenticates and updates the diet
    -> server returns the updated document
    -> reducer replaces the current diet
    -> connected views render the result
```

Returning the document keeps the accepted server state visible to the client. The browser does not need to reproduce the database update rules to show the result. Removal follows a similar path using `$pull`.

That approach is easy to trace in a small application. It can transfer more data than a narrow patch, and concurrent responses can arrive out of order. The prototype does not implement revision checking or conflict resolution. The [diet actions](https://github.com/corashina/Fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/client/src/actions/dietActions.js) and [API handlers](https://github.com/corashina/Fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/api/diets.js) provide the complete request path.

## Distinguishing identity from permission

The server uses Passport strategies for JWT authentication. The regular strategy checks the user's verified status; the administrator strategy checks the administrative role. Editing operations such as adding a recipe to a diet use the administrator strategy.

The distinction belongs on the server because the client-facing and administrator-facing screens share the same API. Choosing which screen to render does not determine which mutations a request may perform.

Coverage is uneven in the archived implementation. Some diet reads and comment operations use the regular strategy without a corresponding ownership check. Dynamic field names also need an allowlist before becoming database update paths. Those are limits of this prototype, rather than properties of a complete permission model.

## Keeping recipe identity stable

The schedule stores recipe names. That makes a meal slot readable and lets the interface find a recipe by comparing its name against the loaded catalogue.

A rename exposes the weakness of that representation. The schedule now contains a label that may no longer match a recipe. Duplicate names create a similar ambiguity. Using stable recipe identifiers would separate the relationship from the text displayed to the user.

Historical plans introduce another choice: should they reflect the latest recipe or preserve the recipe as it existed when the plan was prepared? The prototype does not version recipes. A system intended to preserve old plans would need to decide whether to store references, snapshots, or both.

These decisions affect PDF output as well as database design. A document generated next month should have a defined relationship to the plan the client saw today.

## Building the PDF from the same fields

The client uses pdfMake to construct a document definition. It groups the 28 meal fields into four schedule rows, adds recipe descriptions, and derives a shopping list from ingredient names. Page breaks separate the schedule from the recipe and shopping sections.

Generating a document definition gives the export its own layout while retaining the same underlying plan data. It also requires explicit decisions about table widths, text wrapping, and page boundaries. The implementation includes Polish text and bundled PDF fonts.

The [export code](https://github.com/corashina/Fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/client/src/routes/client/Diet.js) contains a selection mistake worth separating from the intended flow: it uses the recipe array as the left side of `||`, so the filtered selection is bypassed when that array exists. As written, the export can include the entire loaded catalogue. Ingredient deduplication produces names, not aggregated purchase quantities.

The prototype connects intake, editing, persistence, and printable output through a visible workflow. Its strongest lesson is the reach of a data-model choice: a recipe name used as an identifier affects editing, navigation, historical plans, and the shopping list at once.
