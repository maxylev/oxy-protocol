# Oxana Universal Group Agent Protocol 1.0

**Canonical file:** `SPEC.md`  
**Protocol name:** Oxana Universal Group Agent Protocol  
**Short name:** Oxy Protocol  
**Version:** 1.0.1 (errata; Protocol 1.0 semantics)  
**Status:** Stable specification  
**Date:** 2026-09-06  
**Scope:** Universal multi-user AI participation, voice/text interaction, capability execution, asynchronous work, scoped context, long-session compaction, persistence, recovery, and conformance  
**Reference lineage:** v1–v16 design and certification work  
**Reference implementation baseline:** `oxy-protocol.js` — the single-file reference server in this repository

---

# 1. Purpose

This specification defines a provider-neutral protocol and runtime architecture for an AI participant operating inside a multi-user conversation.

The protocol is designed for systems in which:

- several humans may participate in the same room;
- the AI may speak, remain silent, or wait for more speech;
- input may be text, voice, or a mixture;
- names and speech recognition may be imperfect;
- the AI may have an arbitrary role configured by the application;
- the AI may use arbitrary tools and external capabilities;
- capabilities may complete synchronously or asynchronously;
- specialist/subagent LLMs may be used without becoming special protocol primitives;
- the room may contain public, participant-private, role-private, agent-local, and tool-local information;
- the conversation may continue longer than one model context window;
- requests may be routed through different providers/models;
- state and external side effects must remain correct across retries, races, compaction, crashes, reconnections, and model changes.

The central design principle is:

> **The protocol defines interaction mechanics, authority, context, and execution truth. It does not define the user's job.**

A correct implementation can support brainstorming, teaching, games, meetings, research, coding, planning, creative work, or future scenarios by changing profiles and capabilities rather than changing the kernel.

---

# 2. Non-goals

The kernel defined by this specification MUST NOT hardcode:

- product-specific workflows;
- coding-specific stages such as inspect/edit/test/commit;
- quiz-specific fields;
- game-specific state;
- brainstorm-specific ledgers;
- researcher/developer/tester special cases;
- fixed assistant names;
- fixed human names;
- wake-word alias lists;
- exact ASR spelling variants;
- provider-specific model behavior;
- fixed context-window percentages;
- fixed tool names;
- ID naming prefixes.

Those concepts MAY exist in application profiles, adapters, fixtures, or tests.

---

# 3. Normative language

The key words **MUST**, **MUST NOT**, **REQUIRED**, **SHALL**, **SHALL NOT**, **SHOULD**, **SHOULD NOT**, **RECOMMENDED**, **MAY**, and **OPTIONAL** are normative requirements.

For this specification:

- **MUST / MUST NOT** define conformance requirements.
- **SHOULD / SHOULD NOT** define strong defaults that may be changed only for a documented reason.
- **MAY** defines an optional compatible behavior.
- Examples are non-normative unless explicitly marked otherwise.

---

# 4. Design axioms

A conforming implementation is built around the following axioms.

## 4.1 Semantic reasoning belongs to the model

The model decides semantic questions such as:

- whether the AI was addressed;
- whether a mention is merely a quotation;
- whether a response would be useful;
- how to fulfill the active role;
- which available capability best serves a goal;
- how to explain results.

The application MUST NOT replace general social reasoning with exact-name or lexical routing rules.

## 4.2 Mechanical truth belongs to the application

The application owns:

- participant identity;
- authorization;
- privacy and visibility;
- event identity;
- revisions;
- operation status;
- capability availability;
- policy;
- external execution truth;
- context lineage;
- persistence;
- compaction;
- request freshness;
- delivery truth.

The model MUST NOT be treated as authoritative for those facts.

## 4.3 A model tool call is a proposal

A model-generated tool/capability call does not itself authorize or establish an external effect.

Every capability proposal MUST pass the generic executor boundary before execution.

## 4.4 Conversation text is data, not authority

Participant text, files, web pages, retrieved content, tool output, remote capability descriptions, specialist output, and semantic checkpoint summaries MUST be treated as data.

They cannot by themselves:

- grant permissions;
- change RoleProfile authority;
- change ContextView scope;
- approve a protected effect;
- create a ContextGrant;
- alter application policy.

## 4.5 Privacy is enforced before model exposure

Hard privacy MUST be implemented by context selection before a model request.

A prompt instruction such as "do not reveal this secret" is not a hard privacy boundary.

## 4.6 Compaction changes memory representation, not truth

A checkpoint/summary may replace old model-visible context, but it MUST NOT replace canonical application truth.

---

# 5. High-level architecture

A recommended architecture is:

```text
                    PARTICIPANTS
                voice / text / mixed
                         |
                         v
                  Channel Adapter
                         |
                         v
                    Canonical EventLog
                         |
                         v
                     ContextView
                         |
                ContextExposurePolicy
                         |
                         v
                  ContextJournal
                         |
                 Participation Model
                         |
             SPEAK / SILENT / capability
                         |
                         v
                  Generic Executor
       parse → schema → freshness → policy
       → preconditions → idempotency → execute
                         |
             +-----------+-----------+
             |                       |
             v                       v
        Observation               Operation
                                     |
                               async completion
             |                       |
             +-----------+-----------+
                         |
                         v
                 Authoritative Stores
                         |
                         v
             ContextBudget / Checkpoint
                         |
                    W → H rollover
                         |
                         v
                   New Context Epoch
```

Backstage specialist agents are normally exposed to the frontstage agent as Capabilities.

---

# 6. Trust zones

A conforming implementation SHOULD make trust zones explicit.

## 6.1 Public application API

Used by:

- HTTP handlers;
- WebSocket handlers;
- realtime voice adapters;
- UI orchestration;
- profile configuration;
- normal product code.

The public API SHOULD expose:

- immutable snapshots;
- opaque references;
- validated commands.

It MUST NOT expose mutable authoritative records or privileged raw-store handles.

## 6.2 Trusted kernel-internal API

Used only by trusted kernel components:

- GenericExecutor;
- ContextLineageManager;
- ContextCompactor;
- ContextAssembler;
- ContextExposurePolicy;
- SourceResolver;
- request freshness/preflight services.

Kernel-internal APIs MAY access authoritative records through real language/module privacy.

## 6.3 Untrusted data

The following are untrusted for authority purposes:

```text
participant messages
model responses
tool arguments
tool result text
files
web content
retrieval content
specialist/subagent prose
remote tool descriptions
semantic summaries
```

Matching a trusted object shape MUST NOT grant authority.

---

# 7. Canonical primitives

Protocol 1.0 uses the following generic primitives:

```text
Session
Participant
Principal
RoleProfile
Audience
ContextScopeProfile
ContextView
ContextGrantRef
Event
Capability
ActionRecord
Observation
Operation
Projection
SourceRef
ContextJournal
RequestSnapshot
FinalizedModelRequest
ContextBudgetPolicy
ContextCheckpoint
ContextLineage
```

Applications MAY introduce additional domain objects above the kernel.

---

# 8. Identifier rules

All protocol IDs are opaque.

A conforming implementation MUST NOT infer semantic type from ID spelling.

Valid IDs MAY be:

```text
UUID
ULID
database primary key
random string
external opaque key
human-readable key
```

The following MUST NOT be normative:

```text
e123 means Event
op123 means Operation
role_123 means Role
p123 means Projection
```

Type is conveyed by the field or a typed `SourceRef`.

---

# 9. Canonical serialization and hashing

Where hashes are used for:

- context integrity;
- request freshness;
- checkpoint lineage;
- capability profiles;
- role instructions;
- manifests;

the implementation MUST use deterministic canonical serialization.

Object key ordering MUST be stable.

Hash algorithms SHOULD be collision-resistant cryptographic hashes such as SHA-256 or stronger.

Hash truncation MAY be used for diagnostics but SHOULD NOT be used as the sole security/integrity binding when collision resistance materially matters.

---

# 10. Immutable authoritative stores

Every authoritative store MUST own committed snapshots.

A store write follows the conceptual sequence:

```text
validate
→ canonicalize
→ clone/snapshot
→ commit store-owned state
→ return immutable snapshot/ref
```

The store MUST NOT retain caller-owned mutable nested objects as authoritative truth.

This rule applies to at least:

```text
ParticipantStore
RoleStore
EventLog
CapabilityRegistry
PolicyEngine configuration
ObservationStore
OperationStore
ProjectionStore
ContextGrantStore
ContextCheckpointStore
ContextJournalStore
ActionRecord audit storage
```

Returned read objects MUST be immutable snapshots or defensive clones.

---

# 11. Session

A `Session` represents one application conversation/workspace context.

Minimal logical form:

```json
{
  "session_id": "opaque-session-id"
}
```

`session_id` MUST be stable for the lifetime of the session.

Session MUST NOT duplicate revision authority owned by more specific stores.

For example, role revision belongs to RoleStore, not Session.

---

# 12. Participant

A Participant is an authenticated/application-known actor.

Recommended logical form:

```json
{
  "id": "opaque-participant-id",
  "display_name": "Sam",
  "metadata": {}
}
```

The stable participant ID is authoritative.

Display names are presentation/model-visible metadata and MAY change.

Permissions, private ownership, and Principal identity MUST use stable participant IDs, not display names.

---

# 13. ParticipantStore revision

ParticipantStore MUST maintain a monotonically increasing revision for model/security-relevant changes, including:

- add;
- remove;
- rename;
- model-visible identity metadata change;
- relevant membership change.

A no-op mutation MAY avoid a revision increment.

The exact participant descriptors exposed to a model request SHOULD be hashed into a `participant_view_hash`.

---

# 14. AI participant identity

The frontstage AI SHOULD also have a stable Participant ID.

A RoleProfile MAY request a display name.

The application MUST distinguish:

```text
stable AI participant identity
vs
current display name/persona
```

Changing display name MUST NOT change authorization identity unless the application explicitly changes identity.

---

# 15. RoleProfile

RoleProfile defines behavior, not authority.

Recommended logical form:

```json
{
  "role_id": "opaque-role-id",
  "revision": 3,
  "instructions": "Help participants...",
  "requested_display_name": "Oxy",
  "language_preferences": ["ru"],
  "metadata": {}
}
```

The active RoleProfile instructions are the primary behavior customization surface.

Examples include:

```text
facilitator
teacher
quiet observer
quiz host
game moderator
creative collaborator
coding collaborator
```

These names are examples only.

---

# 16. RoleStore

RoleStore MUST:

- own an immutable active role snapshot;
- maintain a store revision;
- return immutable snapshots;
- make active-role changes explicit.

RoleProfile-authored revision and RoleStore binding revision SHOULD be distinguishable.

A material role change SHOULD start a new context epoch because it changes stable model instructions.

