# Center Contact Flair Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Center the Stack Exchange profile flair beneath the Contact links without changing its dimensions or vertical spacing.

**Architecture:** Keep the existing Contact markup. Change only the `.flair` SCSS rule and its source-level style contract test.

**Tech Stack:** SCSS modules, Vitest.

## Global Constraints

- Keep the flair link block-level.
- Preserve `margin-top: calc(2 * #{$spacing})`.
- Center with automatic horizontal margins.
- Remove `position: relative` and `left: 50%`.
- Do not change other Contact content or layout behavior.

---

### Task 1: Center the Contact Flair

**Files:**
- Modify: `src/styles/contrast.test.ts`
- Modify: `src/styles/contact.module.scss`

**Interfaces:**
- Consumes: the existing `styles.flair` class used by `ContactPage`.
- Produces: a centered block-level flair with unchanged top spacing.

- [x] **Step 1: Write the failing style test**

Add a stylesheet assertion that `.flair` contains:

```scss
display: block;
margin: calc(2 * #{$spacing}) auto 0;
```

and does not contain `position: relative` or `left: 50%`.

- [x] **Step 2: Verify RED**

Run `npm.cmd test -- src/styles/contrast.test.ts`.

Expected: FAIL because the current flair uses a left offset instead of automatic horizontal margins.

- [x] **Step 3: Implement the minimal SCSS change**

Replace the `.flair` rule with:

```scss
.flair {
  display: block;
  margin: calc(2 * #{$spacing}) auto 0;
}
```

- [x] **Step 4: Verify GREEN and full build**

Run `npm.cmd test -- src/styles/contrast.test.ts`, then `npm.cmd run verify` and `git diff --check`.

- [x] **Step 5: Commit**

Commit the plan, test, and SCSS change with message `fix: center contact profile flair`.
