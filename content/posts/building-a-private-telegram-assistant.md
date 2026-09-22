---
title: "Building a private Telegram assistant with a fictional daily life"
description: "Building a private Telegram assistant for shared plans, reminders, and a fictional daily life—while keeping real records and generated stories separate."
date: "2026-06-21"
tags: [AI, Telegram, Automation]
draft: false
---

I built an assistant for a private Telegram group with two authorized users. It helps with shared plans and reminders. It also plays a fictional character who describes daily activities and sends generated photos.

That combination creates some specific engineering problems. A fictional trip to the park must stay out of the real household calendar. A message between the two humans should not trigger an answer. A failed photo request must not turn into a story about a broken camera.

The project uses OpenClaw for the agent runtime and Telegram integration. I added JavaScript plugins, file-based state, and a scheduled photo runner. The deployment targets a DigitalOcean server with 1 GiB of RAM and 2 GiB of swap.

## The system around the chat

Telegram provides the interface. OpenClaw handles model calls, tools, and conversation history. OpenRouter supplies the configured text and image models. The base configuration uses DuckDuckGo for web search.

The repository has three main extensions:

| Component | Responsibility |
| --- | --- |
| `conversation-replies` | Add trusted sender context, filter replies, and enforce image settings |
| `openrouter-limits` | Count completed free-model calls observed by its hook and expose `/limits` |
| Household extension | Provide household commands, structured records, and Telegram buttons |

The daily photo runner shares code with the household extension, but runs as a separate process. A systemd timer starts it through `docker exec` each minute.

The distinction between available code and enabled features matters here. The base configuration loads the reply and usage plugins. The household commands need a separate configuration step. Mounting their directory into the container does not enable them.

The main paths look like this:

```text
Private Telegram group
    -> OpenClaw gateway
        -> sender context and conversation policies
        -> model and permitted tools
        -> reply filter
    -> Telegram reply

systemd timer
    -> daily runner
        -> persisted schedule and scene history
        -> text proposal and review
        -> image generation
        -> Telegram delivery and receipt
```

I kept scheduling outside the conversation loop. A person asking for a selfie and a timer sending a morning update need different delivery rules.

## Deciding when to speak

The bot accepts messages from one configured group and two numeric Telegram user IDs. Direct messages are disabled.

Inside that group, `requireMention` is `false`. Someone can ask the assistant a question without a name mention. The model uses the current message, recent conversation, and reply targets to decide whether to answer.

Consider two illustrative messages:

> @assistant, remind us about the appointment tomorrow.

> Can you pick up the shopping on your way home?

The second message needs context. It could address the other person. For an unclear recipient, the policy tells the assistant to return `NO_REPLY` and use no tools.

This is a judgment call by the model. It can make mistakes, and an eligible message can consume a model request even if the assistant stays silent. I accept that cost to support ordinary follow-ups without repeated mentions.

Sender identity follows a stricter rule. The reply plugin reads the Telegram sender ID from the current run. It adds the matching recipient context to the prompt. It does not infer identity from language, quoted text, or a display name.

Telegram messages use separate queued runs while retaining shared history. Scheduled posts address both people. That prevents the last person who spoke from becoming the assumed recipient of a morning update.

## Keeping fiction out of shared memory

I split the agent instructions across files with distinct jobs. `SOUL.md` defines the character's voice and fictional role. `AGENTS.md` defines group participation. `TOOLS.md` defines tool use and image behavior.

The assistant can invent harmless activities that fit its fictional character. It must not invent bookings, expenses, or commitments for the users. A fictional afternoon with friends belongs in the story, not in the household's durable facts.

`MEMORY.md` holds shared facts. The documented consolidation job runs each night in the configured timezone. It reviews recent conversation and can add at most five durable facts. Its instructions exclude generated scenes and fictional project progress. It sends no chat message.

The daily runner keeps its scene history in separate JSON state. It needs that history to avoid repeating activities. Mixing those records into shared memory would make later answers treat fiction as context for real plans.

Deployment preserves this separation. The configuration renderer copies seed memory only if the destination file does not exist. Policy files use read-only mounts. Releasing a new character prompt should not replace accumulated household memory.

## Household features with explicit state

The household extension contains shopping and packing lists, travel itineraries, shared decisions, and reminder completion records. It exposes commands such as `/today`, `/week`, `/events`, and `/lists` without a model call.

The records use Markdown files containing a marked JSON block. That gives an operator a readable file while preserving a defined data format for the code.

The ledger store validates data before writing. It serializes updates within the process, writes a temporary file, then renames it over the destination. Malformed records stop the operation. This storage model fits the current single-process household service; its in-memory queue does not coordinate multiple independent writers.

Destructive actions, such as clearing a list, produce confirmation buttons. A confirmation stores the target ID, expected version, group, requester, and expiry time. The handler checks the Telegram context before consuming it. Version checks reject a confirmation if someone changed the record after the request.

Shared decisions accept Yes, No, or Maybe from both users. Recurring reminders distinguish completing one occurrence from completing the full series. That distinction needs explicit state because disabling a series affects future reminders.

The repository also documents a weekly summary and integration with OpenClaw's document extraction plugin. Those need setup beyond the base deployment. I reused the runtime's document support instead of adding another parser.

## Generating a day without repeating it