---

# 17. Role is not permission

RoleProfile instructions such as:

```text
"You are a moderator"
"You are a teacher"
"You are an administrator"
```

do not grant application permissions.

PolicyEngine remains authoritative.

---

# 18. Principal

`Principal` describes on whose behalf an action is being considered.

Recommended logical form:

```json
{
  "agent_id": "agent",
  "requester_id": "u17",
  "source_event_ids": ["..."],
  "delegation_ref": null
}
```

Applications MAY include additional authenticated identity/delegation fields.

The following MUST remain distinct:

```text
AI actor
requesting participant
approver
delegating principal
resource owner
```

A participant request does not automatically transfer every permission held by that participant.

---

# 19. Audience

Audience defines who may see an artifact.

Protocol 1.0 defines these standard kinds:

```text
session-public
participant-private
role-private
agent-private
tool-private
not-model-visible
```

Logical examples:

```json
{"kind":"session-public"}
```

```json
{"kind":"participant-private","participant_id":"u17"}
```

```json
{"kind":"role-private","role_ids":["moderator"]}
```

```json
{"kind":"agent-private"}
```

```json
{"kind":"tool-private"}
```

```json
{"kind":"not-model-visible"}
```

Applications MAY define additional registered scope semantics through configuration.

---

# 20. Audience is a partial order

Audience MUST NOT be modeled as a single numeric privacy rank.

Some audiences are incomparable.

For example:

```text
participant-private(u1)
role-private(moderator)
tool-private
agent-private
```

do not automatically contain one another.

A function equivalent to:

```text
audienceNoWiderThan(candidate, source)
```

MUST use explicit semantic rules and fail closed for unknown cross-kind relations.

---

# 21. Publication rule

A private artifact MUST NOT be mutated/widened into public visibility.

To publish private information, create a new authorized public artifact:

```text
private source
→ authorized publish/share action
→ new public Event / Projection / Observation
```

The original source remains private.

---

# 22. ContextScopeProfile

A ContextScopeProfile maps an application-defined context purpose to an exposure ceiling.

Standard recommended profiles:

```text
session-public
participant-private
role-private
agent-local
tool-local
specialist-local
audit
moderation
```

Example:

```json
{
  "scope_kind":"participant-private",
  "exposure_ceiling":[
    "session-public",
    "participant-private"
  ]
}
```

---

# 23. Scope registry lifecycle

ContextScopeProfile definitions are trusted bootstrap configuration.

The application SHOULD:

```text
register profiles
→ freeze registry
→ start sessions
```

Unknown scope kinds MUST fail closed.

An existing ContextView MUST capture its exposure ceiling and profile revision/hash at creation and MUST NOT silently change because a global registry later changes.

---

# 24. Default local-scope separation

Recommended defaults:

```text
agent-local:
  session-public
  agent-private

tool-local:
  session-public
  tool-private

specialist-local:
  session-public
  tool-private
```

`agent-private` and `tool-private` SHOULD NOT cross by default.

---

# 25. ContextView

A ContextView is a model-visible security lineage.

Logical form:

```json
{
  "session_id":"s1",
  "view_id":"room",
  "purpose":"frontstage",
  "scope":{"kind":"session-public"},
  "exposure_ceiling":["session-public"],
  "scope_profile_revision":4,
  "context_epoch":7
}
```

Immutable identity fields include:

```text
session_id
view_id
purpose
scope
exposure ceiling
scope profile revision/hash
```

Epoch lifecycle is controlled separately.

---

# 26. ContextView invariant

One ContextJournal belongs to exactly one:

```text
Session
ContextView
Context epoch
```

A journal MUST NOT switch:

```text
public → private
u1-private → u2-private
agent-local → tool-local
```

inside one append-only lineage.

---

# 27. Public room rule

The ordinary shared group-room view SHOULD be `session-public`.

Participant-private information MUST NOT be appended to the persistent public-room model context merely because that participant is the current requester.

---

# 28. Participant-private rule

A private participant ↔ AI interaction MUST use:

- a participant-private ContextView; or
- an equivalent isolated provider/model context satisfying the same invariants.

It MUST NOT reuse a public-room provider state containing incompatible exposure.

---

# 29. Provider context isolation

Provider-side conversation IDs, persistent response state, or cache-affinity identifiers MUST be scoped to at least:

```text
session
ContextView
context epoch
provider adapter profile
```

A provider conversation state MUST NOT be reused across incompatible privacy views.

---

# 30. ContextExposurePolicy

Every model-visible artifact selection MUST use one coherent exposure policy.

Conceptually:

```text
canExpose(
  artifact Audience,
  ContextView,
  optional live grant,
  artifact ref,
  Principal
)
```

Unknown/missing sensitive Audience SHOULD fail closed.

`not-model-visible` MUST never be sent to a model through ordinary grant mechanisms.

---

# 31. Native view exposure

A non-audit ContextView may natively expose private content only when its captured ceiling and scope match.

Examples:

```text
participant-private(u1) view
→ public + participant-private(u1)

role-private(roleX) view
→ public + compatible role-private content

agent-local
→ public + agent-private

tool-local/specialist-local
→ public + tool-private
```

---

# 32. Audit/moderation views

Privileged audit/moderation views SHOULD require explicit authorization for private artifacts.

The existence of an audit scope does not imply unrestricted private access by default.

---

# 33. ContextGrantRef

A ContextGrantRef is an opaque application-issued reference authorizing selected visibility inside a compatible ContextView.

A grant MAY bind:

```text
session
view
purpose
Principal
selected typed refs
allowed scope kinds
expiry
version
```

Only an opaque ref crosses normal trust boundaries.

A plain object that looks like a grant MUST carry no authority.

---

# 34. Live grant semantics

Every grant use MUST re-check current authoritative state.

A previously resolved authorization MUST become invalid when:

- the grant is revoked;
- the grant expires;
- a required binding no longer matches;
- its authoritative version is invalidated.

Grant liveness MUST NOT be checked only at initial resolution.

---

# 35. Grant ceiling rule

A grant may select information inside the ContextView's captured exposure ceiling.

A grant MUST NOT widen the ContextView ceiling.

Thus:

```text
private grant + room-public ContextView
```

does not inject private data into the public model lineage.

Use a dedicated compatible privileged/private ContextView instead.

---

# 36. ContextGrant is not action approval

A grant controls model visibility.

It does not by itself authorize:

```text
external writes
tool execution
role changes
publication
resource deletion
```

Those are governed by Capability/Policy.

---

# 37. Event

An Event is an immutable canonical occurrence in the session.

Recommended logical form:

```json
{
  "id":"opaque-event-id",
  "seq":921,
  "kind":"message",
  "actor_id":"u17",
  "channel":"voice",
  "reply_to":"opaque-event-id-or-null",
  "content":{
    "type":"text",
    "text":"..."
  },
  "audience":{
    "kind":"session-public"
  },
  "meta":{},
  "ts":0
}
```

Fields MAY be extended by applications.

---

# 38. Event immutability

Once appended, an Event MUST NOT be silently rewritten.

If later information changes its interpretation, append another authoritative event/projection.

For transcript corrections or supersession, applications SHOULD append an explicit correction/superseding record rather than mutate model-visible history.

---

# 39. Event sequence

EventLog SHOULD assign a monotonic session sequence (`seq`) or equivalent ordering token.

Wall-clock timestamps alone SHOULD NOT be the sole causal ordering mechanism.

---

# 40. Text channel adapter

A text message is normally considered finalized when accepted by the application.

The adapter MUST provide:

- stable actor identity;
- channel;
- content;
- native reply/thread metadata when available;
- Audience;
- canonical Event append.

Text reply/thread metadata is strong semantic evidence but does not itself force the AI to speak.

---

# 41. Voice channel adapter

Voice processing SHOULD conceptually separate:

```text
audio perception / ASR
→ utterance readiness
→ semantic participation
→ generation
→ playback/delivery
```

The audio adapter may expose:

```json
{
  "final":true,
  "confidence":0.81,
  "alternatives":[],
  "start_ms":1000,
  "end_ms":2600
}
```

No specific STT provider is required.

---

# 42. Voice readiness

For streaming speech, a readiness layer MAY return:

```text
HOLD
READY
```

`HOLD` means:

> Not enough finalized speech exists to ask the semantic participation model.

`READY` means:

> The utterance is complete enough for semantic participation classification.

Readiness MUST NOT be used as the semantic SPEAK/SILENT decision.

---

# 43. Voice name handling

Names and ASR spellings are evidence, not authorization and not deterministic routing rules.

The universal kernel MUST NOT require:

```text
exact assistant-name matching
hardcoded aliases
regex wake words
```

A capable model should reason from:

- speaker identity;
- roster;
- conversation;
- reply metadata;
- phonetic/ASR uncertainty;
- active role.

---

# 44. Audible delivery truth

Generated assistant text is not automatically authoritative audible history.

Only content actually delivered to participants SHOULD be recorded as heard/visible response.

If playback is interrupted, the system SHOULD record the delivered portion or a delivery event, not the entire unplayed generation.

---

# 45. Participation contract

Ordinary social participation is represented as:

```json
{
  "decision":"speak",
  "responds_to":["event-id"]
}
```

or:

```json
{
  "decision":"silent",
  "responds_to":[]
}
```

The model owns the semantic decision.

---

# 46. Participation structural validation

The application MUST enforce:

```text
SPEAK
→ responds_to length >= 1
→ every referenced Event exists
→ every referenced Event is eligible in the active ContextView
→ no duplicate refs

SILENT
→ responds_to length == 0
```

The application MUST NOT derive SPEAK/SILENT from exact-name matching.

---

# 47. Participation semantic guidance

The stable kernel/role instructions SHOULD make clear:

```text
being addressed
≠
being mentioned
≠
being quoted
≠
being discussed
```

Speech directed to another participant normally does not invite the AI unless the active role calls for intervention.

This is semantic guidance, not a lexical rule.

---

# 48. Ambiguous social cases

Some conversational cases are genuinely ambiguous.

Certification SHOULD allow multi-acceptable labels where appropriate rather than forcing a false binary gold standard.

Protocol correctness MUST be separated from route/model social quality.

---

# 49. Role-based proactivity

How proactive the AI is belongs in RoleProfile.

Examples:

```text
quiet observer
balanced collaborator
proactive facilitator
moderator
teacher
```

The kernel MUST NOT have a universal "brainstorm mode" or equivalent domain enum.

---

# 50. Capability

A Capability is an action the model may propose.

Recommended descriptor:

```json
{
  "name":"opaque_runtime_name",
  "description":"What this capability does",
  "input_schema":{},
  "output_schema":{},
  "origin":"local-trusted",
  "effect_class":"read",
  "availability_audience":{"kind":"session-public"},
  "timeout":null,
  "cancellable":false
}
```

