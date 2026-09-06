// End-to-end test against a REAL OpenAI-compatible model using live credentials.
//
// Opt-in:  npm run test:live           (loads .env automatically, then runs this file)
// or:      OXY_LIVE_TEST=1 node --test test/live-ai.test.js
//
// Credentials resolve in priority order: OXY_* → OPENAI_* (the app auto-loads .env).
// The test is SKIPPED (never silently fails) when credentials are absent, so plain
// `npm test` stays hermetic. Note this test makes real paid model calls.
import { test, after } from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { createOxyServer } from '../oxy-protocol.js';

const TMP = fs.mkdtempSync(path.join(os.tmpdir(), 'oxy-live-'));
const appRef = { app: null };

after(async () => {
  if (appRef.app) await appRef.app.close().catch(() => {});
  fs.rmSync(TMP, { recursive: true, force: true });
});

async function waitFor(predicate, { timeoutMs, intervalMs = 500, label }) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const value = await predicate();
    if (value) return value;
    await new Promise((r) => setTimeout(r, intervalMs));
  }
  throw new Error(`Timed out waiting for ${label}`);
}

const enabled = process.env.OXY_LIVE_TEST === '1' || process.argv.includes('--live');
const apiKey = process.env.OPENAI_API_KEY;
const baseUrl = process.env.OPENAI_BASE_URL;
const model = process.env.OPENAI_MODEL;

test('live AI: real model replies over the full protocol path', { timeout: 180_000, skip: !enabled }, async () => {
  assert.ok(apiKey, 'no API key in environment');
  assert.ok(baseUrl, 'no base URL in environment');
  assert.ok(model, 'no model in environment');
  const channel = `live-${crypto.randomBytes(3).toString('hex')}`;

  const app = await createOxyServer({
    port: 0,
    dataDir: path.join(TMP, channel),
    apiKey,
    baseUrl,
    model,
    maxOutputTokens: 300,
    agentName: 'Oxy',
  });
  await app.listen();
  appRef.app = app;
  const base = `http://127.0.0.1:${app.server.address().port}`;

  // 1. Health shows AI configured with the real model.
  const health = await (await fetch(`${base}/healthz`)).json();
  assert.equal(health.ok, true);
  assert.equal(health.aiConfigured, true);

  // 2. Join a participant.
  const join = await fetch(`${base}/api/rooms/${channel}/join`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ participantId: 'live-tester', displayName: 'Live Tester' }),
  });
  assert.equal(join.status, 200);

  // 3. Send an addressed message that should trigger the real participation + generation path.
  const marker = `oxy-live-ok-${crypto.randomBytes(3).toString('hex')}`;
  const msg = await fetch(`${base}/api/rooms/${channel}/messages`, {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({
      participantId: 'live-tester',
      text: `Oxy, reply to this protocol test with the exact phrase: ${marker}`,
      clientId: crypto.randomUUID(),
    }),
  });
  assert.equal(msg.status, 201);

  // 4. Wait for the real model to speak.
  const agentEvent = await waitFor(
    async () => {
      const state = await (await fetch(`${base}/api/rooms/${channel}/state`)).json();
      return state.events.find((e) => e.actor_id === 'agent') ?? null;
    },
    { timeoutMs: 150_000, label: 'real agent reply' },
  );

  console.log(`\n  live reply: ${String(agentEvent.content.text).slice(0, 400)}`);
  assert.ok(agentEvent.content.text.trim().length > 0, 'agent reply must not be empty');
});
