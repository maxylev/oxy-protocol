import { test, after, describe } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createOxyServer, defineCapability, VERSION, PROTOCOL } from '../oxy-protocol.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'oxy-test-'));
const servers = [];

after(async () => {
  for (const s of servers) await s.close().catch(() => {});
  // Let any scheduled AI-loop timers drain before removing the temp tree.
  await new Promise((r) => setTimeout(r, 500));
  fs.rmSync(TMP, { recursive: true, force: true });
});

async function startServer(options = {}) {
  const dataDir = path.join(TMP, `room-${Math.random().toString(36).slice(2)}`);
  const app = await createOxyServer({
    port: 0, // ephemeral
    dataDir,
    ...options,
  });
  await app.listen();
  const port = app.server.address().port;
  servers.push(app);
  return { app, port, base: `http://127.0.0.1:${port}`, dataDir };
}

async function api(base, method, urlPath, { body, headers = {}, status } = {}) {
  const res = await fetch(base + urlPath, {
    method,
    headers: { 'content-type': 'application/json', ...headers },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const text = await res.text();
  const json = text ? JSON.parse(text) : null;
  if (status !== undefined) assert.equal(res.status, status, `expected ${status}, got ${res.status}: ${text}`);
  return { status: res.status, json };
}

async function waitFor(predicate, { timeoutMs = 8000, intervalMs = 100, label = 'condition' } = {}) {
  const deadline = Date.now() + timeoutMs;
  let last;
  while (Date.now() < deadline) {
    last = await predicate();
    if (last) return last;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}; last=${JSON.stringify(last) ?? String(last)}`);
}

async function joinRoom(base, { id = 'alice', displayName = 'Alice' } = {}) {
  return api(base, 'POST', '/api/rooms/general/join', { body: { participantId: id, displayName }, status: 200 });
}

async function sendMessage(
  base,
  { text = 'hello', clientId = crypto.randomUUID(), participantId = 'alice', status = 201 } = {},
) {
  return api(base, 'POST', '/api/rooms/general/messages', { body: { participantId, text, clientId }, status });
}

// Deterministic canonical serialization mirroring the runtime (sorted keys, undefined dropped).
function canonical(value) {
  if (value === null || value === undefined) return 'null';
  if (typeof value !== 'object') return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  const keys = Object.keys(value)
    .filter((k) => value[k] !== undefined)
    .sort();
  return `{${keys.map((k) => `${JSON.stringify(k)}:${canonical(value[k])}`).join(',')}}`;
}
const sha256 = (value) => crypto.createHash('sha256').update(canonical(value)).digest('hex');

// Read a room's persisted state.json (room dirs are sha256-derived by the runtime).
function readRoomState(dataDir, roomId = 'general') {
  const dirHash = crypto.createHash('sha256').update(String(roomId)).digest('hex').slice(0, 32);
  const dir = path.join(dataDir, dirHash);
  return JSON.parse(fs.readFileSync(path.join(dir, 'state.json'), 'utf8'));
}

// Read a room's canonical EventLog (events.jsonl).
function readRoomEvents(dataDir, roomId = 'general') {
  const dirHash = crypto.createHash('sha256').update(String(roomId)).digest('hex').slice(0, 32);
  const file = path.join(dataDir, dirHash, 'events.jsonl');
  return fs
    .readFileSync(file, 'utf8')
    .split('\n')
    .filter((line) => line.trim())
    .map((line) => JSON.parse(line));
}

// Fake OpenAI-compatible adapter: semantic participation + deterministic replies.
// Pass toolCalls to make the first main-generation call return tool calls.
function fakeAdapter({ toolCalls = [], silent = false, replyText = 'Hello from fake Oxy.' } = {}) {
  let mainCalls = 0;
  return {
    async call({ messages }) {
      const last = [...messages].reverse().find((m) => m.role === 'user');
      let eventId = null;
      try {
        eventId = JSON.parse(last?.content ?? '{}').event_id ?? null;
      } catch {}
      if (silent || !eventId)
        return {
          ok: true,
          message: { content: JSON.stringify({ decision: 'silent', responds_to: [] }) },
          usage: null,
          provider: null,
          raw: {},
          sentHash: '',
        };
      return {
        ok: true,
        message: { content: JSON.stringify({ decision: 'speak', responds_to: [eventId] }) },
        usage: null,
        provider: null,
        raw: {},
        sentHash: '',
      };
    },
    async sendFinalized(body) {
      mainCalls += 1;
      if (toolCalls.length && body.tools?.length && mainCalls === 1) {
        return {
          ok: true,
          message: { content: '', tool_calls: [toolCalls[0]] },
          usage: null,
          provider: null,
          raw: {},
          sentHash: sha256(body),
        };
      }
      return {
        ok: true,
        message: { content: replyText },
        usage: null,
        provider: null,
        raw: {},
        sentHash: sha256(body),
      };
    },
  };
}

const echoCapability = {
  name: 'echo',
  description: 'Echo text back to the room.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['text'],
    properties: { text: { type: 'string' } },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['echoed'],
    properties: { echoed: { type: 'string' } },
  },
  effectClass: 'read',
  async handler(_ctx, args) {
    return { status: 'succeeded', data: { echoed: args.text } };
  },
};

const longJobCapability = {
  name: 'long_job',
  description: 'Start a long background job.',
  inputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['objective'],
    properties: { objective: { type: 'string' } },
  },
  outputSchema: {
    type: 'object',
    additionalProperties: false,
    required: ['result'],
    properties: { result: { type: 'string' } },
  },
  effectClass: 'write',
  async handler() {
    return { status: 'pending', scope: { purpose_summary: 'async' }, data: { accepted: true } };
  },
};

describe('public HTTP API', () => {
  test('healthz and public config', async () => {
    const { base } = await startServer({ noAi: true });
    const health = await api(base, 'GET', '/healthz', { status: 200 });
    assert.equal(health.json.ok, true);
    assert.equal(health.json.protocol, PROTOCOL);
    assert.equal(health.json.version, VERSION);
    const cfg = await api(base, 'GET', '/api/config', { status: 200 });
    assert.equal(cfg.json.version, VERSION);
    assert.equal(typeof cfg.json.maxMessageChars, 'number');
  });

  test('join, rename participant, and room state reflects both', async () => {
    const { base } = await startServer({ noAi: true });
    const joined = await joinRoom(base, { id: 'u1', displayName: 'Sam' });
    assert.equal(joined.json.participant.display_name, 'Sam');
    const renamed = await joinRoom(base, { id: 'u1', displayName: 'Samantha' });
    assert.equal(renamed.json.participant.display_name, 'Samantha');
    const state = await api(base, 'GET', '/api/rooms/general/state', { status: 200 });
    assert.equal(state.json.participants.length, 1);
    assert.equal(state.json.participants[0].id, 'u1');
    assert.equal(state.json.participants[0].display_name, 'Samantha');
    assert.equal(state.json.participant_store_revision, 2);
  });

  test('send message, dedupe by clientId, and list in state', async () => {
    const { base } = await startServer({ noAi: true });
    await joinRoom(base);
    const clientId = crypto.randomUUID();
    const first = await sendMessage(base, { clientId, text: 'first payload' });
    assert.equal(first.json.event.content.text, 'first payload');
    const dup = await sendMessage(base, { clientId, text: 'changed payload', status: 200 });
    assert.equal(dup.status, 200);
    assert.equal(dup.json.idempotent, true);
    assert.equal(dup.json.event.content.text, 'first payload');
    const state = await api(base, 'GET', '/api/rooms/general/state', { status: 200 });
    assert.equal(state.json.events.length, 1);
    assert.equal(state.json.events[0].content.text, 'first payload');
  });

  test('validation errors: empty message, oversized message, unjoined sender, bad room', async () => {
    const { base } = await startServer({ noAi: true, maxMessageChars: 50 });
    await joinRoom(base);

    const empty = await api(base, 'POST', '/api/rooms/general/messages', {
      body: { participantId: 'alice', text: '   ' },
      status: 400,
    });
    assert.match(empty.json.error, /empty/i);

    const oversized = await api(base, 'POST', '/api/rooms/general/messages', {
      body: { participantId: 'alice', text: 'x'.repeat(80) },
      status: 400,
    });
    assert.match(oversized.json.error, /exceeds/i);

    const unjoined = await api(base, 'POST', '/api/rooms/general/messages', {
      body: { participantId: 'stranger', text: 'hi' },
      status: 403,
    });
    assert.match(unjoined.json.error, /join/i);

    const badRoom = await api(base, 'GET', '/api/rooms/bad%20room!/state', { status: 400 });
    assert.match(badRoom.json.error, /room id/i);
  });

  test('SSE stream pushes a message event to connected clients', async () => {
    const { base } = await startServer({ noAi: true });
    await joinRoom(base);
    const res = await fetch(`${base}/api/rooms/general/events?participant=alice`, {
      headers: { accept: 'text/event-stream' },
    });
    assert.equal(res.status, 200);
    const reader = res.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    try {
      await sendMessage(base, { text: 'sse hello' });
      const deadline = Date.now() + 5000;
      while (!buffer.includes('event: event') && Date.now() < deadline) {
        const { value, done } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
      }
    } finally {
      await reader.cancel().catch(() => {});
    }
    assert.ok(buffer.includes('event: event'), `SSE buffer: ${buffer.slice(0, 500)}`);
    const block = buffer.split('event: event')[1].slice(1).split('\n\n')[0];
    assert.ok(block.includes('"sse hello"'), `event block: ${block}`);
  });

  test('shared access gate rejects unauthenticated requests and issues a session cookie', async () => {
    const { base } = await startServer({ noAi: true, accessToken: 'secret-key' });
    const denied = await api(base, 'GET', '/api/rooms/general/state', { status: 401 });
    assert.match(denied.json.error, /access key/i);
    const granted = await api(base, 'GET', `/api/rooms/general/state?access=${encodeURIComponent('secret-key')}`, {
      status: 200,
    });
    assert.equal(granted.json.room, 'general');
    const joinRes = await fetch(`${base}/api/rooms/general/join`, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-oxy-access': 'secret-key' },
      body: JSON.stringify({ participantId: 'u9', displayName: 'U' }),
    });
    assert.equal(joinRes.status, 200);
    const setCookie = joinRes.headers.get('set-cookie') ?? '';
    assert.match(setCookie, /oxy_access_session=/);
  });
});

describe('AI participation loop (fake adapter)', () => {
  test('agent replies with an Event when participation says SPEAK', async () => {
    const { base } = await startServer({ apiKey: 'test-key', model: 'test-model', adapter: fakeAdapter() });
    await joinRoom(base, { id: 'bob', displayName: 'Bob' });
    await sendMessage(base, { participantId: 'bob', text: 'Oxy, what do you think?' });

    const state = await waitFor(
      async () => {
        const s = await api(base, 'GET', '/api/rooms/general/state');
        const agent = s.json.events.find((e) => e.actor_id === 'agent');
        return agent ?? null;
      },
      { label: 'agent reply' },
    );
    assert.equal(state.content.type, 'text');
    assert.match(state.content.text, /fake Oxy/);
    assert.equal(state.audience.kind, 'session-public');

    const final = await api(base, 'GET', '/api/rooms/general/state');
    assert.equal(final.json.ai.running, false);
  });

  test('agent stays SILENT when the participation model decides not to speak', async () => {
    const { base } = await startServer({
      apiKey: 'test-key',
      model: 'test-model',
      adapter: fakeAdapter({ silent: true }),
    });
    await joinRoom(base);
    await sendMessage(base, { text: 'nothing asked' });
    await new Promise((r) => setTimeout(r, 800)); // allow the AI loop to run
    const state = await api(base, 'GET', '/api/rooms/general/state');
    assert.equal(state.json.events.filter((e) => e.actor_id === 'agent').length, 0);
  });

  test('capability execution: tool call → Observation → final reply', async () => {
    const toolCall = {
      id: 'call_echo_1',
      type: 'function',
      function: { name: 'echo', arguments: '{"text":"round trip"}' },
    };
    const { base, dataDir } = await startServer({
      apiKey: 'test-key',
      model: 'test-model',
      capabilities: [echoCapability],
      adapter: fakeAdapter({ toolCalls: [toolCall] }),
    });
    await joinRoom(base, { id: 'carol', displayName: 'Carol' });
    await sendMessage(base, { participantId: 'carol', text: 'echo this' });

    await waitFor(
      async () => {
        const s = await api(base, 'GET', '/api/rooms/general/state');
        return s.json.events.some((e) => e.actor_id === 'agent') ? s : null;
      },
      { label: 'agent reply after tool call' },
    );

    // Observations are persisted truth in state.json, not exposed via the UI state endpoint.
    const persisted = readRoomState(dataDir);
    const observation = persisted.observations.find((o) => o.status === 'succeeded');
    assert.ok(observation, 'expected a succeeded Observation');
    assert.deepEqual(observation.data, { echoed: 'round trip' });
    assert.equal(observation.output_valid, true);
    assert.equal(persisted.action_records.length >= 1, true, 'expected an ActionRecord');
  });

  test('invalid capability arguments fail validation without executing the handler', async () => {
    const executed = { ran: false };
    const toolCall = {
      id: 'call_echo_bad',
      type: 'function',
      function: { name: 'echo', arguments: '{"text":123}' }, // wrong type: string required
    };
    const { base, app, dataDir } = await startServer({
      apiKey: 'test-key',
      model: 'test-model',
      adapter: fakeAdapter({ toolCalls: [toolCall] }),
    });
    app.registerCapability({
      ...echoCapability,
      async handler() {
        executed.ran = true;
        return { status: 'succeeded', data: { echoed: 'nope' } };
      },
    });
    await joinRoom(base);
    await sendMessage(base, { text: 'not relevant' });
    // Schema-validation failures produce an ActionRecord (status 'validation'), not an Observation.
    const record = await waitFor(
      async () => {
        const s = readRoomState(dataDir);
        return s.action_records.find((r) => r.status === 'validation') ?? null;
      },
      { label: 'validation action record' },
    );
    assert.equal(record.capability, 'echo');
    assert.equal(record.schema, 'failed');
    assert.ok(Array.isArray(record.validation_errors), 'expected captured schema errors');
    assert.equal(executed.ran, false, 'handler must not run for schema-invalid args');
  });
});

describe('async Operations', () => {
  test('pending capability → Operation completed via admin HTTP endpoint', async () => {
    const toolCall = {
      id: 'call_long_1',
      type: 'function',
      function: { name: 'long_job', arguments: '{"objective":"index data"}' },
    };
    const { base, dataDir } = await startServer({
      apiKey: 'test-key',
      model: 'test-model',
      adminToken: 'admin-secret',
      capabilities: [longJobCapability],
      adapter: fakeAdapter({ toolCalls: [toolCall] }),
    });
    await joinRoom(base, { id: 'dave', displayName: 'Dave' });
    await sendMessage(base, { participantId: 'dave', text: 'start the long job' });

    const running = await waitFor(
      async () => {
        const s = readRoomState(dataDir);
        return s.operations.find((o) => o.status === 'running') ?? null;
      },
      { label: 'running operation' },
    );
    const operationId = running.operation_id;

    const completed = await api(base, 'POST', `/api/rooms/general/operations/${operationId}/complete`, {
      body: { status: 'succeeded', data: { result: 'indexed' } },
      headers: { 'x-oxy-admin': 'admin-secret' },
      status: 200,
    });
    assert.equal(completed.json.result.operation.status, 'succeeded');
    assert.equal(completed.json.result.observation.status, 'succeeded');
    assert.deepEqual(completed.json.result.observation.data, { result: 'indexed' });

    const persisted = readRoomState(dataDir);
    const op = persisted.operations.find((o) => o.operation_id === operationId);
    assert.equal(op.status, 'succeeded');
    const opObservations = persisted.observations.filter((o) => o.operation_id === operationId);
    assert.ok(opObservations.length >= 2, 'expected pending + completion observations');
    assert.equal(opObservations.at(-1).status, 'succeeded');
  });

  test('admin endpoint rejects requests without the admin token', async () => {
    const { base } = await startServer({ noAi: true, adminToken: 'admin-secret' });
    const denied = await api(base, 'POST', '/api/rooms/general/operations/whatever/complete', {
      body: { status: 'succeeded', data: {} },
      status: 401,
    });
    assert.match(denied.json.error, /admin/i);
  });
});

describe('capability registry (unit)', () => {
  test('defineCapability validates and normalizes descriptors', () => {
    assert.throws(() => defineCapability(null), TypeError);
    assert.throws(() => defineCapability({ name: 'bad name!', handler: () => {} }), TypeError);
    assert.throws(() => defineCapability({ name: 'ok', handler: 'not-a-function' }), TypeError);
    const cap = defineCapability({
      name: 'ping',
      description: 'Returns pong.',
      effectClass: 'read',
      handler: () => ({ status: 'succeeded', data: { pong: true } }),
    });
    assert.equal(cap.name, 'ping');
    assert.equal(cap.effectClass, 'read');
    assert.equal(cap.revision, 1);
    assert.equal(Object.isFrozen(cap), true);
    assert.equal(typeof cap.handler, 'function');
  });

  test('registering a capability bumps registry revision and stales in-flight requests', async () => {
    const { base, app } = await startServer({ apiKey: 'test-key', model: 'test-model', adapter: fakeAdapter() });
    const before = await api(base, 'GET', '/api/rooms/general/state');
    assert.equal(before.json.epoch, 1);
    const first = app.registerCapability(echoCapability);
    const second = app.registerCapability({
      name: 'ping',
      description: 'p',
      handler: () => ({ status: 'succeeded', data: {} }),
    });
    assert.ok(second.registry_revision > first.registry_revision, 'registry revision must increase');
  });
});

describe('config derivation', () => {
  const KEYS = [
    'OPENAI_API_KEY',
    'OPENAI_MODEL',
    'OPENAI_BASE_URL',
    'OXY_API_KEY',
    'OXY_MODEL',
    'OXY_BASE_URL',
    'OPENROUTER_API_KEY',
  ];
  function withEnv(overrides, fn) {
    const saved = Object.fromEntries(KEYS.map((k) => [k, process.env[k]]));
    try {
      for (const k of KEYS) delete process.env[k];
      for (const [k, v] of Object.entries(overrides)) process.env[k] = v;
      return fn();
    } finally {
      for (const k of KEYS) {
        if (saved[k] === undefined) delete process.env[k];
        else process.env[k] = saved[k];
      }
    }
  }

  test('OPENAI_* environment variables configure the model', async () => {
    await withEnv(
      {
        OPENAI_API_KEY: 'sk-test-primary',
        OPENAI_MODEL: 'openai/gpt-4.1-mini',
        OPENAI_BASE_URL: 'https://api.openai.com/v1',
      },
      async () => {
        const { app } = await startServer({}); // no explicit options → env path
        assert.equal(app.config.apiKey, '[configured]');
        assert.equal(app.config.model, 'openai/gpt-4.1-mini');
        assert.equal(app.config.baseUrl, 'https://api.openai.com/v1');
        assert.equal(app.config.aiConfigured, true);
      },
    );
  });

  test('OPENAI_BASE_URL defaults to OpenAI when unset', async () => {
    await withEnv({ OPENAI_API_KEY: 'sk-test', OPENAI_MODEL: 'my/model' }, async () => {
      const { app } = await startServer({});
      assert.equal(app.config.model, 'my/model');
      assert.equal(app.config.baseUrl, 'https://api.openai.com/v1');
    });
  });

  test('legacy OXY_* and OPENROUTER_* variables are ignored', async () => {
    await withEnv(
      {
        OXY_API_KEY: 'sk-oxy-legacy',
        OXY_MODEL: 'oxy/legacy-model',
        OXY_BASE_URL: 'https://oxy.example/v1',
        OPENROUTER_API_KEY: 'sk-or-legacy',
      },
      async () => {
        const { app } = await startServer({});
        assert.equal(app.config.model, null, 'OXY_MODEL must not configure the model');
        assert.equal(app.config.baseUrl, 'https://api.openai.com/v1', 'legacy base URLs must be ignored');
        assert.equal(app.config.apiKey, null, 'legacy keys must be ignored');
        assert.equal(app.config.aiConfigured, false);
      },
    );
  });

  test('programmatic options override OPENAI_* environment variables', async () => {
    await withEnv(
      { OPENAI_API_KEY: 'sk-env', OPENAI_MODEL: 'env/model', OPENAI_BASE_URL: 'https://env.example/v1' },
      async () => {
        const { app } = await startServer({
          apiKey: 'sk-option',
          model: 'option/model',
          baseUrl: 'https://option.example/v1',
        });
        assert.equal(app.config.model, 'option/model');
        assert.equal(app.config.baseUrl, 'https://option.example/v1');
        assert.equal(app.config.apiKey, '[configured]');
      },
    );
  });
});

describe('SPEC §91.1 — system/developer prefix stability', () => {
  // The spec REQUIRES a test proving that adding, renaming, or removing a
  // participant never changes any existing system/developer message bytes
  // inside the active epoch; membership must arrive as trusted context data.
  function recordingAdapter(calls) {
    return {
      async call({ messages }) {
        calls.push({ kind: 'participation', messages });
        const last = [...messages]
          .reverse()
          .find((m) => m.role === 'user' && !String(m.content).includes('oxy_context'));
        let eventId = null;
        try {
          eventId = JSON.parse(last?.content ?? '{}').event_id ?? null;
        } catch {}
        const decision = eventId ? 'speak' : 'silent';
        return {
          ok: true,
          message: { content: JSON.stringify({ decision, responds_to: eventId ? [eventId] : [] }) },
          sentHash: '',
        };
      },
      async sendFinalized(body) {
        calls.push({ kind: 'main', messages: body.messages });
        return { ok: true, message: { content: 'ok.' }, sentHash: sha256(body) };
      },
    };
  }

  test('adding and renaming participants does not rewrite system message bytes', async () => {
    const calls = [];
    const { base } = await startServer({
      apiKey: 'k',
      model: 'm',
      adapter: recordingAdapter(calls),
    });
    await joinRoom(base, { id: 'u1', displayName: 'Sam' });
    await sendMessage(base, { participantId: 'u1', text: 'first turn' });
    await waitFor(() => calls.filter((c) => c.kind === 'main').length >= 1, { label: 'first main call' });
    const main1 = calls.find((c) => c.kind === 'main');
    const participation1 = calls.find((c) => c.kind === 'participation');

    // Rename the participant (same stable id, new display name).
    await joinRoom(base, { id: 'u1', displayName: 'Samuel' });
    await sendMessage(base, { participantId: 'u1', text: 'second turn' });
    await waitFor(() => calls.filter((c) => c.kind === 'main').length >= 2, { label: 'second main call' });
    const main2 = calls.filter((c) => c.kind === 'main')[1];
    const participation2 = calls.filter((c) => c.kind === 'participation')[1];

    const systemOf = (msgs) => msgs.filter((m) => m.role === 'system').map((m) => JSON.stringify(m));
    const userOf = (msgs) => msgs.filter((m) => m.role === 'user').map((m) => m.content);

    // Byte-for-byte identical system messages across membership changes.
    assert.deepEqual(systemOf(main2.messages), systemOf(main1.messages));
    assert.deepEqual(systemOf(participation2.messages), systemOf(participation1.messages));
    // The system message must not embed any participant identity data.
    for (const m of main1.messages.filter((x) => x.role === 'system')) {
      assert.ok(!String(m.content).includes('Sam'), 'roster/name must not appear in system messages');
      assert.ok(!String(m.content).includes('u1'), 'participant id must not appear in system messages');
    }

    // Membership changes arrive only as trusted user-role context records.
    const joined = userOf(main1.messages).find((c) => String(c).includes('participant_joined'));
    assert.ok(joined, 'join must be recorded as trusted context data');
    assert.deepEqual(JSON.parse(joined).oxy_context, {
      type: 'participant_joined',
      authority: 'application',
      participant_id: 'u1',
      display_name: 'Sam',
      participant_store_revision: 1,
    });
    const renamed = userOf(main2.messages).find((c) => String(c).includes('participant_renamed'));
    assert.ok(renamed, 'rename must be recorded as trusted context data');
    assert.deepEqual(JSON.parse(renamed).oxy_context, {
      type: 'participant_renamed',
      authority: 'application',
      participant_id: 'u1',
      previous_display_name: 'Sam',
      display_name: 'Samuel',
      participant_store_revision: 2,
    });
  });
});

describe('SPEC §§110-134 — checkpoint W→H rollover', () => {
  test('forced compaction applies a checkpoint, advances the epoch, and loses no events', async () => {
    const { base, dataDir } = await startServer({
      apiKey: 'k',
      model: 'm',
      adapter: fakeAdapter(),
      // Tight headroom so the finalized request must compact (not a fixed %).
      // The budget must stay above the fixed assembly floor (system prefix +
      // digest + tail + retrieval); see the conformance note in the test.
      contextLimit: 5200,
      workingContextLimit: 5200,
      outputReserve: 200,
      safetyReserve: 200,
      nextTurnReserve: 200,
      postCompactionTarget: 1000,
      recentTailEvents: 4,
    });
    await joinRoom(base, { id: 'zoe', displayName: 'Zoe' });
    for (let i = 1; i <= 60; i++) {
      await sendMessage(base, { participantId: 'zoe', text: `message ${i} `.repeat(12) });
    }

    // Keep pumping until a checkpoint has been applied (epoch advanced) AND the
    // AI loop has fully settled, so the EventLog snapshot is stable.
    const state = await waitFor(
      async () => {
        const s = await api(base, 'GET', '/api/rooms/general/state');
        return s.json.epoch >= 2 && s.json.ai.running === false ? s : null;
      },
      { timeoutMs: 30_000, label: 'epoch rollover with settled AI loop' },
    );
    assert.ok(state.json.checkpoint, 'checkpoint must be reported in state');

    const persisted = readRoomState(dataDir);
    const cp = persisted.checkpoint;
    assert.ok(cp?.checkpoint_id, 'checkpoint must persist');
    assert.ok(cp.cut_seq >= 1, 'checkpoint must capture a cut watermark W');
    assert.ok(cp.handoff_seq >= cp.cut_seq, 'handoff H must be >= cut W');
    assert.ok(cp.source_digest.length === 64, 'source digest must bind content (sha256)');
    assert.ok(
      Array.isArray(cp.carry.participants) && cp.carry.participants.some((p) => p.id === 'zoe'),
      'carry must include the participant snapshot',
    );
    assert.ok(cp.carry.role_ref?.type === 'role', 'carry must include the role ref');
    assert.equal(persisted.epoch >= 2, true, 'epoch must advance exactly per applied checkpoint');
    assert.ok(
      Array.isArray(persisted.journal) && persisted.journal.length >= 1,
      'new epoch journal must contain the (W, H] handoff replay',
    );

    // Canonical EventLog continuity: zero human events lost across rollover.
    const log = readRoomEvents(dataDir);
    const human = log.filter((e) => e.kind === 'message' && e.actor_id !== 'agent');
    const agent = log.filter((e) => e.actor_id === 'agent');
    assert.equal(human.length, 60, 'all human messages must survive rollover');
    assert.ok(agent.length >= 1, 'agent replies must survive rollover');
    const seqs = log.map((e) => e.seq);
    assert.deepEqual(
      seqs,
      [...seqs].sort((a, b) => a - b),
      'event sequence must remain monotonic',
    );
  });
});
