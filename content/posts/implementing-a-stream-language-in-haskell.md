---
title: "Implementing a language for recursive stream calculations"
description: "From lexer and grammar to stream evaluation, error reporting, and a small Haskell interpreter."
date: "2019-05-09"
tags: [Haskell, Language design, Compilers]
draft: false
---

For the COMP2212 Programming Language Concepts coursework, we built a language for transforming streams of integers. Each non-empty program line defines an output stream. An expression can read input values, inspect its current position, and refer to values in another output stream.

A running total fits into one line:

```text
in(n) + (n > 0 ? out(n - 1) : 0)
```

At position zero, the expression returns the first input value. At later positions, it adds the current input to the previous output. That small example exercises parsing, conditional evaluation, input indexing, and recursive evaluation of the program itself.

This was a joint project. My recorded contributions include stream reading, transposition and multi-stream output, build and test tooling, and problem programs. The repository spans March to May 2019; the date here follows the final submission on 9 May.

## Giving each stage a specific representation

The implementation separates lexical analysis, parsing, evaluation, and command-line input/output.

| File | Responsibility |
| --- | --- |
| `Tokens.x` | Alex token definitions and source positions |
| `Grammar.y` | Happy grammar, precedence, and expression constructors |
| `Eval.hs` | Evaluation rules and runtime checks |
| `Main.hs` | Program loading, input streams, and output formatting |

The lexer recognizes integer literals, operators, function names, and `n`. The parser turns those tokens into an expression tree with constructors such as `Add`, `Tern`, `In`, and `Out`. The evaluator pattern-matches on that tree.

This separation helped localize errors. An unrecognized token is a different failure from an ambiguous grammar or a valid expression that indexes outside an input stream. Treating those as separate stages also made the build explicit: Alex generates the token module, Happy generates the parser, and GHC compiles the interpreter.

## Resolving precedence in a compact syntax

The language combines arithmetic, comparisons, boolean operators, and a ternary conditional. Without precedence rules, an expression such as `in(n) + 3 * in(n, 1)` has more than one possible grouping.

The Happy grammar declares precedence levels from comma and conditional operators through arithmetic and unary operators. Unary minus gets its own precedence marker. Function calls supply default stream zero when the second argument is omitted.

The commit history records work on shift/reduce conflicts and ternary precedence. These are concrete consequences of allowing several forms of expression in one grammar. Adding a production can change how the parser handles an existing combination, even when the new form looks isolated.

The implementation evaluates expressions to integers. Boolean results use zero for false and one for true; conditions treat nonzero values as true. An older README description disagrees with that rule, so the evaluator is the reference for this account.

## Turning rows of input into streams

Input arrives as whitespace-separated rows. Expressions address streams by column, so the command-line layer groups values using the first row's width and transposes the result.

For example:

```text
Input rows:          Internal streams:
1 10                 [1, 2, 3]
2 20                 [10, 20, 30]
3 30
```

The evaluator receives the input columns, the parsed program lines, a position, and an output-stream index. After evaluating output columns, the command-line layer transposes them back into rows for printing.

Keeping source line numbers alongside expressions preserves useful diagnostics after removing blank lines and comments. The first output stream might come from the fourth physical line of the file. Reporting only its array index would send the programmer to the wrong place.

The input layer assumes a rectangular integer dataset and retains the input for indexed access. It does not enforce bounded-memory processing of a live stream. Uneven rows and malformed input would need more deliberate validation in a revised interpreter.

## Evaluating an output that refers to another output

An `in` expression reads a value from the input columns. An `out` expression evaluates the target output expression at the requested position. There is no separate stored table of previously computed output values in this implementation.

That recursive definition makes cumulative calculations concise. It can also repeat work. Calculating a running total at position `n` reevaluates the preceding total, and generating the complete output repeats those prefixes. Memoizing output cells would change that cost, but would also require tracking cells currently under evaluation to detect cycles.

The archived evaluator rejects a direct reference to the same position in the same output stream. It does not implement general cycle detection across several cells or streams. The distinction matters for a language that allows expressions to refer to other expressions.

## Making errors part of the language

The evaluator checks division and modulo by zero, negative exponents, negative square-root input, and stream bounds. Runtime messages include the source line and current stream position, connecting an evaluation failure to the expression that caused it.

The sample programs cover transformations such as duplicated streams, weighted sums, and recurrences. A command script runs the test programs, though it does not compare their output against an automated expected-result suite.

The project brought the whole language pipeline into one small system. Changing the syntax required checking its parse tree; changing `out` required thinking about recursion and cost; changing input layout required keeping stream indices and diagnostic locations aligned. Those connections are what made the interpreter more demanding than its short example programs suggest.