Execution handler binding is server-internal and MUST NOT be exposed as mutable model-facing descriptor state.

---

# 51. Capability descriptor vs handler

Implementations SHOULD separate:

```text
CapabilityDescriptor
CapabilityHandler
```

The descriptor is immutable/versioned and may be shown to the model.

The handler contains executable trusted code and remains kernel-internal.

---

# 52. Capability Registry revision

CapabilityRegistry MUST maintain a revision.

Changes to model/security-relevant capability state MUST increment it, including:

- register;
- unregister;
- input schema change;
- output schema change;
- availability Audience;
- effect/policy binding;
- handler revision;
- timeout/cancellability where relevant.

Caller mutation of the original registration object MUST NOT change registry truth.

---

# 53. Capability availability

Capability availability determines whether a ContextView may see/call the capability.

Availability is different from result Audience.

A public capability MAY produce a private result when called from a private ContextView.

---

# 54. Large capability catalogs

Applications MAY use:

```text
lazy tool discovery
tool search
role-scoped capability profiles
provider-native deferred tools
```

The universal kernel does not require all schemas to be sent every turn.

Any discovered capability remains subject to Registry/Policy/ContextView rules.

---

# 55. Subagents are Capabilities

A specialist agent is not a special protocol primitive.

The default pattern is:

```text
frontstage AI
  ↓ capability call
specialist/backend agent
  ↓ result
Observation / Operation
  ↓
frontstage AI
```

The frontstage AI retains conversation ownership unless the application explicitly implements a participant/handoff product pattern.

---

# 56. Specialist context

A specialist SHOULD receive only scoped context required for its objective:

```text
objective
constraints
selected source refs/excerpts
relevant projections
required output form
```

It SHOULD NOT automatically receive the entire group history.

A specialist-local ContextView normally exposes public + tool-private information, not participant-private or agent-private information.

---

# 57. Generic executor

Every model-proposed capability invocation MUST pass this conceptual boundary:

```text
MODEL PROPOSAL
→ transport parse
→ capability lookup
→ input-schema validation
→ request/capability freshness
→ Principal/policy authorization
→ resource preconditions/revisions
→ idempotency
→ execution
→ output-schema validation
→ Observation / Operation
→ ActionRecord finalization
```

No domain-specific workflow gate is part of the universal executor.

---

# 58. Transport parsing

Tool arguments MUST be parsed exactly.

The harness/runtime MUST NOT silently repair invalid model JSON before recording the original failure.

If repair/retry is supported, it MUST be an observable second attempt.

---

# 59. JSON Schema

Capability input/output schemas SHOULD use a standards-compliant JSON Schema implementation.

Protocol 1.0 recommends JSON Schema 2020-12 where compatible with the route/provider adapter.

Nested objects, arrays, enums, constraints, and additionalProperties behavior MUST be validated according to the selected schema dialect.

---

# 60. ActionRecord

An ActionRecord is immutable forensic truth for a proposed capability action.

Recommended fields include:

```text
action id
capability
Principal
source refs
raw model arguments
parse result
parsed arguments
input schema result
policy result
precondition result
idempotency result
execution result
Observation ref
Operation ref
captured capability revision
timestamps
```

ActionRecord storage MUST own immutable snapshots.

---

# 61. PolicyEngine

PolicyEngine is application-authoritative.

Policy evaluates trusted context such as:

```text
Capability
Principal
Session
current Projection/resource state
effect class
delegation/approval
```

Participant/model text MUST NOT directly alter policy.

PolicyEngine SHOULD have a revision that participates in request/action freshness.

---

# 62. Preconditions and resource freshness

Capabilities that depend on mutable external/application state SHOULD support a captured precondition token, revision, hash, ETag, lease, sequence, or equivalent.

Before effectful execution:

```text
captured precondition
==
current authoritative precondition
```

must hold when required.

Otherwise the action is stale and SHOULD be rejected/replanned.

---

# 63. Idempotency

Retryable/effectful operations SHOULD use idempotency keys when supported.

Idempotency scope MUST be sufficiently specific to avoid one participant receiving another participant's effect/result.

A scope may include:

```text
session
Principal
capability
intent/action
resource
```

---

# 64. Capability outcome normalization

Capability execution outcomes MUST preserve semantic status.

A returned failure MUST NOT become success.

Unknown statuses MUST be treated as protocol/execution errors, not implicit success.

---

# 65. Observation

Observation represents what execution actually established.

Recommended logical form:

```json
{
  "observation_id":"opaque",
  "operation_id":null,
  "status":"succeeded",
  "data":{},
  "authority":"tool-authoritative",
  "audience":{"kind":"session-public"},
  "source_refs":[],
  "output_valid":true
}
```

Observation is authoritative only for facts the corresponding tool/application can establish.

---

# 66. Observation visibility

Observation MUST carry or derive an Audience.

Private tool/specialist output MUST NOT be appended to wider ContextViews.

Source-backed journal entries SHOULD reference the Observation rather than copy arbitrary result data.

---

# 67. Async Operation

Any Capability MAY complete asynchronously.

Operation states are:

```text
accepted
running
waiting
succeeded
failed
cancelled
expired
```

Terminal states are:

```text
succeeded
failed
cancelled
expired
```

---

# 68. Operation transition rules

A conforming implementation MUST define legal state transitions and reject illegal transitions.

A terminal Operation MUST NOT normally return to a non-terminal state.

Duplicate terminal completion MUST be idempotent/no-op or rejected without duplicating effects.

---

# 69. Pending result

A capability may return:

```json
{
  "status":"pending",
  "operation_id":"opaque"
}
```

The Operation MUST be stored application-side and survive model/context replacement.

---

# 70. Async completion

When an Operation completes:

```text
locate original Capability revision
validate completion status
validate output_schema if succeeded
preserve Audience
store Observation
transition Operation atomically
append eligible operation/Observation refs
```

Malformed async output MUST NOT be recorded as successful completion.

---

# 71. Async Audience

Operation and completion Audience MUST be no wider than the authorized source context.

Default:

```text
completion Audience = Operation Audience
```

A capability completion MUST NOT widen private work into public output.

Use explicit publication to share.

---

# 72. Cancellation

If cancellable:

```text
active Operation → cancelled
```

Late completion MUST NOT silently reactivate it.

If an external system reports that an effect actually happened despite cancellation, record that as separate execution truth according to application reconciliation policy.

---

# 73. Deadlines and expiry

Operations MAY have deadlines.

When a hard deadline passes according to application policy:

```text
Operation → expired
```

A late result MUST NOT silently turn an expired Operation into succeeded.

---

# 74. Projection

Projection is application-visible current state.

Recommended logical form:

```json
{
  "projection_id":"opaque",
  "schema_id":"application-defined/v1",
  "revision":8,
  "authority":"application",
  "audience":{"kind":"session-public"},
  "data":{},
  "source_refs":[]
}
```

---

# 75. Projection authority classes

Recommended authority classes:

```text
application
tool-authoritative
human-ratified
model-derived
```

Model-derived state MUST NOT silently replace stronger authoritative state.

---

# 76. Projection revisions

Projection updates MUST increment revision.

If exact historical Projection references are used, the store SHOULD retain revision history or immutable snapshots sufficient to resolve old refs.

A ref to revision 3 MUST NOT silently resolve to revision 8.

---

# 77. Projection is domain-neutral

Application profiles MAY use Projections for:

```text
decisions
scoreboards
game state
teaching progress
artifact state
meeting state
workflow state
```

No Projection schema is mandatory in the kernel.

---

# 78. Typed SourceRef

Generic source references MUST be typed.

Examples:

```json
{"type":"event","id":"alpha"}
```

```json
{"type":"observation","id":"o"}
```

```json
{"type":"operation","id":"uuid"}
```

```json
{"type":"projection","id":"storage.current","revision":7}
```

```json
{"type":"role","id":"teacher","revision":2}
```

```json
{"type":"capability","id":"calculate","revision":4}
```

IDs remain opaque.

---

# 79. Fixed-type fields

Where a field's schema already fixes the type (for example `reply_to` meaning Event ID), a raw opaque ID MAY be used.

Generic heterogeneous lists such as `source_refs` MUST use typed refs.

---

# 80. Source resolution

Immediately before rendering or validating source-backed context:

```text
resolve typed ref
→ verify source exists
→ verify revision if applicable
→ verify Session/workspace provenance
→ verify Audience in ContextView
→ verify live grant if required
→ render bounded representation
```

Source-type inference from ID spelling MUST NOT be used.

---

# 81. Missing/deleted source

If a previously referenced source is no longer available due to retention/deletion:

- the system MUST NOT fabricate it;
- it MAY render a bounded tombstone such as `source_status=unavailable`;
- privacy policy remains authoritative.

---

# 82. ContextJournal

ContextJournal is the exact model-visible causal history for one ContextView epoch.

It is not the canonical long-term database.

EventLog and authoritative stores remain canonical.

---

# 83. ContextJournal binding

A ContextJournal MUST bind immutable:

```text
session_id
view_id
epoch
journal_id
```

Only one normal writable journal may exist per `(session, view, epoch)` lineage.

---

# 84. ContextJournal immutability

Once a journal entry is committed:

- its logical content MUST NOT change;
- callers MUST NOT mutate committed payloads through retained references;
- its hash/digest MUST remain stable.

---

# 85. Journal entry envelope

Recommended logical form:

```json
{
  "seq":91,
  "kind":"tool_observation",
  "audience":{"kind":"session-public"},
  "source_refs":[
    {"type":"observation","id":"..."}
  ],
  "payload":{},
  "payload_hash":"..."
}
```

---

# 86. Standard journal kinds

Recommended kinds include:

```text
participant_event_batch
assistant_action
tool_call
tool_observation
operation_event
projection_delta
control_delta
visible_response
```

Applications MAY add registered kinds if they preserve the same authority/Audience rules.

---

# 87. Source-backed entries are ref-only

For source-backed kinds, authoritative journal payload SHOULD contain refs, not duplicated source truth.

Examples:

```json
{
  "kind":"participant_event_batch",
  "payload":{
    "event_refs":[
      {"type":"event","id":"alpha"}
    ]
  }
}
```

```json
{
  "kind":"tool_observation",
  "payload":{
    "observation_ref":{
      "type":"observation",
      "id":"obs-id"
    }
  }
}
```

---

# 88. No embedded Event duplication

A canonical participant Event batch SHOULD NOT store both:

```text
event_ref
+
copied Event content
```

The renderer resolves the Event from EventLog.

This prevents:

- duplicate truth;
- stale snapshots;
- privacy-at-rest contamination;
- larger context artifacts.

---

# 89. Journal source Audience

