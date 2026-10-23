# R0 Threat Model — honest boundaries

**Status:** demonstration, not production security. **Assets currently protected:** only mock approvals and mock tokens. No vault is connected.

## Trust boundaries

- Operator dashboard to loopback HTTP service: random in-memory bearer secret, strict Host/Origin filtering and CSP. Does not stop malware running as the local user, compromised extensions, a local proxy, or shared tokens.
- Demo agent to service: **single shared ephemeral bearer**. agentId is client-submitted, not authenticated. Requests cannot be attributed to a verified agent identity.
- Service to protected resource: **not implemented**. Approved scopes create simulation tokens, not real permissions.
- Ledger: SHA-256 chain in volatile memory. Detects ordinary record modification while retained, but **does not** prove history completeness against total deletion, restart, truncation or a compromised host; there is no external anchor or signature.

## Threats and current status

| Threat | R0 mechanism | Gap |
|---|---|---|
| Unapproved actions | fixed allowlist + operator decision + fail-closed timeout | actor identity is unverified |
| Token replay | 60s single-use hashed demo grant | no agent/device/executor binding |
| Cross-site browser calls | loopback, Host & Origin checks, no CORS, CSP | malware/compromised browser can still interfere |
| Secret leakage | no third-party secret operations, strict request schema | demo bearer tokens still need handling |
| Tampered records | volatile hash-chain validation | persistence and anchored receipts absent |
| Flooding | 8KiB body limit, 500 total requests | no per-client rate limiting |
| Dangerous action | only three fixed read-only capability labels | labels are simulated, not actual checked integrations |

## Negative controls

Tests cover disallowed action and unexpected password property; missing approval; single redemption; grant expiry; explicit denial; ledger mutation; unauthorized requests; agent cannot approve; hostile Origin and Host.

## Deployment prohibition

Never attach real vaults, passwords, cookies, OAuth refresh tokens, browser profiles, or real services to R0. Human approval alone does not guarantee AI never sees secrets. Only a **separate trusted execution boundary**, verified end to end, can support that claim.

**Review before adding any true credential bridge.**
