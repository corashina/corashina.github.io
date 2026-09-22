---
title: "Connecting automation workflows to an ERP"
description: "A small TypeScript integration that turns workflow items into authenticated JD Edwards Orchestrator requests, with the prototype's limits left visible."
date: "2022-03-07"
tags: [n8n, TypeScript, Integration]
draft: false
---

I built a custom n8n community node that calls a JD Edwards Orchestrator method for address-book data. The project is compact: one node type, one credential type, and the package metadata that lets n8n discover both after compilation.

The source captures a useful integration pattern. A workflow item supplies business parameters. The node turns them into an authenticated HTTP request and returns the response as n8n execution data. It also captures several prototype shortcuts that I would address before deployment.

*Retrospective: the date is an editorial placement, not a verified project completion date.*

## Describing the node to n8n

An n8n node begins with a declarative description. The project defines a display name, icon, input and output ports, required credentials, and fields that appear in the workflow editor.

The main fields are an orchestration method and an address number. A collection field accepts repeated custom name/value pairs. That last field lets a workflow send parameters that the initial node version did not anticipate.

The editor schema and the execution code share parameter names. During a run, `getNodeParameter` reads the value for the current item. The node then starts its JSON body with the address number and copies non-empty custom pairs into that object.

An illustrative request looks like this:

```json
{
  "AddressNumber": "1001",
  "BusinessUnit": "EU",
  "IncludeInactive": "false"
}
```

The extra fields above are generic examples. The node treats custom values as strings and does not define those particular business fields.

## Processing workflow items one at a time

n8n can pass several items into one node execution. The implementation loops over the input array and reads parameters at each item index. It constructs the endpoint by trimming a trailing slash from the configured base URL and appending the selected orchestration method.

The request uses JSON over `POST`. Rather than creating an HTTP client, the node calls n8n's `httpRequestWithAuthentication` helper and names its credential type. n8n can then inject authentication while the node focuses on the request body and response.

```ts
// Illustrative pseudocode
for (const [index, item] of inputItems.entries()) {
  const method = getParameter('method', index);
  const address = getParameter('addressNumber', index);
  const body = buildBody(address, getParameter('extra', index));

  const response = await requestWithCredentials({
    method: 'POST',
    url: join(baseUrl, method),
    body,
  });

  output.push({ json: { method, address, response } });
}
```

The real output also includes the request body and a success flag. Returning the submitted values makes a workflow result easier to correlate with its input, though it can duplicate sensitive business data in execution history. I would make that diagnostic envelope optional.

## Respecting n8n failure behavior

The node catches request errors inside the item loop. If the workflow enables `continueOnFail`, the node emits an item with the error message and `success: false`, then continues with the remaining inputs. Without that option, it throws `NodeOperationError` with the item index.

That distinction belongs in a batch integration. One missing address can become a failed row while other items continue, or the workflow can stop at the first error when partial output would cause trouble downstream.

The error path also needs disciplined diagnostics. An error should identify the operation and item while leaving credentials inside n8n's credential store.

## Packaging the integration

The package targets Node 20 or newer and declares `n8n-workflow` as a peer dependency. Its build script removes the previous output, compiles TypeScript, and copies the icon. The `n8n` section of `package.json` points to the compiled credential and node files under `dist`.

That metadata is small, but n8n will not discover the integration without it. The package also includes formatting, linting, and prepublish scripts. The repository ships generated JavaScript alongside the TypeScript source.

## Prototype limits

The snapshot identifies itself as version `0.1.0` and still uses the starter README. It has no focused tests. Before using the node against a live system, I would verify its credential template against the target n8n runtime, replace environment-specific defaults with neutral placeholders, and validate the orchestration method. Tests should cover URL joining, extra parameters, batch failures, and clean diagnostics.

This source prototype covers the central adapter work: editor fields, item-by-item request construction, n8n-managed credentials, batch failure behavior, and package registration. Publication, verification, and production hardening would form a separate stage.
