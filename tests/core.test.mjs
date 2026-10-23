import test from 'node:test';
import assert from 'node:assert/strict';
import { KeyholeBroker } from '../src/core.mjs';
const payload = { agentId: 'vessie', action: 'read:repo-metadata', resource: 'MichaelWave369/PhiKeyhole369', reason: 'Inspect repository metadata' };
test('default denies unknown capabilities and unexpected fields', () => {
  const b = new KeyholeBroker();
  assert.throws(() => b.request({ ...payload, action: 'login:bank' }), /INVALID_OR_DISALLOWED/);
  assert.throws(() => b.request({ ...payload, password: 'leak' }), /INVALID_OR_DISALLOWED/);
  assert.equal(b.requests.size, 0);
});
test('approval is explicit; grant redeems exactly once and is not a real credential', () => {
  const b = new KeyholeBroker(); const req = b.request(payload);
  assert.equal(req.state, 'PENDING');
  assert.throws(() => b.redeem(req.id, 'any'), /NOT_FOUND/);
  const approved = b.decide(req.id, 'APPROVE');
  assert.equal(approved.grant.length, 64);
  assert.throws(() => b.redeem(req.id, 'wrong'), /GRANT_UNAVAILABLE/);
  const result = b.redeem(req.id, approved.grant);
  assert.equal(result.simulated, true);
  assert.equal(b.get(req.id).state, 'REDEEMED');
  assert.throws(() => b.redeem(req.id, approved.grant), /GRANT_UNAVAILABLE/);
  assert.equal(b.verifyLedger(), true);
});
test('deny and expiry fail closed; expired grant cannot redeem', () => {
  let now = 1_790_000_000_000; const b = new KeyholeBroker({ now: () => now });
  const denied = b.request(payload); b.decide(denied.id,'DENY');
  assert.throws(() => b.decide(denied.id,'APPROVE'), /NOT_PENDING/);
  const pending = b.request(payload); now += 120_000;
  assert.equal(b.get(pending.id).state,'EXPIRED');
  assert.throws(() => b.decide(pending.id,'APPROVE'), /NOT_PENDING/);
  const granted = b.request(payload); const token = b.decide(granted.id,'APPROVE').grant;
  now += 60_000;
  assert.throws(() => b.redeem(granted.id,token), /GRANT_UNAVAILABLE/);
  assert.equal(b.verifyLedger(),true);
});
test('ledger mutation is detected', () => {
  const b = new KeyholeBroker(); b.request(payload);
  b.ledger[0].details.action = 'altered';
  assert.equal(b.verifyLedger(), false);
});
