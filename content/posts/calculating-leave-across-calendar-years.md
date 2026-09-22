---
title: "Counting leave days across year boundaries"
description: "Cross-year leave calculations, public-holiday data, allowance validation, and refreshing balances after approvals in React."
date: "2023-06-13"
tags: [React, TypeScript, Date and time]
draft: false
---

A leave request looks small on screen: two dates, a category, a leave type, a comment, and a few attachments. The calculation behind those controls can span two allowance years, several public holidays, and a part-day leave type. Editing an existing request adds another wrinkle because the current balance may already include that request.

I worked on [Holiday](/works/holiday), a React and TypeScript leave-management application for employee requests, manager approvals, HR administration, and a shared calendar. React Query managed server state, while a parent application supplied session context and navigation.

The date calculation became the centre of the request form. I wanted the user to see the same working-day count that the form used for balance validation, including a request that crossed New Year's Day.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## A concrete cross-year request

Consider a request from 29 December through 5 January. The interval can contain weekends and holidays from two years. It can also draw from different yearly allowances. A four-hour leave type counts each eligible day as half a day, while an eight-hour type counts a full day.

The form built the calculation through this path:

```text
Selected start and end dates
    -> list of calendar years in the interval
    -> public holidays for each year
    -> weekdays minus public holidays
    -> fraction from leave-type hours
    -> working-day total
    -> allowance and balance for the relevant year
    -> validation message and request payload
```

I derived the year list from the selected range. A request within one year produced one query input. A request spanning December and January produced two. The holiday hook fetched each year's public holidays, flattened the results, and cached them for a day. React Query retained unused holiday data for seven days, which reduced repeat requests while someone edited several forms.

The working-day function normalized both endpoints to local midnight. It then visited each date in the inclusive interval, skipped Saturday and Sunday, and compared the date with a prepared holiday list. For an eligible date, it added `leaveTypeHours / 8` to the total. The function rounded the result to one decimal place.

This illustrative pseudocode captures the rule without copying the commercial source:

```ts
function workingDays(start, end, hoursPerDay, holidays) {
  const holidayKeys = new Set(holidays.map(toLocalDateKey))
  let total = 0

  for (let day = localMidnight(start); day <= end; day = nextDay(day)) {
    const weekend = day.getDay() === 0 || day.getDay() === 6
    if (!weekend && !holidayKeys.has(toLocalDateKey(day))) {
      total += hoursPerDay / 8
    }
  }

  return roundToOneDecimal(total)
}
```

## Choosing the allowance behind the number

The current user response included an allowance and remaining balance for the active year. A future-year request needed a different source. Once the user selected a start date in a future year, the form fetched that user's allowance record for the selected year. Until the query completed, the form withheld the balance calculation.

Categories determined whether a request consumed the remaining allowance. The UI skipped balance validation for categories excluded from that calculation. For a consuming category, it compared the working-day total with the available balance and showed the projected remainder.

Editing an existing request required restoring its old contribution before checking the new dates. The server's balance could already reflect the saved request. The form added the original working days back to the available amount, then subtracted the recalculated request. Without that adjustment, extending or shortening a request would compare the new total against a balance that still included the old deduction.

Cross-year display followed a narrower rule. If the end date fell in the next year, the form recalculated the portion from the start date through 31 December and used the current year's holidays for that segment. The displayed current-year remainder reflected the days charged before the year boundary.

This approach did not implement a ledger across an arbitrary number of allowance years. The request form also fixed the holiday country to Poland, even though user records contained country information. Country-specific schedules and regional holidays would need separate domain rules before the calculation could support other locations.

## Dates without accidental time shifts

Calendar-day values suffer when code treats them as instants. A date picker can create a local `Date`, an API can return an ISO timestamp, and a formatter can move the visible day after a timezone conversion.

I kept the working-day loop on local calendar dates and normalized the time before comparing endpoints. The form formatted request dates through a helper designed for local timezone handling. The calendar view used date-only request parameters for its visible week or month.

That convention suited this application because leave began and ended on whole local dates. It would need another model for overnight shifts or offices whose leave day follows a workplace timezone rather than the browser timezone. The calculation also assumed an eight-hour full day. The leave type supplied a fraction of that base, which covered the configured part-day cases without modelling work schedules per employee.

## One mutation changes more than one screen

Creating a request involved text fields and optional files. The mutation built multipart form data, appended each attachment, and sent one request. After success, it invalidated the leave list and current-user query. The next render could then show both the new request and the updated allowance summary.

Approval affected the leave list, pending queue, and balance summary, so the mutation invalidated all three query families. Rejection followed the same cache pattern and required a reason. Attachments used their own query key under a leave ID.

## Approval paths and role-shaped navigation

The embedded application read role claims and sent the parent a menu and route list. Managers gained the pending approvals page, while HR managers gained user and administration pages. Router checks shaped the interface; the backend still had to reject unauthorized operations.

Managers could approve from the pending queue. The project also included a link-driven page for approval and rejection. Approval submitted the token from the link, while rejection waited for a reason. That path reduced the steps needed to make a decision. Opening an approval link triggered the approval request, so a confirmation would better handle mail scanners and accidental opens.

## Turning ranges into a calendar

The shared calendar requested either the visible ISO week or the visible month. It then built a grid that included the surrounding days needed to complete the first and last weeks of a month.

For each calendar day, the view selected leaves whose inclusive range covered that date. A request from Monday through Wednesday appeared in three cells. Month mode marked days outside the current month, while week mode treated all seven cells as current. Category configuration supplied colours, with a small fallback palette for records without a custom colour.

This client-side expansion kept the API simple and gave the view one place to handle week and month layouts. Its cost grew with the number of visible days times the number of returned requests. The query limited records to the visible interval, which kept that work bounded for the intended view.

Mobile pages added pull-to-refresh around lists and approvals. The hook found the active scroll container, accepted the gesture at scroll position zero, and ignored touches that began in an input, select, or textarea. It capped the drag distance and awaited the caller's refresh before resetting its state. Since the app ran in an iframe, the handler stopped the accepted pull gesture from reaching the parent page.

## Boundaries I kept visible

The frontend gave users an estimate and blocked requests that exceeded the balance visible to it. The server still needed to validate dates, allowance, attachment data, and approval transitions. Another request could change the balance after the form calculated it. The public-holiday provider could fail or change its data.

The next refinement I would make is to inject the holiday calendar and work schedule into the calculation. That would remove the fixed country and eight-hour base from the form, and it would give the date rules a small input-output surface for cases such as leap years, year boundaries, and part-day leave.

The useful design choice was the separation between inputs and calculations. The form gathered dates, leave type, category, holidays, and allowance data. Pure helpers counted days. React Query handled remote lifetimes, and mutations named the views they made stale. That structure made cross-year behaviour traceable from two selected dates to the balance shown beside the submit button.
