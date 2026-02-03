---
summary: "In depth Systemdokumentation, Funktionen, Flows und Anpassung an die Vision"
read_when:
  - Du eine Gesamtuebersicht der Funktionen brauchst
  - Du Anpassungen an Architektur und Auth Broker planst
---
# System Map und In Depth Dokumentation

## Ziel und Vision
Diese Dokumentation beschreibt die Hauptfunktionen der Codebasis, wie sie zusammenwirken, wo Verbesserungen sinnvoll sind und wie wir alles auf die Vision einer OAuth first Auth Broker Schicht adaptieren.

Vision aus dem Projektbrief:
- Einheitliche Auth Broker Schicht fuer Provider Logins
- OAuth bevorzugt, API Key nur als Fallback
- Modular und sicher per Default

## Architekturueberblick
### Zentrale Komponenten
- **Gateway**: Zentrale Laufzeit, verwaltet Channels, Sessions, Agent Runs und die WebSocket API.
- **Agent Runtime**: Eingebettete p mono Runtime mit Moltbot eigener Session Steuerung und Tool Wiring.
- **Channels**: Adapter fuer Telegram, Slack, Discord, Signal, iMessage und weitere.
- **Routing**: Weist eingehende Nachrichten Agenten und Session Keys zu.
- **Infra**: Binaries, Ports, Env, Migrations, Usage Tracking.
- **Media Pipeline**: Fetch, Parse, Store und Hosting von Medien.
- **Extensions**: Plugins fuer zusaetzliche Channels und Features.

## Kernfluss End to End
### Nachrichtenfluss
1. **Eingang** ueber Channel Adapter.
2. **Routing** bestimmt Agent, Session Key und Kontext.
3. **Agent Loop**: Kontextaufbau, Modellwahl, Tool Calls, Streaming.
4. **Antwort** ueber denselben Channel zurueck.

Wichtige Bausteine:
- Routing Logik: `src/routing/resolve-route.ts`
- Agent Loop: `docs/concepts/agent-loop`
- Agent Runtime: `docs/concepts/agent`

### Session und Concurrency
- Pro Session Key wird serialisiert, um Tool Rennen zu vermeiden.
- Queueing Modus bestimmt, ob neue Nachrichten in laufende Runs einfliessen oder warten.

## Auth Broker und Provider
### Zielbild
Ein zentraler Broker verwaltet:
- OAuth Profile fuer Provider
- Prioritaeten und Fallback Regeln
- Sichtbarkeit, welche Auth Art aktiv ist

### Verbesserungsfelder
- Einheitliche Statusanzeige pro Provider
- Konsistente CLI Kommandos fuer Login und Use
- Klarer OAuth only Modus
- Debugging und Audit Event Logging fuer Auth Entscheidungen

## Channel Routing und Policies
### Hauptprinzipien
- DMs und Gruppen haben getrennte Policies.
- Pairing und Allowlists sind Standard.
- Gruppen reagieren idealerweise nur auf Mentions.

### Verbesserungsfelder
- Sauberer Default fuer sichere Channel Policies
- Vereinheitlichte Docs fuer DM und Group Policies je Channel

## Telegram Bot API und sichere Uebertragung
### Standard Empfehlung
**Long polling** ist der Default und benoetigt keine externe Erreichbarkeit.
Das ist die sicherste und einfachste Option.

### Webhook Modus
Falls Webhooks benoetigt werden:
- Setze `channels.telegram.webhookUrl`
- Optional `channels.telegram.webhookSecret`
- Optional `channels.telegram.webhookPath` falls ein eigener Pfad verwendet wird
Der lokale Listener bindet standardmaessig `0.0.0.0:8787` und erwartet `POST /telegram-webhook`.

### ngrok Einsatz
ngrok kann genutzt werden, um den lokalen Webhook Port sicher ueber TLS zu exponieren.
Empfehlung:
- Gateway weiter auf loopback behalten
- Nur den Webhook Port freigeben, nicht den Gateway Port
- Reverse Proxy Absicherung beachten

Security Hinweis:
Wenn ein Reverse Proxy davor steht, `gateway.trustedProxies` konfigurieren, damit keine lokalen Trust Checks missbraucht werden.
Siehe `docs/gateway/security`.

### Tailscale Einsatz
Tailscale ist ideal fuer Control UI und Gateway WebSocket Zugriff:
- `tailscale serve` fuer Tailnet Zugriff mit HTTPS
- `tailscale funnel` nur wenn bewusst oeffentlich

Hinweis: Telegram kann Tailnet Dienste nicht erreichen. Fuer Telegram Webhooks ist Tailscale Serve nicht ausreichend, ausser du setzt Funnel ein oder nutzt einen oeffentlichen Reverse Proxy.
Fuer Telegram bleibt Long polling die sicherste Standardwahl.

## Remote Zugriff und Transport
Standard ist Gateway auf loopback.
Remote Zugriff erfolgt ueber:
- Tailscale Serve fuer Control UI und WS
- SSH Tunnel als universeller Fallback
Siehe `docs/gateway/remote` und `docs/gateway/tailscale`.

## Sandbox, Docker und WSL
### Tool Sandbox
Moltbot kann Tools in Docker Sandboxes ausfuehren.
Das reduziert die Reichweite von Tool Calls.
Siehe `docs/gateway/sandboxing` und `docs/cli/sandbox`.

### Docker auf WSL
Docker unter WSL2 ist ausreichend fuer Entwicklungs und Testumgebungen.
Es ersetzt aber nicht die Moltbot Tool Sandbox.
Empfehlung fuer sichere Defaults:
- Gateway host bleibt stabil
- Tools laufen in Sandbox Containern
- Tool Policy und Elevated Exec strikt konfigurieren

### Entscheidungshilfe
- **Nur lokaler Betrieb**: Long polling, Gateway loopback, Sandbox optional aber empfohlen
- **Remote Betrieb**: Tailscale Serve plus token Auth
- **Oeffentliche Exponierung**: Nicht empfohlen, nur mit Funnel plus Password und strikter Security

## Verbesserungsmoeglichkeiten fuer deine Vision
### Architektur
- Einheitliche Auth Broker Doku mit Flow Diagramm
- Stabiler Provider Abstraktionslayer
- Zentrale Fehler und Retry Policies fuer OAuth Flows

### Sicherheit
- Standardisierte Secure Baseline Konfiguration
- Sandboxing Default fuer non main Sessions
- Tool Policy Profiles fuer verschiedene Rollen

### UX und Betrieb
- Ein einheitlicher Status Report fuer Auth und Channel Verbindungen
- Bessere Sichtbarkeit von Fallbacks und aktiven Tokens

## Nächste Schritte
1. Auth Broker Doku detaillieren: Flows pro Provider
2. Channel und Routing Doku finalisieren
3. Security Baseline und Sandbox Profile fuer deine Umgebung definieren

