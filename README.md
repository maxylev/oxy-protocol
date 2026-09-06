# oxy-protocol

A single-file Node.js reference server for **Oxana Universal Group Agent Protocol 1.0**.

Run a durable multi-device group chat with a dark responsive web UI, an OpenAI-compatible AI participant, semantic `SPEAK / SILENT` participation, tool/capability execution, asynchronous Operations, request freshness checks, and headroom-based context checkpointing.

```bash
npx oxy-protocol
```

The entire runtime **and the complete browser UI** live in one source file: `oxy-protocol.js`.

The npm package only adds `package.json`, `README.md`, and the MIT license around that one runtime file.

---

## What you get

- **Multi-device realtime room** over standard HTTP + Server-Sent Events (SSE).
- **No frontend build step** and no React/Vite/Webpack.
- A polished responsive **dark group-chat UI** for desktop and mobile.
- Stable participant IDs and revisioned display-name identity.
- Canonical immutable message Events persisted to JSONL.
- OpenAI-compatible model transport for OpenAI, OpenRouter, or another compatible endpoint.
- A separate semantic participation call so Oxy can choose `SPEAK` or `SILENT` instead of replying to every message.
- No universal exact-name/wake-word regex routing.
- Generic JSON-Schema-validated capabilities using **Ajv 2020-12**.
- Sync capability results as Observations.
- Async capabilities as durable Operations that can complete later.
- Immutable ActionRecord audit snapshots.
- RequestSnapshot freshness checks for participants, role, capabilities, journal, and context epoch.
- Exact finalized-request hashing before the main model call.
- Headroom-based context budgeting — **not** a fixed `80%` rule.
- Checkpoint compaction with a model-derived semantic digest, recent verbatim Event refs, durable EventLog, local retrieval, and `W → H` handoff behavior.
- Atomic room-state snapshots and restart recovery.
- Optional shared access key for a private LAN/test deployment.
- Rate limits, request-size limits, CSP nonces, `textContent` rendering, and basic secure-response headers.
- Optional browser speech-to-text button when `SpeechRecognition` is available.

The bundled web application implements the Protocol 1.0 **`session-public` room profile**. Private `ContextView` topologies, full realtime audio transport, distributed databases, and production identity providers are intentionally application-level extensions described later in this README.

---

## Requirements

- **Node.js 20+**
- npm
- Optional: an OpenAI-compatible API key/model

The server uses Node's built-in HTTP server and `fetch`. The only runtime npm dependency is `ajv` for JSON Schema 2020-12 validation.

---

# Quick start

## 1. Chat server without AI

Useful to test the UI and multi-device networking first:

```bash
npx oxy-protocol --no-ai
```

Open:

```text
http://localhost:8787/?room=general
```

The CLI also prints LAN URLs such as:

```text
http://192.168.1.42:8787/?room=general
```

Open the same URL from another phone/laptop on the network and choose a different display name.

---

## 2. OpenRouter

```bash
export OPENROUTER_API_KEY="..."
export OXY_MODEL="openai/gpt-5.6-luna"

npx oxy-protocol
```

Or explicitly:

```bash
export OXY_API_KEY="..."
export OXY_BASE_URL="https://openrouter.ai/api/v1"
export OXY_MODEL="your/provider-model"

npx oxy-protocol
```

`OXY_MODEL` is intentionally not hardcoded by the package. Choose a route that has been certified for your use case.

---

## 3. OpenAI-compatible endpoint

```bash
export OPENAI_API_KEY="..."
export OXY_MODEL="your-model"

npx oxy-protocol --base-url https://api.openai.com/v1
```

For another compatible service:

```bash
OXY_API_KEY="..." \
OXY_BASE_URL="https://llm.example.com/v1" \
OXY_MODEL="my-model" \
npx oxy-protocol
```

---

# `npx` usage