A journal envelope MUST NOT widen the Audience of its source.

For source-backed entries, actual source Audience MUST be re-evaluated during rendering and checkpoint creation.

Envelope Audience alone is insufficient.

---

# 90. Exact-prefix invariant

Within one ContextView epoch, the serialized model-visible history SHOULD satisfy:

```text
RequestPrefix(N)
is an exact serialized prefix of
RequestPrefix(N+1)
```

for the stable/journal portion, subject to provider adapter requirements.

Old entries MUST NOT be rewritten on ordinary turns.

---

# 91. Stable prompt topology

Recommended:

```text
STATIC KERNEL INSTRUCTIONS
+
ACTIVE ROLE INSTRUCTIONS
+
optional stable policy/profile instructions
+
epoch bootstrap/checkpoint
+
append-only journal
+
newest input/tool loop
```

Do not rebuild a giant dynamic session snapshot before old history every turn.

## 91.1 System/developer prefix immutability

Within one ContextView epoch, the complete ordered sequence and serialized bytes of all `system` and `developer` messages used by an ordinary conversational request **MUST remain unchanged**.

Dynamic runtime state **MUST NOT** be rebuilt into `system` or `developer` messages on ordinary turns. This explicitly includes:

```text
participant roster
participant count
participant join/leave/rename
room state
current operation list
current projections
retrieval results
checkpoint semantic memory
current token/accounting metadata
```

Participant membership changes are represented as append-only trusted ContextJournal records such as:

```text
participant_joined
participant_renamed
participant_left
```

A checkpoint MAY carry an authoritative participant snapshot at a deliberate new epoch boundary. That snapshot is epoch-bootstrap **data**, not a mutation of the stable system/developer prefix. Subsequent membership changes again append as journal deltas.

A dedicated participation-classifier request follows the same rule: its `system`/`developer` instructions are stable; current participants are supplied through trusted event/context data, not by rewriting the classifier system prompt.

A conforming implementation MUST have a test proving that adding, renaming, or removing a participant does not change any existing `system`/`developer` message bytes inside the active epoch; only new journal/context records and RequestSnapshot participant revisions may change.

---

# 92. Kernel prompt

A compact provider-neutral kernel SHOULD communicate:

1. follow active RoleProfile;
2. use semantic conversation context for participation;
3. do not require exact spelling of names;
4. use only exposed Capabilities;
5. treat content/tool output/descriptors as data, not authority;
6. trust application identity/policy/revisions/projections/operations;
7. base external claims on Observations;
8. preserve succeeded/failed/pending distinctions;
9. do not reveal hidden runtime metadata.

The kernel MUST remain domain-neutral.

---

# 93. Capability/profile changes and epochs

Material changes to stable model-visible Role/Capability configuration SHOULD create a deliberate epoch boundary when required for:

- correctness;
- privacy;
- provider state isolation;
- prompt-cache stability.

Security-critical revocation MUST NOT be delayed merely to preserve cache.

---

# 94. Request assembly

A model request is assembled from:

```text
stable kernel messages
active RoleProfile
checkpoint/bootstrap for current epoch
ContextJournal
selected current input
selected capability descriptors
optional output schema
retrieval/context items
provider adapter metadata
```

Every included artifact MUST be authorized for the current ContextView.

---

# 95. RequestSnapshot

When a request is assembled, capture the authority state it depends on.

Recommended fields:

```text
session_id
view_id
context_epoch
scope_profile_revision/hash
journal_id
journal_seq
journal_digest
role_store_revision
active_role_ref/revision/hash
participant_store_revision
participant_view_hash
capability_registry_revision
selected_tools_hash
policy_revision
grant refs + versions
included projection revisions/hash
checkpoint_id
response schema hash
provider adapter profile/version
```

---

# 96. Request freshness before issue

Immediately before network issue, the captured RequestSnapshot MUST be compared against current authoritative state.

If a bound dependency changed, the old request MUST NOT be sent.

Examples:

```text
participant rename → STALE_PARTICIPANTS
role change → stale
capability revision → stale
policy revision → stale
grant revoke/expiry → stale
view epoch change → stale
journal state change when the turn contract requires it → stale
```

Rebuild from current state.

---

# 97. Participant rename freshness

If participant names are model-visible and a participant is renamed after request assembly, the old request MUST be treated as stale.

A participant-list length is not a valid identity revision.

---

# 98. Model response freshness

The world may change while the model is generating.

Before applying an externally meaningful action, the executor MUST re-check relevant:

```text
capability revision
policy
Principal
preconditions
resource revisions
idempotency
```

For ordinary social output, the application SHOULD suppress/reconsider delivery when the conversational decision window materially changed.

---

# 99. FinalizedModelRequest

The provider adapter MUST produce the exact provider-visible request object that will be sent.

It may contain:

```text
model
messages/input
tools
tool choice
response format/schema
reasoning options
attachments/input items
provider wrappers
max output settings
cache/session identifiers
```

---

# 100. Exact preflight invariant

The request measured for context safety MUST be semantically identical to the request sent to the network.

A conforming adapter SHOULD compute a canonical hash over the finalized request and verify that the network-bound object has the same hash.

Do not:

```text
measure with tools
send without tools
```

or vice versa.

---

# 101. ContextBudgetPolicy

Context management MUST be headroom-based, not a universal fixed percentage.

A policy includes:

```text
provider_context_limit
working_context_limit
output_reserve
next_turn_reserve
safety_reserve
post_compaction_target
```

---

# 102. Hard input ceiling

Conceptually:

```text
hard_input_ceiling =
  min(
    provider_context_limit,
    working_context_limit
  )
  - output_reserve
  - safety_reserve
```

The provider adapter is responsible for route-specific token semantics.

---

# 103. Preparation threshold

Conceptually:

```text
prepare_threshold =
  hard_input_ceiling
  - next_turn_reserve
```

When projected usage exceeds the preparation threshold, the system SHOULD prepare compaction opportunistically.

When the finalized request does not safely fit, the system MUST compact/rebuild or refuse the request.

---

# 104. No universal 80% constant

An application MAY choose 70–80% as an operational soft preparation zone for a specific route, but Protocol 1.0 does not define a universal percentage.

The authoritative question is:

> Does the next realistic finalized request fit with required output and safety headroom?

---

# 105. Token measurement

Preferred order:

```text
provider/model tokenizer for finalized request
provider adapter token counter
calibrated conservative local estimator
```

Fallback estimators MUST serialize structured objects rather than counting them as trivial values.

Tool schemas, response schemas, wrappers, retrieval objects, and attachments can consume significant context.

---

# 106. Measurement feedback

If exact preflight tokenization is unavailable, implementations SHOULD calibrate estimates against provider-reported actual input token usage.

A conservative safety factor SHOULD be applied.

---

# 107. Final issue sequence

Recommended production sequence:

```text
1. assemble authorized ContextView
2. select exact capability descriptors
3. capture RequestSnapshot
4. finalize provider request
5. validate RequestSnapshot freshness
6. measure exact finalized request
7. if stale → rebuild
8. if unsafe → compact/rebuild/refuse
9. send exact finalized request
10. associate response with captured snapshot
```

---

# 108. Overflow rule

If a safe request cannot be built:

```text
DO NOT send an overflowing request
```

The system MUST NOT rely on silent provider truncation as its normal correctness strategy.

Canonical incoming Events MAY continue to be accepted while context maintenance occurs.

---

# 109. Blind oldest-message truncation

Provider features that automatically drop oldest items MAY be used only when the application can prove correctness for that mode.

They SHOULD NOT be the normal strategy for a multi-user Oxy room because they can silently remove:

```text
active decisions
conversation origins
operation context
important failures
participant relationships
```

---

# 110. ContextCheckpoint

A checkpoint represents older model-visible history for one ContextView lineage.

Recommended logical form:

```json
{
  "checkpoint_id":"opaque",
  "session_id":"s1",
  "view_id":"room",
  "purpose":"frontstage",
  "scope":{"kind":"session-public"},
  "journal_id":"j1",
  "from_epoch":7,
  "cut_seq":918,
  "source_digest":"...",
  "semantic_digest":{},
  "carry":{},
  "recent_tail":[],
  "retrieval":{},
  "created_at":0
}
```

A checkpoint MUST be immutable once PREPARED.

---

# 111. Checkpoint components

A checkpoint SHOULD contain distinct classes:

```text
A. deterministic authoritative carry
B. semantic digest
C. recent verbatim tail
D. retrieval/source anchors
```

Do not flatten them into one untyped summary string.

---

# 112. Authoritative carry

Current authoritative carry is taken directly from stores.

It may include references/snapshots for:

```text
active Role
participant identity snapshot/hash
eligible current Projections
eligible active Operations
selected capability profile hash/revision
ContextView metadata
```

A summarizer MUST NOT invent these states.

---

# 113. Semantic digest

Older conversational meaning not already represented by authoritative state MAY be compressed into a semantic digest.

It is `model-derived`.

It MAY preserve:

- discussion background;
- unresolved conversational threads;
- reasons participants gave;
- non-authoritative candidate ideas;
- useful causal context.

It MUST NOT create:

```text
permission
approval
tool success
current Projection truth
participant identity
role authority
```

---

# 114. Recent verbatim tail

Recent journal entries SHOULD remain verbatim to preserve:

```text
pronouns
implicit addressees
unfinished turns
recent corrections
local conversational rhythm
turn-taking context
```

Tail size is token-budget based, not a universal number of turns.

---

# 115. Retrieval anchors

Old exact source evidence SHOULD remain retrievable from canonical stores subject to ContextView policy.

The checkpoint is not the only surviving copy of history.

Avoid recursive "summary of summary of summary" as the only memory source.

---

# 116. Safe compaction boundary

Preferred checkpoint preparation begins after a committed conversational/tool cycle, not halfway through an unresolved provider-required tool-call/result pairing.

Provider-native compaction MAY define additional valid boundaries.

---

# 117. Compaction cut W

Preparation captures a cut watermark:

```text
W = cut_seq
```

Entries `<= W` are represented by the checkpoint.

New events MAY continue arriving while the checkpoint is being built.

---

# 118. PREPARED checkpoint

The compaction pipeline is:

```text
select authorized lineage
→ resolve typed refs
→ build authoritative carry
→ build semantic digest
→ choose recent tail
→ validate every field/ref
→ persist immutable PREPARED checkpoint
```

PREPARED does not advance the active epoch.

---

# 119. Checkpoint validation

Before PREPARED/APPLIED, validate exhaustively:

```text
session/view/epoch/journal lineage
source digest
cut watermark
Role ref/revision/hash
Participant revision/hash
Capability registry revision/descriptor hash
Projection refs/revisions
Operation refs/status/Audience
semantic-digest source refs
every recent-tail source ref
every retrieval anchor
Audience eligibility
grant/security dependencies
checkpoint schema
```

