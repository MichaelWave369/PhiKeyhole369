import { createHash, randomBytes, randomUUID, timingSafeEqual } from 'node:crypto';

export const ALLOWED_ACTIONS = Object.freeze([
  'read:repo-metadata', 'read:local-status', 'list:workspace'
]);
const MAX_REQUESTS = 500;
const REQUEST_MS = 120_000;
const GRANT_MS = 60_000;
const hex = () => randomBytes(32).toString('hex');
const sha = data => createHash('sha256').update(data).digest('hex');
const text = (value, max = 160) => typeof value === 'string' && value.length > 0 && value.length <= max && /^[\x20-\x7E]+$/.test(value);
const exactKeys = (value, allowed) => !!value && typeof value === 'object' && !Array.isArray(value) && Object.keys(value).every(k => allowed.includes(k));
export const secretEquals = (a, b) => {
  if (typeof a !== 'string' || typeof b !== 'string') return false;
  const x = Buffer.from(a); const y = Buffer.from(b);
  return x.length === y.length && timingSafeEqual(x, y);
};
const clone = value => JSON.parse(JSON.stringify(value));

export class KeyholeBroker {
  constructor({ now = () => Date.now() } = {}) {
    this.now = now;
    this.requests = new Map();
    this.grants = new Map();
    this.ledger = [];
    this.head = '0'.repeat(64);
  }
  record(event, details) {
    // Hash chaining detects changes within a retained ledger; it cannot prove
    // the ledger was never truncated or replace an externally anchored receipt.
    const entry = { sequence: this.ledger.length + 1, at: new Date(this.now()).toISOString(), event, details: clone(details), previousHash: this.head };
    entry.hash = sha(JSON.stringify(entry));
    this.ledger.push(entry); this.head = entry.hash;
    return entry;
  }
  verifyLedger() {
    let previous = '0'.repeat(64);
    for (const [i, item] of this.ledger.entries()) {
      const { hash, ...rest } = item;
      if (item.sequence !== i + 1 || item.previousHash !== previous || sha(JSON.stringify(rest)) !== hash) return false;
      previous = hash;
    }
    return previous === this.head;
  }
  expire(request) {
    if (request.state === 'PENDING' && this.now() >= request.expiresAt) {
      request.state = 'EXPIRED'; this.record('REQUEST_EXPIRED', { requestId: request.id });
    }
    if (request.state === 'APPROVED' && this.now() >= request.grantExpiresAt) {
      request.state = 'EXPIRED'; this.record('GRANT_EXPIRED', { requestId: request.id });
    }
  }
  request(input) {
    if (!exactKeys(input, ['agentId', 'action', 'resource', 'reason']) ||
      !text(input.agentId, 48) || !text(input.resource, 120) || !text(input.reason, 240) ||
      !ALLOWED_ACTIONS.includes(input.action)) throw new Error('INVALID_OR_DISALLOWED_REQUEST');
    if (this.requests.size >= MAX_REQUESTS) throw new Error('CAPACITY_REACHED');
    const req = {
      id: randomUUID(), agentId: input.agentId, action: input.action, resource: input.resource,
      reason: input.reason, state: 'PENDING', createdAt: this.now(), expiresAt: this.now() + REQUEST_MS,
      grantExpiresAt: null
    };
    this.requests.set(req.id, req);
    this.record('REQUEST_CREATED', { requestId: req.id, agentId: req.agentId, action: req.action, resource: req.resource });
    return this.snapshot(req);
  }
  snapshot(req) {
    this.expire(req);
    return clone(req);
  }
  list() { return Array.from(this.requests.values(), req => this.snapshot(req)).reverse(); }
  get(id) { const req = this.requests.get(id); if (!req) throw new Error('NOT_FOUND'); return this.snapshot(req); }
  decide(id, decision) {
    const req = this.requests.get(id);
    if (!req) throw new Error('NOT_FOUND');
    this.expire(req);
    if (req.state !== 'PENDING') throw new Error('NOT_PENDING');
    if (!['APPROVE', 'DENY'].includes(decision)) throw new Error('INVALID_DECISION');
    if (decision === 'DENY') {
      req.state = 'DENIED'; this.record('REQUEST_DENIED', { requestId: id });
      return this.snapshot(req);
    }
    const token = hex();
    req.state = 'APPROVED'; req.grantExpiresAt = this.now() + GRANT_MS;
    this.grants.set(id, { hash: sha(token), used: false });
    this.record('REQUEST_APPROVED', { requestId: id, action: req.action, resource: req.resource });
    // Grant token is returned only once in the operator response. It is NOT a
    // third-party access token, and is never stored as plaintext by the broker.
    return { ...this.snapshot(req), grant: token };
  }
  redeem(id, token) {
    const req = this.requests.get(id); const grant = this.grants.get(id);
    if (!req || !grant) throw new Error('NOT_FOUND');
    this.expire(req);
    if (req.state !== 'APPROVED' || grant.used) throw new Error('GRANT_UNAVAILABLE');
    if (!secretEquals(sha(token), grant.hash)) throw new Error('GRANT_UNAVAILABLE');
    grant.used = true; req.state = 'REDEEMED';
    this.record('GRANT_REDEEMED', { requestId: id, action: req.action, resource: req.resource });
    return { requestId: id, action: req.action, resource: req.resource, usedAt: this.now(), simulated: true };
  }
}
