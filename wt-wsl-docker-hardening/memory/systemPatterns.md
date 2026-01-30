## System Patterns

### Architecture Overview
- Auth Broker layer on top of auth-profiles + provider OAuth flows.
- Broker policies: OAuth-first ordering + provider priority + optional API-key fallback.
- Hardened Docker gateway profile via compose override (no ports, read-only root, named volumes).

### ADRs
- TBD