```text
oxy-protocol 1.0.1

Usage:
  npx oxy-protocol [options]

Options:
  --host <host>       Bind host (default 0.0.0.0)
  --port <port>       HTTP port (default 8787)
  --data <dir>        Data directory (default ~/.oxy-protocol)
  --model <model>     OpenAI-compatible model id
  --base-url <url>    OpenAI-compatible /v1 base URL
  --room <id>         Room shown in startup URL (default general)
  --no-ai             Start chat UI without model calls
  -v, --version       Print version
  -h, --help          Print help
```

Example:

```bash
npx oxy-protocol --port 9000 --room product-team
```

Open:

```text
http://localhost:9000/?room=product-team
```

---

# Environment variables

| Variable                     | Purpose                                              | Default                                                       |
| ---------------------------- | ---------------------------------------------------- | ------------------------------------------------------------- |
| `OXY_API_KEY`                | Preferred OpenAI-compatible API key                  | unset                                                         |
| `OPENROUTER_API_KEY`         | Used if `OXY_API_KEY` is absent                      | unset                                                         |
| `OPENAI_API_KEY`             | Used if the two above are absent                     | unset                                                         |
| `OXY_MODEL`                  | Main model route                                     | **required for AI**                                           |
| `OXY_BASE_URL`               | OpenAI-compatible `/v1` URL                          | OpenRouter when `OPENROUTER_API_KEY` exists, otherwise OpenAI |
| `OXY_PARTICIPATION_MODEL`    | Optional cheaper/faster semantic participation route | `OXY_MODEL`                                                   |
| `OXY_COMPACTION_MODEL`       | Optional checkpoint summarizer route                 | `OXY_MODEL`                                                   |
| `OXY_AGENT_NAME`             | Visible AI name                                      | `Oxy`                                                         |
| `OXY_ACCESS_TOKEN`           | Shared access gate for room APIs                     | unset                                                         |
| `OXY_ADMIN_TOKEN`            | Enables async-operation completion HTTP endpoint     | unset                                                         |
| `OXY_DATA_DIR`               | Persistent data directory                            | `~/.oxy-protocol`                                             |
| `OXY_CONTEXT_LIMIT`          | Provider context limit used for budget guard         | `32000`                                                       |
| `OXY_WORKING_CONTEXT_LIMIT`  | Product working limit                                | `32000`                                                       |
| `OXY_OUTPUT_RESERVE`         | Reserved output tokens                               | `2200`                                                        |
| `OXY_SAFETY_RESERVE`         | Context safety reserve                               | `1800`                                                        |
| `OXY_NEXT_TURN_RESERVE`      | Reserve for the next realistic turn/tool cycle       | `2200`                                                        |
| `OXY_POST_COMPACTION_TARGET` | Desired compacted working size                       | `15000`                                                       |
| `OXY_RECENT_TAIL_EVENTS`     | Approximate recent verbatim Event tail               | `36`                                                          |
| `OXY_MAX_OUTPUT_TOKENS`      | Main model output limit                              | `1200`                                                        |
| `OXY_MAX_TOOL_STEPS`         | Tool-loop safety bound                               | `6`                                                           |
| `OXY_MAX_MESSAGE_CHARS`      | Per-message character limit                          | `8000`                                                        |
| `OXY_TEMPERATURE`            | Main generation temperature                          | `0.35`                                                        |
| `OXY_MODEL_TIMEOUT_MS`       | Model HTTP timeout                                   | `120000`                                                      |
| `OXY_HTTP_REFERER`           | Optional OpenRouter-style HTTP referrer header       | unset                                                         |
| `OXY_APP_TITLE`              | Optional provider application title header           | `Oxy Protocol`                                                |
| `OXY_COOKIE_SECURE`          | Add `Secure` to temporary access-session cookie      | `0`                                                           |
| `PORT`                       | HTTP port fallback                                   | `8787`                                                        |
| `HOST`                       | Bind host fallback                                   | `0.0.0.0`                                                     |

### Recommended 32k profile

The defaults deliberately reserve headroom instead of filling the model context completely:

```text
working/provider limit      32,000
output reserve               2,200
safety reserve               1,800
hard input ceiling          28,000
next-turn reserve            2,200
prepare zone begins around  25,800
```

These are **operational defaults, not Protocol constants**. Tune them per model/provider using actual usage telemetry.