The daily runner plans a morning post and one or two later posts within a defined local-time window. Later posts require at least three hours between confirmed deliveries. Generation can delay the actual send.

Each slot starts with a text proposal. The model returns a JSON object with a category, activities, setting, visual description, and caption. An activity includes both an action and a purpose. The validator checks exact keys, string lengths, and allowed values.

The runner checks the proposal against recorded history before spending an image call. It rejects exact normalized repeats in code. A text model then reviews the candidate against history in batches of 25 records.

The reviewer must return the IDs it checked. A claim that an activity repeats history also needs a matching record ID and the original action text. The code verifies that evidence. A model cannot reject a scene by inventing an earlier event.

This still depends on model judgment for meaning. Changing a shirt or camera angle should not make the same activity count as new. Conversely, two different games can share a setting without repeating an action.

Each slot permits three proposals and one image generation. A proposal attempt can involve several model requests, including history reviews and provider fallbacks. Review work grows with history. Batching limits each request's input, but does not bound the total work over the project's lifetime.

After approval, the runner requests one 1K, 4:3 JPEG. It checks the returned file and compares its SHA-256 hash with earlier images. That catches identical files. It does not establish visual novelty or confirm that the image matches the prompt.

## A timeout can leave delivery uncertain

The delivery code records progress before external calls:

```text
planned -> reserved -> generating -> ready -> sending -> sent
```

It also records `skipped` and `unknown`. Those states carry different information.

A text failure can leave the slot eligible for another attempt, within its proposal limit and sending window. An image request or Telegram send can time out after the remote service has accepted it. Retrying that operation could spend money again or post the same update twice.

The runner marks interrupted work after reservation as `unknown` and does not replay it on the next tick. It records `sent` only after receiving a Telegram message ID.

This favors a missed post over a possible duplicate. It does not promise exactly-once delivery. There is still a gap between Telegram accepting a message and the runner saving the receipt.

For daily state, I use a file lock, temporary-file writes, `fsync`, and rename. On Linux, the writer also syncs the containing directory. The proposal count survives interrupted text attempts. Removing history to force another send would defeat these protections.

## Consistent image inputs

Conversation photos and scheduled photos share a reference-image loader. An explicit header identifies the people included in a scene. The loader selects their local reference images, removes the header, and adds identity instructions for the image provider.

The reference set uses owner-supplied photographs, with two views per person. A request that needs those references fails before generation if they are unavailable. The loader also keeps the human identities separate from the fictional character's appearance.

These checks establish which inputs reach the provider. They cannot guarantee facial likeness in the result. Selected reference bytes leave the server as part of the image request, so the private group is an access restriction, not a claim of local inference.

The conversational hook enforces the configured image model before the tool call. Successful conversation photos contain the image without scene narration. Scheduled posts retain their matching first-person captions.

## Handling model failures without exposing the draft

The base configuration requires three distinct OpenRouter text model identifiers ending in `:free`. Image generation uses a separate configured model and budget. Free text inference does not make the whole deployment free.

The daily runner gives each text-model attempt up to 180 seconds within a 15-minute run deadline. It validates responses instead of trusting a request for JSON. It accepts a JSON object or one JSON code block, and rejects extra prose, truncated output, and tool calls.

A recorded text-generation failure illustrates the problem. The timer ran on time, but invalid responses and a failed review exhausted the slot. One provider returned HTTP 429. Another response hit the token limit.

The repair added explicit field limits to prompts, passed rejection reasons into the next proposal, and required evidence for repeat claims. The runtime raised the response limit to 4,096 tokens and disabled reasoning in the provider payload for these bounded JSON tasks.

Ordinary replies need a separate safeguard. The reply plugin cancels payloads marked as reasoning or commentary. Before delivery, it checks for copied reasoning text and explicit drafting language, then allows one correction pass. It retains bounded, expiring text hashes rather than conversation text for that guard.

These checks catch known failure patterns. They cannot detect every case where a model labels internal drafting as a final answer.

## Running and checking the deployment

Docker Compose defines a configuration job, the gateway, and an admin CLI service. The gateway runs as a non-root user with a read-only root filesystem, dropped capabilities, and `no-new-privileges`. Mutable state lives in a named volume. Secrets enter through mounted files.

The gateway binds to loopback, and Compose publishes no host port. Host setup restricts inbound traffic to SSH. The gateway has a 768 MiB memory limit and a 512 MiB Node heap limit.

The agent's tool permissions form another boundary. The base configuration denies shell execution and browser control, and limits file tools to the workspace. The trusted operator and scheduled runner retain capabilities that the conversational agent does not receive.

Tests use Node's built-in test runner. They cover access checks, stale confirmations, reply filtering, scene review, interrupted delivery, and configuration generation. Runtime probes check SDK capabilities and synthetic model behavior. Some generate no images and send no Telegram messages, which lets me check a deployment without posting into the group.

The project still has operational limits. Free providers can fail. Semantic review can make mistakes. Scene history keeps growing. Local deployment backups do not protect against losing the server: the documented setup has no backup outside it.

Those limits shape how I maintain the assistant. I preserve state during deployment, check the runtime after updates, and keep uncertain deliveries available for inspection. The fictional activity can change with each post. The records of requests, model calls, and confirmed sends need to remain precise.