Correctness validators MUST NOT silently skip refs after an arbitrary limit.

---

# 120. Source digest

`source_digest` MUST bind actual authorized journal content represented through W.

A digest based only on:

```text
seq
kind
```

is insufficient.

Use canonical content hashes, hash chains, Merkle structures, or an equivalent collision-resistant binding.

---

# 121. Background compaction

Compaction SHOULD be able to run while humans continue interacting.

Canonical EventLog and durable journal input continue receiving eligible events.

No participant utterance may be lost because maintenance is running.

---

# 122. Handoff watermark H

At atomic checkpoint apply:

```text
H = last authoritative old-epoch journal seq
```

The new epoch partition is:

```text
entries <= W
→ represented by checkpoint

W < entries <= H
→ replay exactly once

entries > H
→ written directly to new epoch
```

---

# 123. ContextLineageManager

Each ContextView SHOULD have one authoritative lineage manager responsible for:

```text
active epoch
active journal id
durable journal store
checkpoint store
writer ownership
W/H handoff
epoch transition
recovery
```

Application callers MUST NOT be able to define H by supplying an arbitrary journal.

---

# 124. One active writer

For each `(session_id, view_id, epoch)` there MUST be exactly one normal writable ContextJournal.

After rollover:

```text
old writer → stale/read-only
new writer → active
```

Late writes to the old epoch MUST be rejected/rerouted through canonical input processing.

---

# 125. Apply transaction

Recommended checkpoint apply:

```text
1. resolve immutable PREPARED checkpoint
2. resolve authoritative active lineage
3. verify source prefix digest through W
4. revalidate current security/role/capability dependencies
5. acquire lineage writer transaction/CAS
6. capture H
7. mark checkpoint APPLIED
8. advance ContextView epoch once
9. switch active writer to new epoch
10. materialize checkpoint + (W,H]
11. release transaction
```

The same checkpoint applied twice MUST NOT advance the epoch twice.

---

# 126. Competing checkpoints

If two PREPARED checkpoints target the same source lineage, only one may become authoritative APPLIED state.

Others become superseded/failed or remain unused.

---

# 127. Checkpoint state machine

Recommended states:

```text
PREPARED
APPLIED
SUPERSEDED
FAILED
```

Additional internal states are allowed.

---

# 128. Checkpoint view binding

A checkpoint belongs to one:

```text
session
ContextView
source epoch
source journal lineage
```

A checkpoint from `u1-private` MUST NOT bootstrap room-public or `u2-private`.

---

# 129. Role/capability changes during prepare

If material Role/Capability/security state changes between PREPARED and APPLIED, the checkpoint MUST be revalidated.

If the old carry is no longer valid:

```text
reject/rebuild
```

Correctness/security overrides cache reuse.

---

# 130. Permission revocation during prepare

If access changes between prepare and apply:

```text
revalidate current authorization
```

Newly forbidden content MUST NOT be replayed into the new model context.

A clean security-boundary epoch MAY be required.

---

# 131. Crash recovery before apply

If the process crashes with a PREPARED checkpoint but before apply:

```text
old epoch remains active
```

The checkpoint may be retried or discarded.

---

# 132. Crash recovery after apply

If apply committed but process/provider state was lost:

```text
reconstruct new epoch from durable stores
```

using:

```text
checkpoint
+
(W,H] handoff records
+
new-epoch direct records
```

Do not advance the epoch again.

---

# 133. Durable ContextJournalStore

Production implementations MUST durably persist the active model-visible journal or be able to deterministically reconstruct it from other durable canonical records.

Recovery MUST include new-epoch direct records written after H.

---

# 134. Checkpoint bootstrap deduplication

When a checkpoint is used, bootstrap MUST NOT independently add a raw EventLog tail that duplicates raw Events already present in checkpoint recent tail/handoff.

A raw Event SHOULD appear at most once in one model request.

A semantic digest may also describe the same event; summary + raw tail is intentional.

---

# 135. Retrieval

Retrieval MUST be:

```text
ContextView-aware
Principal-aware where required
grant-aware where required
typed-ref preserving
Audience filtered
revision-aware
```

Semantic relevance MUST NOT override permission.

---

# 136. Retrieval and current truth

If retrieved historical text conflicts with current authoritative Projection state:

```text
current authoritative state wins
```

Historical text may explain history but MUST NOT restore superseded truth.

---

# 137. Provider-native compaction

Provider-native context compaction MAY be used as an adapter optimization.

The application MUST still retain canonical:

```text
EventLog
Participant/Role state
ProjectionStore
ObservationStore
OperationStore
ContextCheckpoint/lineage metadata
privacy policy
```

Provider-native opaque compaction state is adapter state, not portable business truth.

---

# 138. Provider migration

A session SHOULD be recoverable when moving:

```text
provider A → provider B
```

using portable application-owned state.

Provider-native hidden state MAY improve performance but MUST NOT be the only representation of critical truth.

---

# 139. Prompt caching

Prompt caching is an optimization, not memory.

Within an epoch, the implementation SHOULD maximize exact-prefix reuse by keeping stable content first and appending new journal entries.

Cache expiration MUST NOT affect correctness.

---

# 140. Delivery and conversation history

For user-facing output, the application SHOULD maintain a delivery ledger or equivalent truth.

Relevant distinctions include:

```text
generated
queued
started delivery
partially delivered
fully delivered
cancelled/interrupted
```

Public conversational history SHOULD represent what participants actually received.

---

# 141. Simultaneous human turns

If participant events arrive while a model request is in flight:

- append canonical Events;
- update the relevant decision/journal state;
- apply stale-response policy.

An externally meaningful action MUST be freshness-checked before execution.

A conversational response SHOULD be dropped/reconsidered if the room materially moved on.

---

# 142. Voice interruption

If a participant interrupts the AI:

- playback MAY stop;
- only delivered content is recorded as heard;
- pending text generation MAY be cancelled;
- a new readiness/participation decision is created from current events.

---

# 143. ASR correction after finalization

If an accepted speech transcript later requires correction, the application SHOULD append a correction/superseding Event rather than mutate an Event already present in model history.

A stale model result based on the old utterance SHOULD be rejected where practical.

---

# 144. Publication/share capability

Applications that allow sharing private information publicly SHOULD model this as an explicit authorized action.

The action creates a new public artifact with provenance.

It does not mutate the private source Audience.

---

# 145. External side effects

For an external write:

```text
model proposed action
≠
external effect succeeded
```

Only the adapter/tool Observation establishes execution truth.

Unknown/timeout outcomes MUST NOT be guessed as success.

---

# 146. Retry after uncertain external effect

If the transport outcome is uncertain:

- use the same idempotency key where supported;
- verify external state before repeating where possible;
- record uncertainty;
- do not blindly duplicate effects.

---

# 147. Security against prompt injection

Remote content and tool descriptors MAY contain adversarial instructions.

The application MUST preserve the trust boundary:

```text
remote content = data
application policy = authority
```

A useful security benchmark SHOULD separately measure:

```text
attack exposure
unsafe model proposal
policy block
actual unsafe execution
benign task completion
```

---

# 148. Remote capability descriptors

Descriptions from remote/untrusted capability sources MAY inform tool selection but MUST NOT:

- grant permissions;
- change RoleProfile;
- widen ContextView;
- request hidden context outside policy;
- override PolicyEngine.

Applications SHOULD record descriptor origin.

---

# 149. Security defaults

Security-sensitive selectors SHOULD fail closed when:

```text
view missing
scope unknown
Audience missing/invalid
grant binding missing
typed ref invalid
source unresolved
lineage mismatched
schema invalid
request stale
```

Administrative "list all" APIs MUST be separate from model-facing APIs.

---

# 150. Error taxonomy

Implementations SHOULD distinguish at least:

```text
transport
validation
policy
stale
unavailable
execution
tool-output
timeout
cancelled
protocol
context-maintenance
lineage
privacy
```

Do not collapse every failure into "model error".

---

# 151. Stale error subtypes

Useful stale classifications include:

```text
STALE_PARTICIPANTS
STALE_ROLE
STALE_CAPABILITIES
STALE_POLICY
STALE_GRANT
STALE_VIEW_EPOCH
STALE_JOURNAL
STALE_PRECONDITION
STALE_REQUEST
```

Exact wire names are implementation-defined.

---

# 152. Observability

Production implementations SHOULD trace:

```text
session/view/epoch
participant revisions
role revisions
selected event refs
participation decisions
RequestSnapshot fingerprint
selected tools hash
FinalizedModelRequest token estimate
provider actual token usage
ActionRecords
policy decisions
Operation transitions
Observation refs
checkpoint W/H
checkpoint validation
rollover/recovery
stale-result drops
grant issuance/use/revoke
privacy denials
```

Sensitive telemetry follows application privacy/retention policy.

---

# 153. Metrics separation

Track separately:

```text
protocol hard invariants
model semantic quality
task outcome
latency
cost
cache usage
tool reliability
context quality
```

Do not hide privacy/state failures inside an aggregate model score.

---

# 154. Route qualification

Certification applies to:

```text
model
+
provider/backend
+
adapter
+
tool transport behavior
```

not merely a model name.

A route MAY be certified for some roles/capabilities and not others.

---

# 155. Transport certification

A route transport suite SHOULD test:

```text
basic tool call
nested structured arguments
Unicode
arrays/objects
invalid JSON behavior
tool_choice behavior
auto/forced compatibility
output schema/structured output where used
```

Provider-specific limitations MUST be recorded, not disguised as model semantic failures.

---

# 156. Semantic route certification

Semantic quality MAY be evaluated separately for:

```text
participation
role adherence
tool choice
argument quality
result integration
failure truthfulness
long-context recall
retrieval use
voice robustness
```

A semantic failure does not by itself make the kernel non-conformant.

---

# 157. Long-context certification

Synthetic protocol certification does not require arbitrarily large contexts.

A practical suite MAY stop at <=32k input while testing:

```text
single-occurrence memory
early/middle/late placement
checkpoint continuity
retrieval
tool continuation
social participation after checkpoint
async operation across checkpoint
```

Longer behavior SHOULD be measured in real/shadow sessions.

---

# 158. Test harness self-certification

Before judging models, the harness MUST certify its own mechanical path.

At minimum:

```text
parser
schema validator
executor
state stores
idempotency
policy propagation
checkpoint logic
request preflight
grader assumptions
```

A known-good synthetic tool call SHOULD prove exact argument preservation.

If the harness fails, model benchmark results MUST NOT be treated as valid evidence.

---

# 159. No silent model-output repair

Certification harnesses MUST NOT silently sanitize invalid model arguments and then score the repaired result as native success.

