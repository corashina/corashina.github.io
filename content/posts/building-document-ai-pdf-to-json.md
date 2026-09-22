---
title: "From uploaded PDFs to JSON people can review"
description: "Asynchronous PDF processing, configurable prompts, JSON repair, and human review in a .NET and React document AI platform."
date: "2026-02-05"
tags: [AI, .NET, React]
draft: false
---

I worked on a [document AI product](/works/icr/) that turns uploaded business documents into structured JSON. The visible result looks modest: upload a PDF, wait for processing, inspect the fields. The engineering spans an event-driven .NET service, configurable model handlers, prompt management, a React review interface, and a feedback path for corrected values.

The main challenge came from uncertainty at several layers. A customer can upload the wrong document type. A model can return malformed JSON. A prompt that works for one document cluster can lose quality on another. An operator needs enough context to correct a result without seeing internal configuration that their role should hide.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## Keeping upload work short

The upload endpoint does not hold an HTTP request open while an AI model processes a file. It parses one multipart upload, validates the tenant and document type, checks the caller's permission, validates optional JSON metadata, and creates a pending document record. The service then stores the binary and publishes an event. The caller receives an accepted response with the document ID.

```text
multipart upload
    -> permission and request validation
    -> pending database record
    -> binary file storage
    -> Event Grid message
    -> accepted response
```

An Azure Function receives the event, extracts the tenant, application, document, and user IDs from its subject, and reloads the file from storage. The event payload selects one of four paths: normal processing, base and identifier prompt testing, tuned prompt testing, or field prompt testing. The normal path can hand a completed result to a separate integration service.

This split gives the upload endpoint a clear boundary. It accepts and records work. The analyzer owns model calls and downstream integration. A failed model request does not keep a browser connection alive, and each stored document carries a status that the UI can query.

The queue boundary also introduces operational work. The system must treat duplicate or late events with care. The processor skips a document that already reached `COMPLETED`, but this code does not provide a general single-delivery guarantee. Event delivery, storage, and database updates remain separate operations.

## Classifying before extracting

The processor separates identification from extraction. It starts by loading settings for the tenant and document type. It then runs an identifier prompt, normalizes that result, and can create an embedding when the document type uses vector identifiers.

The identifier points the processor toward a tuned prompt. For vector identifiers, the service stores the vector and its model configuration with the document. The code warns when a new embedding uses a different model from the prior configuration because vectors from different embedding spaces may not form meaningful clusters.

The normal path reads like this:

```text
stored document
    -> identifier prompt
    -> optional embedding and cluster lookup
    -> base prompt
    -> cluster-specific tuned prompt
    -> ordered final prompt
    -> structured extraction
    -> validation and persistence
```

I like this design because it makes document variation explicit. A base prompt defines the shared task and output shape. An identifier separates recognizable groups. A tuned prompt can add instructions for one cluster without copying the full base configuration.

The service resolves text and embedding handlers from model records in the database. It registers separate Google GenAI and Vertex handlers for text and embeddings, then chooses a handler by name. A compatibility branch maps legacy text-handler names to the matching embedding handler. That migration detail matters in a live configuration system: changing the code shape cannot make older model rows unreadable.

This was model routing and prompt engineering around hosted models. It did not train a proprietary model. We had to judge extraction quality against reviewed documents rather than infer it from the architecture.

## Treating prompts as structured configuration

Prompt text tends to become hard to reason about when code concatenates strings at each call site. This system gives prompt construction its own service. It recognizes five sections: base content, requirements, output structure, tuned instructions, and field instructions. A document-type record can define their order.

The builder validates each configured section name against the allowed set. It omits empty sections, adds the fixed lead-in for an output schema or tuned instructions, and sanitizes the final text. The extraction call combines that constructed instruction with the base content and the original file stream.

The UI exposes the same concepts to an operator. Separate tuning pages handle base, identifier, tuned, and field prompts. An operator can upload a sample document, run a selected prompt mode, wait for its document status, inspect the output, and save prompt changes. The prompt list keeps versions and active state visible, while role checks decide which controls a user receives.

That workflow made prompt work repeatable. The operator tests against a real document and sees the resulting JSON beside the form that produced it. They do not need to edit a deployment setting for each experiment.

## Recovering usable JSON

A prompt can request JSON and still receive a response with a missing brace, a trailing comma, or Markdown fences. The pipeline applies a small deterministic repair pass first. It balances braces and brackets, fixes several comma and quote cases, removes trailing commas, and quotes simple unquoted keys. It accepts the modified text when a JSON parser validates it.

The final extraction has a second repair path. If deterministic cleanup cannot produce valid JSON, the processor asks the configured text model to repair the response under a bounded retry count. It validates each attempt and adds repair usage to the original token totals. A failed repair marks the response as an error rather than storing invented structure as a successful extraction.

A simplified version of the control flow looks like this:

```text
model response
    -> deterministic cleanup
    -> parse
       -> valid: keep result
       -> invalid: bounded AI repair
    -> parse again
    -> store result or failure
```

Deterministic repair has limits. Counting delimiters cannot infer the intended business value, and aggressive string fixes can misread unusual text. The final parser remains the authority. The AI repair step costs tokens and introduces another model call, which the usage record needs to include.

## Giving reviewers context and safe editing

The document screen lists records with filters for type, prompt, date, uploader, metadata, identifier, and status. Opening a record shows its document type, prompt names, identifier, timestamps, result, raw JSON view, and metadata. Master users can see extra prompt details.

The JSON editor keeps display and editing separate. It parses a result when possible, preserves raw text when parsing fails, and enables Save once the edited content passes `JSON.parse`. The repair mutation sends the serialized result back to the document endpoint. That offers a practical recovery path for a completed extraction with a field error or malformed structure.

A separate backend correction path adds another guard. It strips the `Result.` prefix from a field path, loads the active base prompt's output schema, and records a correction when that schema contains the field. If a reviewer changes a value back to its original value, the service removes the saved correction. The document records whether it has a manual evaluation.

The correction path depends on the platform's authorization and tenant boundaries. The reviewer UI can restrict editing controls, but the API remains responsible for enforcing access to the document and its changes.

## Turning corrections into an engineering signal

Corrections can feed an autotune workflow. The processor gathers new correction requests, joins them to completed final documents, filters by tenant, document type, cluster, and date, then groups records by cluster. It limits the number of documents in one payload and includes the active base and tuned prompt context.

Another service calls the tuning workflow and records request state such as new, pending, failed, or processed. Timed-out pending requests and failed requests can return to the queue under a run limit.

The UI also exposes accuracy and usage views. Operators can filter corrections by tenant, document type, and date. Usage details group token, page, and document counts. These screens turn model operation into something a team can inspect rather than a black-box request log.

Autotune here means orchestrating correction data and prompt context through a separate workflow. It proposes prompt changes rather than training a model, and a human still needs to judge a proposed prompt and its effect.

## Operational boundaries

The system records useful provenance: prompt IDs, model configuration, token counts, page and field counts, the identifier, and its cluster. Those records help explain a result and its cost. Field correctness still requires review or domain validation.

Provider-specific handlers sit behind resolvers, with two Google access paths and configuration-driven selection. Adding another provider would still require a handler that implements the expected text or embedding contract. The asynchronous flow improves separation of concerns, while delivery and persistence need idempotency and monitoring around their boundaries.

My work on this product reinforced a practical pattern for document AI. Keep ingestion short, preserve the source file, separate identification from extraction, and give reviewers a direct path to correct structured output. Model quality remains an empirical question. The surrounding software determines whether a team can test, inspect, and improve it.
