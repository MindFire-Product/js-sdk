# MindFire JS SDK — Claude Context

## Project Overview

This is the **MindFire JavaScript SDK CDN distribution project**, hosted on Firebase at `https://mf-cdn.web.app`. It distributes two JavaScript SDKs to client websites via CDN and serves a dashboard page for browsing available SDK versions and copy-paste integration URLs.

## Repository Structure

```
public/
├── index.html                         # CDN dashboard (Bootstrap 5)
├── 404.html                           # Error redirect page
├── pixel-v*.js                        # Pixel SDK versions (production + staging)
└── voice-chat-component-v*.js         # Voice Chat Component versions
pixel.js                               # Pixel SDK development source
voice-chat-component-v060-dev.js       # Voice Chat Component development source
```

## SDKs

### 1. Pixel SDK (`pixel-v*.js`)
Client-side identity and event tracking SDK.

- Authenticates users against MindFire Identity Service (`https://services.mdl.io`)
- Retrieves and updates user records via the Contact Service
- Tracks custom events
- Supports referral-based record creation
- Uses a short-lived JWT token model (default 60-second expiry)

**Key global**: `_MFS`

**Key methods**:
- `_MFS.getRecord()` — authenticate and retrieve a record
- `record.update()` — update record fields
- `record.addEvent()` — log a tracking event
- `record.addNewRecord()` — create a new record via referral

**Backend endpoints** (`https://services.mdl.io`):
- `POST /api/identity/v1/list-record-auth`
- `PUT /api/identity/v1/list-record-auth/{accessId}`
- `PUT /api/contact-service/v1/offers/{recordId}`
- `PUT /api/contact-service/v1/events/{recordId}`

### 2. Voice Chat Component (`voice-chat-component-v*.js`)
A Web Component (`<voice-chat-component>`) that embeds an AI voice conversation widget.

- Implements a Shadow DOM isolated custom element
- Streams audio via Web Audio API / `getUserMedia`
- Connects to OpenAI Realtime Agent API (v0.3.6 as of v0.6.0)
- Loads agent configuration from MindFire's agent config server
- Implements server-side VAD with 15-second idle timeout
- Implements guardrails against hallucinations
- Emits DOM custom events for external integrations

**Attributes**: `data-agent-id`, `data-account-id`

**Key methods**: `startConversation()`, `stopConversation()`, `toggleMute()`

**Custom events emitted**:
- `session.created`
- `output_audio_buffer.started` / `stopped`
- `response.output_audio_transcript.done`
- `conversation.item.input_audio_transcription.completed`
- `voice.conversation.ended`
- `guardrail_tripped`
- `error`

**Agent config endpoint**: `GET https://z-server-stg.uc.r.appspot.com/api/v1/agents/{accountId}/{agentId}`

## Versioning Convention

- **Production**: `*-v060.js` (no suffix)
- **Staging**: `*-v060-stg.js`
- **Development source**: `*-dev.js` (not deployed)

When releasing a new version:
1. Develop in the `-dev.js` source file
2. Copy to a new `-stg.js` versioned file for staging testing
3. Copy to a new production versioned file once validated
4. Update `public/index.html` to list the new version

## Deployment

Deployed via **Firebase Hosting**. The firebase config files (`firebase.json`, `.firebaserc`) are gitignored but required locally. Deploy with:

```bash
firebase deploy --only hosting
```

## Technologies

- **JavaScript (ES6 modules)** — all SDK code
- **Web Components + Shadow DOM** — Voice Chat Component isolation
- **Web Audio API** — microphone/speaker streaming
- **OpenAI Realtime Agents SDK** (`@openai/agents-realtime`) — AI conversation
- **Bootstrap 5.3.2** — CDN dashboard UI
- **Firebase Hosting** — static asset hosting

## External Dependencies (CDN, no package.json)

All dependencies are loaded from CDN at runtime. There is no `npm install` or build step. The SDKs are plain JavaScript files intended to be included via `<script>` tags.

- `https://cdn.jsdelivr.net/npm/@openai/agents-realtime@0.3.6/+esm`
- `https://cdn.jsdelivr.net/npm/bootstrap@5.3.2/...`

## Development Notes

- No build tooling or bundler — files are edited directly
- There is no test suite
- Staging and production share the same codebase; versions are differentiated by file naming
- The `pixel.js` file at root is the working source for the Pixel SDK, mirroring the latest `pixel-v*.js`
- Voice Chat dev source is `voice-chat-component-v060-dev.js` at root

## ⚠️ Agent Editing Rules

**Agents (AI) may ONLY edit `-dev.js` files.** Specifically:

- ✅ `voice-chat-component-v060-dev.js` — editable by agents
- ✅ `pixel.js` — editable by agents
- ❌ `public/voice-chat-component-v*.js` — **never edit directly**; these are versioned release files managed by human developers
- ❌ `public/pixel-v*.js` — **never edit directly**

After an agent edits a `-dev.js` file, a human developer will review the changes and manually copy the file to a new versioned staging/production file.

## Feature Specs

Planned and in-progress feature specs live in `specs/`. Before implementing any new feature, check this directory for a spec doc.

| Spec file | Feature | Status |
|-----------|---------|--------|
| `specs/voice-chat-component-v070-spec.md` | Rename `visitorInfo` → `data`; add `history` property | Ready to implement |
