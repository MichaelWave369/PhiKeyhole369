const $ = id => document.getElementById(id);
let operatorToken = '';
const request = async (path, options = {}) => {
  const response = await fetch(path, { ...options, headers: { 'x-phi-operator-token': operatorToken, ...(options.body ? { 'Content-Type': 'application/json' } : {}) }, cache: 'no-store' });
  const body = await response.json();
  if (!response.ok) throw new Error(body.error || ('HTTP ' + response.status));
  return body;
};
const cell = (tag, value, css) => { const el = document.createElement(tag); el.textContent = value; if(css) el.className = css; return el; };
async function reload() {
  const [data, ledger] = await Promise.all([request('/api/requests'), request('/api/ledger')]);
  const parent = $('requests'); parent.replaceChildren();
  if (!data.requests.length) parent.append(cell('p','No requests yet. Use the agent API to submit a demo request.','empty'));
  for (const item of data.requests) {
    const row = cell('div','','request');
    const heading = cell('div', item.agentId + ' • ' + item.state, 'request-title');
    row.append(heading, cell('p', item.action + '  →  ' + item.resource), cell('p', item.reason,'muted'));
    if (item.state === 'PENDING') {
      const controls = cell('div','','actions');
      for (const decision of ['approve','deny']) {
        const btn = cell('button',decision === 'approve' ? 'Approve once' : 'Deny', decision === 'deny' ? 'secondary' : '');
        btn.addEventListener('click', async () => {
          btn.disabled = true;
          try {
            const result = await request('/api/requests/' + item.id + '/' + decision,{ method:'POST', body:'{}' });
            if (result.grant) {
              $('message').textContent = 'Approved ' + item.action + '. One-time demo grant shown below; copy it to the agent manually.';
              $('message').append(cell('code', result.grant, 'grant'));
            } else $('message').textContent = 'Request denied.';
            await reload();
          } catch (err) { $('message').textContent = err.message; await reload(); }
        });
        controls.append(btn);
      }
      row.append(controls);
    }
    parent.append(row);
  }
  $('ledger-status').textContent = ledger.valid ? 'HASH CHAIN VALID*' : 'HASH CHAIN INVALID';
  const list = $('ledger'); list.replaceChildren();
  if (!ledger.events.length) list.append(cell('p','No ledger entries yet.','empty'));
  for (const event of ledger.events.slice(-20).reverse()) list.append(cell('div','#' + event.sequence + ' · ' + event.event + ' · ' + event.at,'event'));
}
$('connect').addEventListener('click', async () => {
  operatorToken = $('token').value.trim(); $('token').value = '';
  try { await reload(); $('refresh').disabled = false; $('message').textContent = 'Operator session unlocked. No account credentials are available.'; }
  catch { operatorToken = ''; $('refresh').disabled = true; $('message').textContent = 'Access denied or server unavailable.'; }
});
$('refresh').addEventListener('click', () => reload().catch(err => { $('message').textContent = err.message; }));