---

# Rooms

Rooms are selected by query parameter:

```text
https://chat.example.com/?room=my-team
```

Valid room IDs contain 1–64 letters/numbers plus `_` and `-`.

Examples:

```text
?room=general
?room=product_2026
?room=class-7a
```

The room URL contains no API key.

---

# Multi-device behavior

The server binds to `0.0.0.0` by default, so on a trusted LAN you can open the printed LAN address from another device.

Example:

```text
Desktop:
http://192.168.1.42:8787/?room=family

Phone:
http://192.168.1.42:8787/?room=family
```

Messages are persisted before broadcast and pushed live through SSE.

The browser stores a stable participant ID in `localStorage`. The display name is model-visible metadata and can change without changing the stable identity.

---

# Optional shared access gate

For a private LAN/test server:

```bash
export OXY_ACCESS_TOKEN="correct-horse-battery-staple"
npx oxy-protocol
```

The UI asks for the key on join. After successful join the server issues a temporary same-origin `HttpOnly` access-session cookie so the SSE connection does not need to keep the shared key in its URL.

This is intentionally only a **shared server gate**.

It is **not** a replacement for real authentication/authorization on an internet-facing production deployment.

---

# Internet deployment

For internet exposure, put Oxy behind HTTPS and a real identity/auth layer.

Recommended topology:

```text
Internet
  ↓
TLS reverse proxy / load balancer
  ↓
real authentication + authorization
  ↓
oxy-protocol application
```

At minimum:

- TLS/HTTPS
- authenticated participants
- per-room authorization
- trusted proxy configuration
- request/IP limits at the edge
- log redaction
- backup/retention policy
- external durable database before horizontal scaling

The built-in shared `OXY_ACCESS_TOKEN` is for local/private deployments, not public multi-tenant authentication.

---

# Browser microphone button

The mic icon uses the browser's optional `SpeechRecognition` / `webkitSpeechRecognition` API as **dictation into the text composer**.

It is not the full Protocol 1.0 voice adapter.

A full voice implementation should add:

```text
streaming audio
→ provisional ASR
→ HOLD / READY readiness
→ finalized Event
→ semantic SPEAK / SILENT
→ streamed TTS/playback
→ delivered-audio ledger
```

On many mobile browsers, microphone features also require HTTPS. Plain HTTP LAN chat still works for text.

---

# Persistence

Default directory:

```text
~/.oxy-protocol/
```

Each room is stored under a SHA-256-derived directory so a room name cannot become a filesystem path.

A room stores:

```text
events.jsonl   immutable canonical EventLog
state.json     atomic current room/journal/checkpoint state
```

Incoming Events are appended to JSONL before realtime broadcast.

`state.json` is written via temp-file + rename.

The single-file server is a **single-process / single-node reference implementation**. Before running several Node processes over the same data directory, replace the local persistence/lineage layer with a transactional database and distributed pub/sub.

---

# How Oxy decides whether to speak

The server does **not** implement:

```js
if (message.includes('Oxy')) speak();
```

Instead it sends a compact recent public conversation, trusted participant roster, and active RoleProfile to a semantic participation call.

Expected classifier output:

```json
{
  "decision": "speak",
  "responds_to": ["event-id"]
}
```

or:

```json
{
  "decision": "silent",
  "responds_to": []
}
```

The server then validates the structure and verifies every referenced Event exists.

If the classifier produces invalid JSON, the safe public-room fallback is `SILENT`.

---

# Request freshness

Every main AI turn captures a RequestSnapshot containing the current:

```text
Context epoch
journal id / seq / digest
Role revision/hash
ParticipantStore revision/view hash
CapabilityRegistry revision/selected tool hash
policy revision
latest human Event seq
checkpoint id
```

If relevant state changes while the model is thinking, the old result is discarded and the current room is reconsidered.

This is especially important when several people type from different devices at the same time.

---

# Context compaction

The server does not wait for a universal `80%` threshold.

It measures a conservative estimate of the **finalized provider-visible request** and compares it with the configured safe headroom.

When needed:

1. choose a journal cut `W`;
2. build an authoritative carry from current application state;
3. summarize old eligible conversation (with deterministic fallback);
4. preserve recent exact Event refs;
5. while summarization runs, new Events may continue to append;
6. at apply, capture current handoff `H`;
7. new epoch = checkpoint `<= W` + exact replay `(W, H]`;
8. later Events write directly to the new epoch;
9. canonical old EventLog remains available for local retrieval.

The implementation also carries the previous checkpoint summary into later checkpoint summarization so repeated compaction does not intentionally forget the preceding epoch.

---

# Local retrieval

After a checkpoint, the canonical EventLog is still on disk.

The reference server has a small permission-safe lexical retrieval layer: important words from the newest message are matched against older public Events and a bounded set of exact historical Events is injected as retrieved context.

For larger deployments, replace this with your own search/vector/retrieval service while preserving:

```text
ContextView authorization
Audience filtering
SourceRef provenance
current authoritative state wins over historical text
```

---

# Programmatic usage

You can use the package as a library instead of the CLI.

```js
import { createOxyServer, defineCapability } from 'oxy-protocol';

const app = await createOxyServer({
  port: 8787,
  apiKey: process.env.OPENROUTER_API_KEY,
  baseUrl: 'https://openrouter.ai/api/v1',
  model: process.env.OXY_MODEL,
  role: {
    role_id: 'team-facilitator',
    revision: 1,
    requested_display_name: 'Oxy',
    instructions: 'Help this team reason clearly. Do not invent consensus.',
  },
  capabilities: [
    {
      name: 'calculate',
      description: 'Evaluate a simple calculation in the application.',
      inputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['a', 'b'],
        properties: {
          a: { type: 'number' },
          b: { type: 'number' },
        },
      },
      outputSchema: {
        type: 'object',
        additionalProperties: false,
        required: ['sum'],
        properties: {
          sum: { type: 'number' },
        },
      },
      effectClass: 'read',
      async handler(ctx, args) {
        return {
          status: 'succeeded',
          data: { sum: args.a + args.b },
        };
      },
    },
  ],
  async policy({ participantId, capability, effectClass, args }) {
    // Application-authoritative policy.
    return { allowed: true };
  },
});

await app.listen();
console.log('Oxy is running');
```

`defineCapability()` is exported if you want to validate/normalize a descriptor before passing it to `createOxyServer()`.

---

# Runtime capability registration

```js
const app = await createOxyServer({ ...options });

app.registerCapability({
  name: 'lookup_ticket',
  description: 'Read one ticket from the application database.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['id'],
    properties: { id: { type: 'string' } },
  },
  outputSchema: {
    type: 'object',
    required: ['id', 'status'],
    properties: {
      id: { type: 'string' },
      status: { type: 'string' },
    },
  },
  effectClass: 'read',
  async handler(ctx, args) {
    const row = await db.ticket(args.id);
    if (!row) return { status: 'failed', data: { code: 'not-found' } };
    return { status: 'succeeded', data: row };
  },
});
```

Registering a capability increments the CapabilityRegistry revision. In-flight stale requests are rejected instead of silently using a changed tool profile.

---

# Changing policy at runtime

```js
app.setPolicy(async ({ participantId, capability, effectClass, args }) => {
  if (effectClass === 'write' && !isAllowed(participantId)) {
    return { allowed: false };
  }
  return { allowed: true };
});
```

Changing policy increments the policy revision so previously assembled main requests become stale.

---

# Changing the active role

```js
app.setRole('general', {
  role_id: 'teacher',
  revision: 2,
  requested_display_name: 'Oxy',
  instructions: 'Teach clearly and make the group do the reasoning.',
});
```

A role change increments role state and begins a new model context epoch.

---

# Asynchronous capabilities

A capability can return `pending`:

```js
app.registerCapability({
  name: 'long_job',
  description: 'Start a long background job.',
  inputSchema: {
    type: 'object',
    required: ['objective'],
    properties: {
      objective: { type: 'string' },
    },
  },
  outputSchema: {
    type: 'object',
    required: ['result'],
    properties: {
      result: { type: 'string' },
    },
  },
  async handler(ctx, args) {
    queueJobSomewhere(args.objective);
    return {
      status: 'pending',
      scope: { purpose_summary: args.objective },
      data: { accepted: true },
    };
  },
});
```