If a repair lane exists, log:

```text
initial invalid attempt
repair prompt/action
repaired attempt
```

separately.

---

# 160. Benchmark fixture isolation

Every model/route scenario MUST receive an isolated fixture clone.

One model run MUST NOT consume or mutate conflict/security conditions for later models.

---

# 161. Semantic graders

Avoid brittle lexical graders where the task is semantic.

Prefer:

```text
structured application state
deterministic state assertions
multiple acceptable outcomes
independent semantic judge where appropriate
```

A lexical marker MUST NOT be the sole evidence for a complex semantic state such as consensus.

---

# 162. Certification evidence bundle

A release certification SHOULD contain a machine-verifiable manifest.

Recommended fields:

```json
{
  "protocol_version":"1.0",
  "kernel_hash":"...",
  "test_runner_hash":"...",
  "profile_hash":"...",
  "expected_cases":[],
  "raw_result_files":[
    {
      "path":"...",
      "sha256":"...",
      "record_count":123
    }
  ],
  "models_routes":[],
  "created_at":"..."
}
```

---

# 163. Certification completeness

Every case claimed in a final report MUST have corresponding raw evidence or a manifest-declared deterministic offline assertion result.

Missing expected evidence MUST produce an incomplete certification, not a reduced denominator.

---

# 164. Certification corruption

Malformed raw result data MUST be reported as certification artifact corruption.

Parsers MUST NOT silently skip malformed records while still claiming a complete run.

Original bytes SHOULD be retained for diagnosis.

---

# 165. Superseded attempts

If a case is rerun:

- all attempts SHOULD remain visible;
- the canonical attempt MUST be identified;
- the reason/time of supersession SHOULD be recorded.

A later pass MUST NOT silently erase an earlier failure.

---

# 166. Independent reconstruction

A clean tool SHOULD be able to reconstruct the certification summary from:

```text
manifest
raw result files
deterministic offline output
```

without trusting the prose certification report.

---

# 167. Core conformance requirements

A Protocol 1.0 implementation MUST pass deterministic tests covering at least the following groups.

## Identity and revision

- unique Event identity/order;
- stable Participant IDs;
- ParticipantStore revision on model-visible identity changes;
- rename stales old request;
- RoleStore immutable return/revision;
- CapabilityRegistry immutable descriptors/revision.

## Privacy

- public/private Event isolation;
- public/private Projection isolation;
- private Observation isolation;
- private Operation carry isolation;
- agent-private/tool-private separation;
- unknown scope fail-closed;
- forged/expired/revoked grants fail;
- grant cannot widen view ceiling.

## Executor

- exact parse;
- nested schema rejection/success;
- Principal propagation;
- unavailable capability;
- synchronous success;
- synchronous failure preserved;
- pending Operation;
- cancellation/late completion;
- duplicate completion;
- scoped idempotency;
- stale preconditions;
- Observation provenance;
- async output schema.

## ContextJournal

- exact-prefix append behavior;
- immutable append;
- one active writer per view/epoch;
- stale old writer rejected;
- typed ref-only source-backed entries;
- opaque IDs work.

## Checkpoint

- real checkpoint artifact;
- source content digest;
- privacy canaries;
- pending Operation carry;
- failed state carry;
- exhaustive source validation;
- view-bound checkpoint;
- idempotent apply;
- competing checkpoint CAS;
- W→H lossless handoff;
- post-PREPARED event preserved;
- post-PREPARED Operation completion preserved;
- wrong lineage rejected;
- source digest mismatch rejected;
- no duplicate raw Events;
- crash recovery includes new-epoch direct writes.

## Request

- full request budget includes tools/schemas/objects;
- structured-object estimator;
- RequestSnapshot stale on participant/role/capability/policy/grant/view changes;
- exact preflight request equals network request;
- no blind overflow.

## Public API

- no mutable raw authoritative store access;
- no public handler mutation;
- no arbitrary low-level checkpoint validation bypass;
- immutable recovery reads.

## Certification artifacts

- manifest completeness;
- corruption failure;
- superseded attempt disclosure.

---

# 168. Recommended Protocol 1.0 conformance IDs

Implementations MAY map their tests to local names, but a portable test suite SHOULD publish stable case IDs grouped as:

```text
ID-*   identity/revisions
VIS-*  Audience/ContextView/grants
EV-*   Event/voice/text
PART-* participation
CAP-*  capability/executor
OP-*   operations
PROJ-* projections
J-*    journal
REQ-*  request freshness/budget
CP-*   checkpoint/rollover/recovery
SEC-*  injection/privacy/security
CERT-* certification artifact integrity
```

Historical v-number test IDs are not part of the normative protocol.

---

# 169. Example public text flow

```text
1. Sam sends text.
2. Application authenticates Sam as participant u1.
3. EventLog appends public Event e1.
4. Active room ContextView selects e1.
5. ContextJournal appends EventRef(e1).
6. Participation model receives current authorized journal.
7. Model returns SPEAK responds_to=[e1].
8. Application validates e1 exists and is public in this view.
9. Frontstage model generates answer.
10. Delivered answer is recorded as public visible response.
```

---

# 170. Example human-to-human text flow

```text
Sam → Nina: "What do you think?"

Event is public.
Oxy sees it as conversation context.

Participation model decides SILENT
because the meaning is directed to Nina.

Application does not need a regex
matching "Nina".
```

A proactive moderator RoleProfile MAY reasonably choose SPEAK if its role requires intervention.

---

# 171. Example voice flow

```text
1. Audio arrives.
2. ASR produces provisional transcript.
3. Readiness = HOLD.
4. More audio arrives.
5. Endpoint/semantic readiness = READY.
6. Final Event is appended with speaker identity + transcript.
7. Participation model decides SPEAK or SILENT.
8. If SPEAK, response is generated.
9. Audio begins playback.
10. If interrupted, only delivered portion is recorded as heard.
```

---

# 172. Example private participant flow

```text
1. Sam opens private interaction with Oxy.
2. Application uses participant-private(u1) ContextView.
3. Sam-private Event enters only that view lineage.
4. Oxy may invoke a public-available capability.
5. Operation/Observation default to u1-private Audience.
6. Nina's public-room turn uses the room ContextView.
7. Sam's private content is absent from the public provider context.
```

---

# 173. Example explicit publication

```text
Sam-private:
"Share this result with the room."

Application/policy authorizes publication.
A publish Capability creates a new public Event/Projection.
The original private Observation remains private.
The room model sees the new public artifact.
```

---

# 174. Example synchronous capability

```text
Model proposal:
calculate({"expression":"40+2"})

Executor:
parse ✓
schema ✓
capability current ✓
policy ✓
precondition n/a
execute → succeeded
output schema ✓
Observation(value=42)

Model:
"The result is 42."
```

---

# 175. Example failed capability

```text
Tool returns:
status=failed
error="not found"

Observation:
status=failed

The model MUST NOT say:
"Done successfully."
```

If the model does so, this is route semantic failure, while the runtime truth remains correct.

---

# 176. Example async specialist

```text
Group asks for research.

Frontstage model:
specialist_call(objective=...)

Executor:
→ pending
→ Operation op1

Humans continue talking.

Later:
op1 → succeeded
Observation obs1

Operation event becomes eligible in the current view.

Normal participation decides whether to surface immediately,
wait for a gap,
or use it on the next relevant turn.
```

No special "researcher protocol" exists.

---

# 177. Example compaction

Suppose active context approaches its safe headroom.

```text
journal seq = 918
prepare checkpoint W=880
humans continue:
881..925

checkpoint becomes PREPARED

apply transaction:
H=925
checkpoint <=880
replay 881..925
switch new epoch

new events 926+ write directly to new epoch
```

No event is lost.

---

# 178. Example crash after rollover

```text
checkpoint W=880
handoff H=925
new epoch writes 926..934
process crashes

restart:
load APPLIED checkpoint
load handoff 881..925
load durable new-epoch records 926..934
reconstruct same model-visible history
adopt active writer
continue
```

---

# 179. Example stale request

```text
Request assembled:
Sam is display name "Sam"

Before issue:
ParticipantStore rename u1 → "Samuel"

RequestSnapshot no longer matches.
Old request is not sent.
Request is rebuilt with "Samuel".
```

---

# 180. Example stale tool action

```text
Model request saw capability revision 12.

Before returned tool call is executed:
capability updated to revision 13.

Executor revalidates.
If behavior/security semantics changed:
reject stale proposal and replan.
```

---

# 181. Example role change

```text
Current role: facilitator
Application changes role: teacher

RoleStore revision increments.
Old pending RequestSnapshot is stale.
New context epoch begins if stable prompt changes.
New exact-prefix lineage starts.
```

---

# 182. Application profiles

Applications SHOULD keep domain semantics outside the kernel.

A profile may bundle:

```text
RoleProfile
Capability set
Projection schemas
Policy rules
UI behavior
retrieval adapters
context-budget tuning
route qualification
```

---

# 183. Brainstorm profile example

Non-normative:

```text
Role:
facilitator

Projection:
ideas[]
confirmed_decisions[]
open_questions[]

Capabilities:
lookup
document-write
vote/ratify if product supports it
```

The kernel remains unchanged.

---

# 184. Teaching profile example

Non-normative:

```text
Role:
teacher/tutor

Projection:
learning goals
progress
difficulty

Capabilities:
lookup
worksheet generation
quiz evaluation
```

No teaching-specific kernel branch exists.

---

# 185. Game profile example

Non-normative:

```text
public Projection:
turn, public board

private Projection:
hidden role/state

Role:
game moderator

Capabilities:
advance state
validate move
show media
```

Audience/ContextView protects hidden state.

---

# 186. Coding profile example

Non-normative:

```text
Role:
software collaborator

Capabilities:
read
search
edit
test
apply

Projection:
artifact revision
verification status
```

Inspect/edit/test are profile semantics, not universal protocol gates.

---

# 187. Deployment tiers

A simple implementation MAY begin with:

```text
Session
ParticipantStore
room-public ContextView
EventLog
RoleProfile
participation
ContextJournal
one model route
```

It can later add:

```text
Capabilities
Operations
private views
retrieval
checkpoints
voice
```

without changing core semantics.

---

# 188. Minimum public-room implementation

A minimal conforming public text-room implementation MUST still preserve:

- stable Participant IDs;
- immutable Events;
- semantic SPEAK/SILENT;
- RoleProfile separation;
- ContextView public scope;
- append-only model history inside epoch;
- request freshness for model-visible identity/role changes;
- context overflow protection;
- no model-authoritative external truth.

Optional subsystems may be absent if the product does not use them.

---

# 189. Minimum capability implementation

If Capabilities are enabled, the implementation MUST add:

- registry revisions;
- schema validation;
- Principal/policy;
- immutable ActionRecords;
- Observation truth;
- failure preservation;
- precondition/idempotency for relevant side effects;
- async Operation semantics if any capability can be pending.

---

# 190. Minimum private-context implementation

If private context is enabled, the implementation MUST add:

- separate compatible ContextViews;
- Audience;
- exposure policy;
- provider state isolation;
- private-aware Journal/Checkpoint/Retrieval;
- grant semantics for privileged access;
- explicit publication instead of Audience widening.

---

# 191. Minimum long-session implementation

If sessions can approach the working context limit, the implementation MUST add:

- full finalized-request token preflight;
- durable ContextJournal;
- ContextBudgetPolicy;
- checkpoint creation;
- W/H lineage handoff;
- recovery;
- exact raw-event deduplication;
- retrieval or equivalent old-history access where product requirements need precision.

---

# 192. Security review checklist

Before production launch verify:

- [ ] no model-visible private data enters public ContextViews;
- [ ] no provider persistent state is reused across incompatible views;
- [ ] grants are opaque, live, revocable, expiring, and binding-aware;
- [ ] grant does not widen ContextView ceiling;
- [ ] publication creates new public artifacts;
- [ ] public APIs expose no mutable authoritative raw records/handlers;
- [ ] IDs are opaque;
- [ ] source refs are typed;
- [ ] source-backed entries are re-authorized at render;
- [ ] Capability/Policy revisions participate in freshness;
- [ ] async result Audience cannot widen;
- [ ] failed/pending work is never normalized to success;
- [ ] checkpoint validation is exhaustive;
- [ ] apply uses authoritative lineage only;
- [ ] crash recovery includes post-H writes;
- [ ] exact request preflight equals sent request;
- [ ] overflow is blocked before provider call;
- [ ] raw certification corruption cannot be silently ignored.

---

# 193. Voice review checklist

- [ ] stable speaker IDs exist independently of names;
- [ ] VAD/readiness is separate from semantic participation;
- [ ] no exact-name universal routing;
- [ ] ASR alternatives/confidence may be supplied as evidence;
- [ ] finalized speech is canonical;
- [ ] corrections append/supersede rather than rewrite model history;
- [ ] interrupted playback does not create false audible history;
- [ ] new speech can stale an in-flight social response;
- [ ] public/private audio channels map to distinct ContextViews where required.

---

# 194. Capability review checklist

- [ ] model sees descriptor, not mutable handler;
- [ ] registry changes increment revision;
- [ ] input/output schemas are validated;
- [ ] raw invalid arguments remain observable;
- [ ] Principal reaches PolicyEngine;
- [ ] preconditions protect stale mutable resources;
- [ ] idempotency protects retries;
- [ ] output status is preserved;
- [ ] async completion is validated;
- [ ] cancellation/expiry are terminal;
- [ ] Observation is the basis for external claims.

---

# 195. Context review checklist

- [ ] one journal = one session/view/epoch;
- [ ] one writable writer per lineage;
- [ ] ordinary turns append, not rewrite;
- [ ] ContextView ceiling captured/frozen;
- [ ] source-backed journal entries use refs;
- [ ] request snapshot binds visible authority;
- [ ] full request includes tool/schema token cost;
- [ ] preparation is headroom-based;
- [ ] checkpoint has authoritative carry + digest + tail + retrieval;
- [ ] W/H rollover is atomic;
- [ ] old writer becomes stale;
- [ ] recovery is deterministic and durable.

---

# 196. Common implementation errors

The following are explicitly non-conformant or strongly discouraged:

```text
if transcript contains "Oxy" then speak
```

```text
all participants share one public/private provider conversation
```

```text
model says "approved" therefore approval exists
```

```text
tool returned failed → record succeeded
```

```text
request approval tool auto-approves itself
```

```text
parse model tool JSON and silently repair it before recording failure
```

```text
checkpoint apply accepts arbitrary caller journal
```

```text
private data is sent to model and prompt says "don't reveal"
```

```text
oldest messages are silently dropped at provider limit
```

```text
ID prefix determines entity type
```

```text
private method is only named "_private"
```

```text
measure one request but send a different request
```

---

# 197. Compatibility and extensions

An implementation MAY extend:

- Event kinds;
- Context scope profiles;
- SourceRef types;
- Projection schemas;
- capability metadata;
- provider adapter fields;
- observability fields.

Extensions MUST preserve:

```text
authority ownership
Audience semantics
ContextView security
typed references
immutable stores
freshness
execution truth
checkpoint lineage
```

Unknown security-sensitive extension values SHOULD fail closed.

---

# 198. Protocol negotiation

If protocol version is exchanged over an application boundary, implementations SHOULD advertise:

```text
oxy/1.0
```

or an equivalent application version identifier.

The exact transport header/message field is application-defined.

---

# 199. Backward compatibility

Legacy adapters MAY translate earlier internal representations into Protocol 1.0.

Compatibility logic MUST remain outside the universal kernel when it depends on:

- ID prefixes;
- historical field names;
- provider quirks;
- domain-specific state.

Compatibility inference MUST NOT be a security boundary.

---

# 200. Reference certification baseline

The reference implementation in this repository (`oxy-protocol.js`) is the working baseline for Protocol 1.0 conformance.

Its automated checks cover offline assertion groups (identity/revisions, executor, journal, checkpoint, request safety), HTTP transport routes, and minimal live invariants — see `npm test`, `npm run lint`, and `npm run fmt:check`; `npm run test:live` additionally exercises the full participation path against a real OpenAI-compatible model when credentials are configured.

Conformance evidence for any implementation SHOULD state the exact implementation and version under test, raw assertion counts/results, and retained superseded attempts.

These results are reference evidence, not a guarantee that every new implementation is conformant.

---

# 201. Reference route lesson

Provider routes may differ in transport behavior.

A route that supports only automatic tool choice, has intermittent tool calling, or has weaker semantic quality may still be protocol-compatible if the adapter handles its constraints and hard invariants remain intact.

Certification therefore applies to the route configuration, not an abstract model brand.

---

# 202. Protocol freeze policy

Protocol 1.0 SHOULD remain stable.

Do not change the core protocol merely because:

- a new Role is introduced;
- a new Capability is introduced;
- a new subagent exists;
- a model misses a social case;
- a provider adds a different tool API;
- context thresholds are tuned;
- retrieval implementation changes.

Those belong to profiles/adapters/certifications.

---

# 203. What justifies a future protocol revision

A future Protocol 1.1/2.0 is justified only by a genuinely new universal invariant, for example:

- a new identity/security model;
- a new privacy relation not expressible by Audience/ContextView;
- distributed consistency semantics not expressible by current lineage;
- a new provider primitive that changes causal execution semantics;
- a new multi-agent speaking/ownership model requiring kernel-level representation.

---

# 204. Final reference architecture

```text
                 TRUSTED APPLICATION STATE
 ┌──────────────────────────────────────────────────────┐
 │ Session                                               │
 │ ParticipantStore                                      │
 │ RoleStore                                             │
 │ CapabilityDescriptorStore + private handler bindings │
 │ PolicyEngine                                          │
 │ EventLog                                              │
 │ ProjectionStore                                       │
 │ ObservationStore                                      │
 │ OperationStore                                        │
 │ ContextGrantStore                                     │
 └─────────────────────────┬────────────────────────────┘
                           │
                           v
                  ContextExposurePolicy
                           │
              +------------+-------------+
              |            |             |
              v            v             v
        room-public   participant-private  local worker
        ContextView      ContextView        ContextView
              |            |             |
              +------------+-------------+
                           |
                           v
                 ContextLineageManager
                           |
                  durable ContextJournal
                           |
                  ContextBudgetManager
                           |
                   ContextCheckpoint
                      W → H
                           |
                           v
                    ContextAssembler
                           |
                    RequestSnapshot
                           |
                    Provider Adapter
                           |
                 FinalizedModelRequest
                           |
               freshness + exact preflight
                           |
                           v
                          MODEL
                           |
               +-----------+-----------+
               |                       |
               v                       v
        visible response        capability proposal
                                       |
                                       v
                               Generic Executor
                                       |
                              Observation/Operation
                                       |
                              authoritative stores
```

---

# 205. Final normative principles

The Protocol 1.0 design can be summarized in the following rules.

> **The model decides semantic participation.**

> **The application decides identity, authority, visibility, revisions, persistence, concurrency, and execution truth.**

> **The RoleProfile defines behavior, not permission.**

> **Capabilities define what may be proposed; Policy defines what may be executed.**

> **A tool call is a proposal; an Observation is execution truth.**

> **An Operation makes asynchronous work durable across model/context changes.**

> **Audience defines who may know an artifact.**

> **A ContextView is a security lineage, not a per-call query filter.**

> **Private data is never made public by widening an old artifact; publication creates a new authorized artifact.**

> **A ContextJournal is append-only inside one epoch.**

> **Source-backed journal state uses typed refs to canonical stores.**

> **IDs are opaque.**

> **A RequestSnapshot binds model input to the authority state under which it was assembled.**

> **The exact finalized provider request is the request that must be freshness-checked, token-measured, and sent.**

> **Context compaction is triggered by safe headroom, not a universal percentage.**

> **A checkpoint carries authoritative state deterministically, compresses only semantic history, keeps recent dialogue verbatim, and preserves retrieval access to exact old evidence.**

> **W/H rollover guarantees that conversation and async results cannot fall between checkpoint preparation and epoch activation.**

> **Canonical application state survives provider changes, context compaction, crashes, and model replacement.**

> **The kernel defines mechanics, not the user's domain.**

---

# Appendix A — Recommended minimal JSON shapes

These shapes are illustrative logical contracts. Transport-specific encodings MAY differ if semantics remain equivalent.

## A.1 Audience

```json
{
  "kind":"session-public"
}
```

```json
{
  "kind":"participant-private",
  "participant_id":"u17"
}
```

## A.2 Event

```json
{
  "id":"alpha",
  "seq":17,
  "kind":"message",
  "actor_id":"u1",
  "channel":"text",
  "reply_to":null,
  "content":{
    "type":"text",
    "text":"Hello"
  },
  "audience":{
    "kind":"session-public"
  },
  "meta":{},
  "ts":1780000000000
}
```

## A.3 RoleProfile

```json
{
  "role_id":"teacher",
  "revision":2,
  "instructions":"...",
  "requested_display_name":"Oxy",
  "language_preferences":["ru"],
  "metadata":{}
}
```

## A.4 Principal

```json
{
  "agent_id":"agent",
  "requester_id":"u1",
  "source_event_ids":["alpha"],
  "delegation_ref":null
}
```

## A.5 Capability descriptor

