import http from 'node:http';
import { readFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { randomBytes } from 'node:crypto';
import { KeyholeBroker, secretEquals } from './core.mjs';

const base = join(dirname(fileURLToPath(import.meta.url)), '..', 'public');
const STATIC = new Map([['/', ['index.html', 'text/html; charset=utf-8']], ['/app.js', ['app.js', 'text/javascript; charset=utf-8']], ['/style.css', ['style.css', 'text/css; charset=utf-8']]]);
const PORT = Number(process.env.PHI_PORT ?? 3699);
if (!Number.isInteger(PORT) || PORT < 1 || PORT > 65535) throw new Error('Invalid PHI_PORT');
const operatorToken = process.env.PHI_OPERATOR_TOKEN || randomBytes(32).toString('hex');
const agentToken = process.env.PHI_AGENT_TOKEN || randomBytes(32).toString('hex');
if (operatorToken.length < 32 || agentToken.length < 32 || secretEquals(operatorToken, agentToken)) throw new Error('Tokens must be distinct, at least 32 characters');
const broker = new KeyholeBroker();
const headers = {
  'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
  'X-Frame-Options': 'DENY', 'Referrer-Policy': 'no-referrer',
  'Content-Security-Policy': "default-src 'none'; script-src 'self'; style-src 'self'; connect-src 'self'; base-uri 'none'; frame-ancestors 'none'; form-action 'none'"
};
const send = (res, status, data) => {
  res.writeHead(status, { ...headers, 'Content-Type': 'application/json; charset=utf-8' });
  res.end(JSON.stringify(data));
};
const denied = (res, status, error) => send(res, status, { error });
const json = async req => {
  if (req.headers['content-type'] !== 'application/json') throw new Error('JSON_REQUIRED');
  let body = ''; let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 8192) throw new Error('BODY_TOO_LARGE');
    body += chunk.toString('utf8');
  }
  try { return JSON.parse(body); } catch { throw new Error('INVALID_JSON'); }
};
export function makeServer({ appBroker = broker, admin = operatorToken, agent = agentToken } = {}) {
  return http.createServer(async (req, res) => {
    try {
      const host = req.headers.host;
      const expected = '127.0.0.1:' + req.socket.localPort;
      if (host !== expected) return denied(res, 403, 'HOST_FORBIDDEN');
      if (req.headers.origin && req.headers.origin !== 'http://' + expected) return denied(res, 403, 'ORIGIN_FORBIDDEN');
      const path = new URL(req.url, 'http://' + expected).pathname;
      if (req.method === 'GET' && STATIC.has(path)) {
        const [file, type] = STATIC.get(path);
        const content = await readFile(join(base, file));
        res.writeHead(200, { ...headers, 'Content-Type': type });
        return res.end(content);
      }
      if (req.method === 'GET' && path === '/api/health') return send(res, 200, { status: 'LOCAL_DEMO', noCredentialAccess: true });
      const hasOperator = secretEquals(req.headers['x-phi-operator-token'], admin);
      const hasAgent = secretEquals(req.headers['x-phi-agent-token'], agent);
      if (req.method === 'GET' && path === '/api/requests') {
        if (!hasOperator) return denied(res, 401, 'OPERATOR_REQUIRED');
        return send(res, 200, { requests: appBroker.list() });
      }
      if (req.method === 'GET' && path === '/api/ledger') {
        if (!hasOperator) return denied(res, 401, 'OPERATOR_REQUIRED');
        return send(res, 200, { valid: appBroker.verifyLedger(), head: appBroker.head, events: appBroker.ledger });
      }
      if (req.method === 'POST' && path === '/api/requests') {
        if (!hasAgent) return denied(res, 401, 'AGENT_REQUIRED');
        return send(res, 201, appBroker.request(await json(req)));
      }
      const detail = /^\/api\/requests\/([0-9a-f-]{36})$/.exec(path);
      if (req.method === 'GET' && detail) {
        if (!hasAgent && !hasOperator) return denied(res, 401, 'AUTH_REQUIRED');
        return send(res, 200, appBroker.get(detail[1]));
      }
      const decision = /^\/api\/requests\/([0-9a-f-]{36})\/(approve|deny)$/.exec(path);
      if (req.method === 'POST' && decision) {
        if (!hasOperator) return denied(res, 401, 'OPERATOR_REQUIRED');
        const obj = await json(req);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).length !== 0) throw new Error('EMPTY_BODY_REQUIRED');
        return send(res, 200, appBroker.decide(decision[1], decision[2] === 'approve' ? 'APPROVE' : 'DENY'));
      }
      if (req.method === 'POST' && path === '/api/grants/redeem') {
        if (!hasAgent) return denied(res, 401, 'AGENT_REQUIRED');
        const obj = await json(req);
        if (!obj || typeof obj !== 'object' || Array.isArray(obj) || Object.keys(obj).sort().join(',') !== 'requestId,token' || typeof obj.token !== 'string') throw new Error('INVALID_REDEMPTION');
        return send(res, 200, appBroker.redeem(obj.requestId, obj.token));
      }
      return denied(res, 404, 'NOT_FOUND');
    } catch (err) {
      const code = ['NOT_FOUND'].includes(err.message) ? 404 : ['NOT_PENDING', 'GRANT_UNAVAILABLE'].includes(err.message) ? 409 : 400;
      return denied(res, code, err.message || 'BAD_REQUEST');
    }
  });
}
if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const server = makeServer();
  server.listen(PORT, '127.0.0.1', () => {
    console.log('PhiKeyhole369 LOCAL DEMO at http://127.0.0.1:' + PORT);
    console.log('Operator token (paste into local dashboard; do not share):', operatorToken);
    console.log('Agent demo token (for API testing only):', agentToken);
    console.log('No credentials, browser autofill or third-party accounts are accessible.');
  });
}