The tool response returned to the model contains an `operation_id`.

When the real job finishes, complete it programmatically:

```js
app.completeOperation('general', operationId, 'succeeded', { result: 'The real external result' });
```

The output schema is checked again on asynchronous completion.

Oxy schedules normal participation after the Operation result arrives; the completion does not bypass the social participation layer.

---

# Completing Operations over HTTP

If you intentionally enable an admin token:

```bash
export OXY_ADMIN_TOKEN="very-secret-admin-token"
```

then a trusted backend can call:

```bash
curl -X POST \
  -H 'content-type: application/json' \
  -H 'x-oxy-admin: very-secret-admin-token' \
  http://127.0.0.1:8787/api/rooms/general/operations/OPERATION_ID/complete \
  -d '{
    "status": "succeeded",
    "data": {"result": "done"}
  }'
```

Do not expose this endpoint to untrusted clients.

---

# HTTP API

The browser UI only uses a small same-origin API.

## Health

```http
GET /healthz
```

## Public config

```http
GET /api/config
```

## Join / rename participant

```http
POST /api/rooms/:room/join
content-type: application/json

{
  "participantId": "opaque-stable-client-id",
  "displayName": "Sam"
}
```

## Current room state

```http
GET /api/rooms/:room/state
```

Returns a bounded recent public history for UI hydration.

## Send public message

```http
POST /api/rooms/:room/messages
content-type: application/json

{
  "participantId": "...",
  "text": "hello",
  "clientId": "idempotency-id"
}
```

`clientId` deduplicates a retried client message from the same participant.

## Realtime stream

```http
GET /api/rooms/:room/events?participant=...
Accept: text/event-stream
```

SSE event types:

```text
hello
event
participants
ai_state
system
```

---

# UI security notes

The browser UI renders participant/model text with DOM `textContent`, not `innerHTML`.

The server sends:

- per-response CSP nonces;
- `X-Content-Type-Options: nosniff`;
- frame denial;
- same-origin referrer/resource policy;
- request-size limits;
- rate limits.

These are defense-in-depth, not a substitute for proper production authentication, TLS, infrastructure hardening, and dependency/security updates.

---

# Protocol mapping

This implementation follows the main Protocol 1.0 public-room mechanics:

| SPEC concept              | Single-file implementation                          |
| ------------------------- | --------------------------------------------------- |
| Session                   | room ID + room state                                |
| Participant               | stable browser participant ID                       |
| ParticipantStore revision | `participant_store_revision`                        |
| RoleProfile               | room role snapshot                                  |
| Audience                  | bundled UI uses `session-public`                    |
| ContextView               | `room-public` model lineage                         |
| EventLog                  | `events.jsonl`                                      |
| Participation             | semantic JSON `speak/silent` call                   |
| Capability                | dynamic programmatic registry                       |
| Policy                    | application `policy()` callback                     |
| ActionRecord              | immutable bounded audit record                      |
| Observation               | persisted tool execution truth                      |
| Operation                 | durable pending async work                          |
| SourceRef                 | typed Event/Observation/Operation refs              |
| ContextJournal            | ref-only public journal entries                     |
| RequestSnapshot           | revision/journal/tool freshness snapshot            |
| FinalizedModelRequest     | exact model body constructed before send            |
| ContextBudgetPolicy       | headroom/reserve configuration                      |
| ContextCheckpoint         | persisted summary/carry/tail refs                   |
| W → H rollover            | checkpoint cut + apply-time current journal handoff |
| Retrieval                 | bounded authorized lexical lookup over EventLog     |

---

# Deliberate scope of this reference package

`oxy-protocol.js` is designed to be useful immediately while staying auditable as one file.

The bundled CLI/UI intentionally does **not** pretend to solve every optional production subsystem from `SPEC.md`.

## Included