```json
{
  "name":"lookup",
  "description":"Look up current information.",
  "input_schema":{
    "type":"object",
    "additionalProperties":false,
    "required":["query"],
    "properties":{
      "query":{"type":"string"}
    }
  },
  "output_schema":{
    "type":"object"
  },
  "availability_audience":{
    "kind":"session-public"
  },
  "effect_class":"read",
  "handler_revision":4
}
```

## A.6 Observation

```json
{
  "observation_id":"obs-X",
  "operation_id":null,
  "status":"succeeded",
  "data":{
    "value":42
  },
  "authority":"tool-authoritative",
  "audience":{
    "kind":"session-public"
  },
  "source_refs":[],
  "output_valid":true
}
```

## A.7 Operation

```json
{
  "operation_id":"550e8400-e29b-41d4-a716-446655440000",
  "capability":"specialist_call",
  "status":"running",
  "principal":{
    "requester_id":"u1"
  },
  "source_refs":[
    {"type":"event","id":"alpha"}
  ],
  "audience":{
    "kind":"participant-private",
    "participant_id":"u1"
  },
  "scope":{
    "purpose_summary":"Research the requested topic"
  },
  "deadline":null,
  "result_refs":[]
}
```

## A.8 Projection

```json
{
  "projection_id":"storage.current",
  "schema_id":"decisions/v1",
  "revision":8,
  "authority":"application",
  "audience":{
    "kind":"session-public"
  },
  "data":{
    "storage":"local"
  },
  "source_refs":[
    {"type":"event","id":"decision-event"}
  ]
}
```

## A.9 SourceRef

```json
{
  "type":"projection",
  "id":"storage.current",
  "revision":8
}
```

## A.10 Participation

```json
{
  "decision":"speak",
  "responds_to":["alpha"]
}
```

## A.11 ContextView

```json
{
  "session_id":"s1",
  "view_id":"room",
  "purpose":"frontstage",
  "scope":{
    "kind":"session-public"
  },
  "exposure_ceiling":[
    "session-public"
  ],
  "scope_profile_revision":1,
  "context_epoch":7
}
```

## A.12 Journal entry

```json
{
  "seq":91,
  "kind":"participant_event_batch",
  "audience":{
    "kind":"session-public"
  },
  "source_refs":[
    {"type":"event","id":"alpha"}
  ],
  "payload":{
    "event_refs":[
      {"type":"event","id":"alpha"}
    ]
  },
  "payload_hash":"..."
}
```

## A.13 ContextCheckpoint

```json
{
  "checkpoint_id":"cp-7",
  "session_id":"s1",
  "view_id":"room",
  "purpose":"frontstage",
  "scope":{"kind":"session-public"},
  "journal_id":"journal-7",
  "from_epoch":7,
  "cut_seq":918,
  "source_digest":"...",
  "semantic_digest":{
    "summary":"...",
    "threads":[],
    "source_refs":[]
  },
  "carry":{
    "role":{},
    "participants":{},
    "projections":[],
    "active_operations":[],
    "capability_profile":{}
  },
  "recent_tail":[],
  "retrieval":{},
  "created_at":1780000000000
}
```

---

# Appendix B — Recommended operation transition table

| Current | Next | Allowed |
|---|---|---:|
| accepted | running | yes |
| accepted | waiting | yes |
| accepted | succeeded | yes |
| accepted | failed | yes |
| accepted | cancelled | yes |
| accepted | expired | yes |
| running | waiting | yes |
| running | succeeded | yes |
| running | failed | yes |
| running | cancelled | yes |
| running | expired | yes |
| waiting | running | yes |
| waiting | succeeded | yes |
| waiting | failed | yes |
| waiting | cancelled | yes |
| waiting | expired | yes |
| succeeded | any other | no |
| failed | any other | no |
| cancelled | any other | no |
| expired | any other | no |

Applications MAY restrict this table further.

---

# Appendix C — Recommended checkpoint transaction pseudocode

```text
function prepareCheckpoint(view):
    lineage = lineageManager.current(view)

    W = chooseCut(lineage)
    prefix = lineage.authorizedEntriesThrough(W)

    carry = readAuthoritativeCarry(view)
    digest = summarizeEligible(prefix)
    tail = chooseRecentTail(prefix)
    retrieval = buildRetrievalAnchors(prefix)

    cp = validateAndPersistPrepared({
        session,
        view,
        lineage,
        W,
        sourceDigest(prefix),
        carry,
        digest,
        tail,
        retrieval
    })

    return cp


function applyCheckpoint(checkpointId):
    transaction:
        cp = checkpointStore.getPrepared(checkpointId)
        lineage = lineageManager.resolveAuthoritative(cp.session, cp.view)

        assert lineage.epoch == cp.from_epoch
        assert digest(lineage.entriesThrough(cp.W)) == cp.source_digest
        assert currentAuthorityCompatible(cp)

        H = lineage.lastCommittedSeq()

        mark cp APPLIED
        oldWriter = lineage.writer
        newEpoch = cp.from_epoch + 1
        newWriter = createWriter(newEpoch)
        switchActiveWriter(newWriter)

    materialize:
        bootstrap checkpoint
        replay lineage records W < seq <= H exactly once

    oldWriter becomes stale
    return newWriter
```

---

# Appendix D — Recommended request issue pseudocode

```text
function issueModelTurn(view):
    while true:
        journal = lineageManager.activeJournal(view)

        selectedTools = capabilityRegistry.selectForView(view)
        snapshot = captureRequestSnapshot(
            view,
            journal,
            selectedTools,
            role,
            participants,
            policy,
            projections,
            grants
        )

        plan = assembleModelRequest(...)
        finalized = providerAdapter.finalize(plan)

        current = captureCurrentAuthorityState(...)
        if !fresh(snapshot, current):
            continue

        budget = measure(finalized)
        if budget.requiresCompaction:
            compactAndRollover(view)
            continue

        if !budget.canIssue:
            return CONTEXT_MAINTENANCE_ERROR

        send(finalized)
        break
```

---

# Appendix E — Recommended tool execution pseudocode

```text
function executeProposal(proposal, capturedSnapshot):
    record raw proposal

    capability = registry.lookup(proposal.name)
    if missing:
        fail UNAVAILABLE

    parse exact arguments
    validate input schema

    verify captured capability revision
    evaluate Principal + Policy
    verify resource preconditions
    resolve idempotency

    outcome = invoke trusted handler

    if pending:
        create Operation
        create pending Observation if desired
        return OperationRef

    if succeeded:
        validate output schema
        if invalid:
            record failed tool-output Observation
            return failure

    preserve returned status exactly
    store Observation
    finalize immutable ActionRecord
    return ObservationRef
```

---

# Appendix F — Recommended participation prompt contract

The application MAY use a dedicated lightweight classification call.

Example stable instruction:

```text
Decide whether the active AI participant should respond now.

Use conversational meaning, the active role, participant identities,
reply/thread structure, and recent context. Do not require exact spelling
of the AI's name. Being addressed is different from being mentioned,
quoted, or discussed. Speech directed to another participant normally
does not invite the AI unless the active role calls for intervention.

Return only:
{"decision":"speak","responds_to":["event-id", ...]}
or
{"decision":"silent","responds_to":[]}
```

This is an example; equivalent structured output is conformant.

---

# Appendix G — Release checklist

A production release claiming Protocol 1.0 SHOULD be able to answer "yes" to all of the following.

## Architecture

- [ ] Kernel has no domain-specific task branches.
- [ ] RoleProfile is configurable.
- [ ] Capabilities are dynamic.
- [ ] Subagents are ordinary capabilities.
- [ ] Canonical state is outside model/provider context.

## Identity

- [ ] Participant IDs are stable.
- [ ] Display-name changes are revisioned.
- [ ] AI identity is separate from display role.
- [ ] Request freshness includes participant view hash/revision.

## Privacy

- [ ] Audience is explicit.
- [ ] ContextView ceiling is immutable.
- [ ] Unknown scopes fail closed.
- [ ] Public/private views use distinct model/provider state.
- [ ] Grants are opaque/live/revocable.
- [ ] Grants never widen a view ceiling.
- [ ] Agent-private and tool-private are separated by default.
- [ ] Publication creates new public artifacts.

## Conversation

- [ ] Text reply metadata is preserved.
- [ ] Voice readiness is separate from participation.
- [ ] No universal exact-name routing.
- [ ] SPEAK/SILENT output is structurally validated.
- [ ] Delivered output, not merely generated output, becomes conversation truth.

## Execution

- [ ] Raw tool arguments are recorded.
- [ ] JSON Schema validation is standards-compliant.
- [ ] Principal reaches policy.
- [ ] Failures remain failures.
- [ ] Async Operations survive contexts.
- [ ] Async output schema is checked.
- [ ] Idempotency/preconditions protect effects.
- [ ] ActionRecords are immutable.

## Context

- [ ] Journal is one session/view/epoch.
- [ ] Source-backed entries are typed-ref only.
- [ ] Exact-prefix append behavior is preserved in epoch.
- [ ] Token budget measures finalized request.
- [ ] Checkpoint is immutable.
- [ ] W/H rollover is lossless.
- [ ] Old writer becomes stale.
- [ ] Recovery includes post-H writes.
- [ ] Raw Events are not duplicated after rollover.
- [ ] Retrieval is view-aware.

## Request safety

- [ ] RequestSnapshot binds all relevant authority.
- [ ] Stale requests are rebuilt before issue.
- [ ] Exact preflight object equals network object.
- [ ] No silent overflow/truncation is relied upon for correctness.

## Certification

- [ ] Offline deterministic gate passes.
- [ ] Transport route gate passes.
- [ ] Live hard-invariant gate passes.
- [ ] Semantic model quality is reported separately.
- [ ] Manifest covers expected cases.
- [ ] Raw corruption fails certification.
- [ ] Superseded attempts remain visible.
- [ ] Report is reconstructable from evidence.

---

# Appendix H — Reference implementation certification note

The single-file reference implementation in this repository (`oxy-protocol.js`) is the working baseline for Protocol 1.0 conformance.

Its automated checks (`npm test`, `npm run lint`, `npm run fmt:check`) exercise the identity/revision, privacy, executor, journal, checkpoint/rollover, and request-safety invariant groups of this specification; `npm run test:live` runs the full semantic participation path against a configured OpenAI-compatible model.

Protocol 1.0 does not require use of the reference implementation language or exact class layout. It requires equivalent externally observable invariants.

---

# End of Specification

**Oxana Universal Group Agent Protocol 1.0 is frozen at this abstraction boundary.**

Future changes to roles, tools, specialists, model routes, context thresholds, provider adapters, retrieval strategies, or application domains SHOULD be implemented above or beside the kernel without modifying Protocol 1.0 semantics.
