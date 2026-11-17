---
title: "From a client questionnaire to a printable weekly meal plan"
description: "Carrying one plan through a questionnaire, an editable schedule, MongoDB and a printable PDF in a React, Redux and Express app for dietitians."
date: "2018-08-13"
tags: [React, Redux, Node.js, MongoDB]
draft: false
---

Fitmed was a system for dietitians and their clients, built with React, Redux, Express and MongoDB. A client filled in a questionnaire about their diet and preferences. The dietitian kept a recipe catalogue, placed recipes into the client's weekly schedule and added comments. The client could then view the plan and download it as a PDF with the schedule, the recipes and a shopping list.

I built it with one other developer over July and August 2018. This article follows the PDF export milestone of 13 August.

The main engineering task was carrying one plan through four forms: a questionnaire, an editable schedule, a database document and a printable document. All four had to agree.

## Modelling the work around a weekly schedule

The data model has three parts. Products hold nutritional information. Recipes combine ingredients with preparation steps and nutritional values. A diet holds the client's questionnaire answers and their meal schedule.

The schedule covers four meal periods across seven days, stored as 28 named fields such as `time_01_monday`, plus four fields for the meal times.

I chose that shape because it matches the screen exactly. The schedule is a 7 by 4 table in the interface, a 7-column table in the PDF and a set of named slots in the API. Every layer can address the same cell by the same name, with no conversion layer between the database and the screen. For a fixed weekly format, that simplicity was worth more than flexibility. If the format had needed to change, for example with a fifth meal or a two-week plan, the next step would have been an array of days and meals. The [diet model](https://github.com/corashina/fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/models/Diet.js) keeps the questionnaire and the schedule in one document.

## Following an edit through the application

The dietitian picks a recipe and a meal slot. A Redux action sends the recipe and the slot name to an Express endpoint. The server adds the recipe with MongoDB's `$addToSet`, reads back the updated diet and returns it. The reducer replaces its diet state with that response.

```text
Select recipe and meal slot
    -> Redux action sends the change
    -> Express authenticates and updates the diet
    -> server returns the updated document
    -> reducer replaces the current diet
    -> connected views render the result
```

Returning the whole document means the screen always shows what the server actually saved. The browser doesn't need its own copy of the update rules, and `$addToSet` stops the same recipe from landing in one slot twice. Removing a recipe follows the same path with `$pull`. The [diet actions](https://github.com/corashina/fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/client/src/actions/dietActions.js) and [API handlers](https://github.com/corashina/fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/api/diets.js) show the full request path.

This round trip is easy to follow and debug. At a larger scale, I would send smaller patches and add revision checks so that two dietitians editing the same plan could not overwrite each other.

## Separating identity from permission

Clients and dietitians use the same API, so the screen a user sees can't decide what they're allowed to change. The server enforces that with two Passport JWT strategies. The regular strategy checks that the user is verified. The administrator strategy also checks the dietitian role, and every schedule edit goes through it.

That split keeps the rule in one place on the server. A client who calls the edit endpoint directly is refused, whatever the interface shows them.

## Linking schedules to recipes

A meal slot stores the recipe's name. That keeps the slot readable in the database and in the PDF, and the interface can look up the full recipe from the loaded catalogue.

Working on this raised a broader question that any planning system has to answer: when a recipe changes later, should old plans change with it? A client's printed plan from last month should still match what they were given. The options are to store a reference to the recipe, a snapshot of it, or both. In a next version, I would store stable recipe IDs together with a snapshot taken when the plan is published. Renames would then stay safe, and historical plans would stay exactly as delivered.

## Building the PDF from the same fields

The client builds the PDF with pdfMake. It groups the 28 meal fields into a weekly table, adds the description of each recipe and builds a shopping list from the ingredients. Page breaks keep the schedule, the recipes and the shopping list on separate pages. The document includes Polish text, so it bundles fonts that support Polish characters.

Building a document definition, instead of printing the web page, gave the PDF its own print layout while reading the same plan data. Column widths, text wrapping and page breaks were all chosen for paper rather than for the screen. The [export code](https://github.com/corashina/fitmed/blob/f6165d8bb54eb8343effa1ab50bada59817d570e/client/src/routes/client/Diet.js) shows the full document definition.

## What the project taught me

Fitmed connected intake, editing, storage and printing into one workflow that a dietitian could actually use. Its most lasting lesson was how far one data-model decision reaches. The way a schedule refers to a recipe shaped the editor, the API, the PDF and what happens to a plan months later. I now settle that question early in any system that produces documents.