- one public group-room ContextView per room;
- multi-device text chat;
- semantic Oxy participation;
- generic capabilities and async Operations;
- durable local EventLog/state;
- compaction/retrieval;
- single-node crash/restart recovery;
- OpenAI-compatible provider adapter;
- browser dictation convenience.

## Application extensions for a larger deployment

- participant-private / role-private / moderation / audit ContextViews;
- full streaming voice + server-side ASR/TTS;
- OAuth/OIDC/passkeys and real participant authentication;
- room ACLs;
- distributed database transactions;
- horizontal multi-process/multi-host lineage manager;
- durable job queue;
- object/document storage;
- vector retrieval;
- provider-specific tokenizers;
- provider-native Responses/realtime adapters;
- production observability and audit export.

Add these without changing the Protocol 1.0 semantic boundaries.

---

# Why SSE instead of a frontend WebSocket dependency?

For this reference server, the browser needs:

```text
client → server: ordinary POST commands
server → clients: realtime event stream
```

SSE provides the second direction using a browser-native protocol with automatic reconnect and `Last-Event-ID` support.

Benefits here:

- no `ws` / Socket.IO dependency;
- works with the built-in Node HTTP server;
- transparent through many reverse proxies;
- easy to inspect/debug;
- keeps the source truly one-file.

A production full-duplex realtime voice adapter will usually use WebSocket/WebRTC separately.

---

# npm publishing

Before publishing, change metadata such as repository/author/license ownership if needed.

Verify:

```bash
npm install
npm run check
npm pack --dry-run
```

Login:

```bash
npm login
```

Publish:

```bash
npm publish --access public
```

After publication:

```bash
npx oxy-protocol
```

If the package name `oxy-protocol` is already taken in the public npm registry, choose a scoped package such as:

```json
{
  "name": "@your-scope/oxy-protocol"
}
```

and keep the binary name:

```json
{
  "bin": {
    "oxy-protocol": "./oxy-protocol.js"
  }
}
```

Users can then run:

```bash
npx @your-scope/oxy-protocol
```

---

# Development from this folder

```bash
npm install
npm start
```

Or:

```bash
node oxy-protocol.js --no-ai
```

Syntax check:

```bash
npm run check
```

---

# Operational checklist

Before exposing a deployment beyond localhost/LAN:

- [ ] set a tested `OXY_MODEL`;
- [ ] configure a real provider token policy;
- [ ] run HTTPS;
- [ ] add real participant authentication/ACLs;
- [ ] move persistence to a transactional database for multi-process operation;
- [ ] replace approximate token estimation with a provider/model tokenizer when available;
- [ ] certify the exact provider/model route you deploy;
- [ ] add backup and retention policy;
- [ ] review capability Policy rules;
- [ ] require preconditions/idempotency for external writes;
- [ ] run privacy canary tests before adding private ContextViews;
- [ ] log hard protocol failures separately from model semantic quality.

---

# License

MIT.

---

## Protocol principle

> The model decides semantic participation. The application owns identity, authority, visibility, persistence, revisions, concurrency, context lineage, and external execution truth.

## Critical prompt immutability invariant

`oxy-protocol` 1.0.1 does **not** rebuild participant rosters or any other runtime state into `system` / `developer` messages during an active context epoch.

The only normal conversation `system` message is the stable kernel + active RoleProfile + AI display name. Inside an epoch its serialized bytes stay unchanged.

Participant changes are appended to the ContextJournal as trusted application context:

```text
participant_joined
participant_renamed
participant_left
```

Example model-visible sequence:

```text
SYSTEM (stable)
  kernel + role + AI display name

USER oxy_context: participant_joined Greg
USER oxy_context: participant_joined Alice
USER event: Greg says ...
USER oxy_context: participant_joined Thomas
...
```

At a deliberate checkpoint/new-epoch boundary, an authoritative `participant_snapshot` may appear as bootstrap **data**. It is not inserted into or used to rewrite the stable system prompt.

The participation classifier follows the same rule: constant system instructions; participant membership arrives as trusted context data.

This property is important for exact-prefix prompt caching and causal history.
