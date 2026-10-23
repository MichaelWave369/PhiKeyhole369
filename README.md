# ΦKeyhole369

**Sovereign Agent Access Gateway — R0.1 local demonstration**

> **CAPABILITY ≠ AUTHORITY.** Agents request. Humans decide. Receipts remember.

ΦKeyhole369 explores an auditable human approval layer for AI agent operations. Companion to [Super Φ.Vessel](https://github.com/MichaelWave369/SuperPhiVessel) and [WhiteHatLedger369](https://github.com/MichaelWave369/WhiteHatLedger369).

## Implemented R0.1 (no credential access)

- A **loopback-only** (127.0.0.1:3699) Node.js HTTP broker and local operator dashboard.
- Separate ephemeral operator and demo-agent bearer tokens.
- A strict, fixed **read-only capability allowlist**: read:repo-metadata, read:local-status, list:workspace.
- One human decision per request, deny by default. Unreviewed requests expire after **120 seconds**.
- After approval, a random **one-time demo grant** expires after **60 seconds**. Redemption only returns simulated: true; it executes **no real operation**.
- A per-process, in-memory, hash-chained metadata ledger with an explicit verification method. Ledger data disappears on restart.
- Built-in automated state-machine/API negative-control tests and a standalone visual GitHub Pages showcase.

**Not built:** password storage, password-manager integration, real autofill, identity verification, browser extension, OAuth, actual delegated operations, durable audit storage, OS-backed authenticator, passkey flow, MFA, verified agent enrollment, independent security audit.

**Never enter passwords or personal credentials anywhere in R0.**

## Start (Node 20+, no dependencies)

~~~bash
npm test
npm start
~~~

Open **http://127.0.0.1:3699/** on the same computer. Copy the **operator token** printed in the terminal into the unlock field.

In a separate PowerShell terminal, submit a harmless demo request. Replace the sample token with the **agent demo token** printed by npm start:

~~~powershell
$h = @{ 'x-phi-agent-token' = '<DEMO_AGENT_TOKEN>' }
$body = @{ agentId='vessie'; action='read:repo-metadata'; resource='MichaelWave369/PhiKeyhole369'; reason='Inspect repository metadata' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3699/api/requests' -Method Post -Headers $h -ContentType 'application/json' -Body $body
~~~

Refresh the dashboard and choose **Approve once** or **Deny**. If approved, the UI displays a **demo grant once**. To redeem manually:

~~~powershell
$redeem = @{ requestId='<REQUEST_ID>'; token='<ONE_TIME_DEMO_GRANT>' } | ConvertTo-Json
Invoke-RestMethod -Uri 'http://127.0.0.1:3699/api/grants/redeem' -Method Post -Headers $h -ContentType 'application/json' -Body $redeem
~~~

The redemption response explicitly says simulated: true. No actual read of GitHub metadata takes place. For this prototype, grant transfer is **manual**; no real credentials are used. Never put genuine secrets into shell arguments or repo commits.

## API

| Method | Route | Authorized role |
|---|---|---|
| GET | /api/health | Local |
| POST | /api/requests | Agent |
| GET | /api/requests | Operator |
| GET | /api/requests/:id | Operator or agent (status only) |
| POST | /api/requests/:id/approve | Operator |
| POST | /api/requests/:id/deny | Operator |
| POST | /api/grants/redeem | Agent, with one-time grant |
| GET | /api/ledger | Operator |

The service is not suitable for internet exposure or use as an actual credential boundary.

## GitHub Pages

The docs/ directory contains a **fictional-only interactive showroom**. To publish: Settings → Pages → Deploy from a branch → main /docs **after merge**. The Pages site never connects to the broker and cannot grant real access.

## Real-world adoption gates

1. Security review, trusted agent identity and trusted operator authentication.
2. OS-backed local execution, agent/request binding, rate limits, revocation, recovery and durable receipts.
3. A separate credential-vault integration using official interfaces, isolated browser session, exact origin/action binding, and no-password-to-model tests.
4. Independent review and red-team validation before touching real accounts.

See [R0 threat model](docs/THREAT_MODEL.md). MIT licensed. No affiliation with 1Password.
