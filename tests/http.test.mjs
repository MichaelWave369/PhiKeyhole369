import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { makeServer } from '../src/server.mjs';
import { KeyholeBroker } from '../src/core.mjs';
const payload = { agentId: 'vessie', action: 'read:repo-metadata', resource: 'repo', reason: 'read metadata' };
test('HTTP flow enforces operator/agent separation, host and origin checks', async () => {
  const server = makeServer({ appBroker: new KeyholeBroker(), admin: 'A'.repeat(32), agent: 'B'.repeat(32) });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const address = 'http://127.0.0.1:' + server.address().port;
  const get = (path, headers = {}) => fetch(address + path,{ headers });
  const post = (path, value, headers = {}) => fetch(address + path,{method:'POST', headers:{'content-type':'application/json', ...headers}, body:JSON.stringify(value)});
  try {
    assert.equal((await get('/api/requests')).status,401);
    assert.equal((await get('/api/health',{Origin:'http://evil.test'})).status,403);
    const invalidHost = await new Promise((resolve, reject) => http.get(address + '/api/health', {headers:{Host:'evil.test'}}, res => {res.resume();res.on('end',()=>resolve(res.statusCode));}).on('error',reject));
    assert.equal(invalidHost,403);
    assert.equal((await post('/api/requests',payload)).status,401);
    const created = await post('/api/requests',payload,{'x-phi-agent-token':'B'.repeat(32)});
    assert.equal(created.status,201); const req = await created.json();
    assert.equal((await post('/api/requests/' + req.id + '/approve',{}, {'x-phi-agent-token':'B'.repeat(32)})).status,401);
    const approved = await post('/api/requests/' + req.id + '/approve',{}, {'x-phi-operator-token':'A'.repeat(32)});
    assert.equal(approved.status,200); const {grant} = await approved.json();
    const redeem = await post('/api/grants/redeem',{requestId:req.id,token:grant},{'x-phi-agent-token':'B'.repeat(32)});
    assert.equal(redeem.status,200);
    assert.equal((await post('/api/grants/redeem',{requestId:req.id,token:grant},{'x-phi-agent-token':'B'.repeat(32)})).status,409);
    const ledger = await get('/api/ledger',{'x-phi-operator-token':'A'.repeat(32)});
    assert.equal((await ledger.json()).valid,true);
  } finally { await new Promise(resolve => server.close(resolve)); }
});
