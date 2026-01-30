## Product Context

### Problem
Multiple providers require different auth flows; user wants a single OAuth-first interface.

### Personas
- Operator / Maintainer

### Core User Stories
- Als Betreiber möchte ich eine einheitliche OAuth-Schicht (Auth Broker), damit ich alle unterstützten Provider zentral authentifizieren und zwischen ihnen umschalten kann, ohne API-Keys nutzen zu müssen.
- Als Betreiber möchte ich, dass OAuth-fähige Provider standardmäßig bevorzugt werden und API-Keys nur als Fallback genutzt werden, damit mein System sicherer und abgeschirmter bleibt.
- Als Betreiber möchte ich, dass OpenAI Codex, Claude Code, Gemini CLI sowie Mistral (via OpenRouter OAuth) unterstützt werden, damit ich mit meinem Account-Kontingent arbeiten kann.

### UX Goals
- Simple, guided login flows per provider.
- Clear visibility of active auth profiles and fallbacks.
