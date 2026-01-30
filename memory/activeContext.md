## Active Context

### Current Focus
- Implement unified OAuth/Auth Broker layer (OAuth-first)

### Recent Changes
- Added Auth Broker config/types + ordering logic.
- Added OpenRouter OAuth (PKCE) flow and broker CLI commands.
- Updated models CLI docs for broker usage.
- Fixed TypeScript build issues in auth broker command flow and OpenRouter OAuth context.

### Next Steps
- Wire broker defaults into config (if needed) and verify with tests.
- Update any remaining docs/config hints if needed.
- Re-run Docker build (docker-setup) to confirm build passes.

### Open Questions / Blockers
- None (GLM OAuth not pursued; Mistral via OpenRouter OAuth).
