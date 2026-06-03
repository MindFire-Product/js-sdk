# Voice Chat Component v1.0.0 — Feature Spec

**Development source**: `voice-chat-component-v100-dev.js`
**Staging CDN**: `https://mf-cdn.web.app/voice-chat-component-v100-stg.js`
**OpenAI SDK version**: `@openai/agents-realtime@0.7.2`

---

## Overview

v1.0.0 adds consent handling, SDK-version-aware Realtime token requests, backend-controlled Realtime model selection, and mute-state UX improvements.

This version intentionally keeps the existing DOM event stream compatible with older integrations and adds one new custom event for consent acceptance.

---

## SDK Version Behavior

v1.0.0 sends `sdk_version=v100` when requesting the ephemeral Realtime token:

```text
GET /api/v1/llms/token/{account_id}/{agent_id}/{voice}?sdk_version=v100
```

The backend uses this value for backward-compatible model selection:

| SDK behavior | Token request | Expected model path |
|--------------|---------------|---------------------|
| v090 and older | No `sdk_version` query param | Legacy realtime model |
| v100 and newer | `sdk_version=v100` | Current backend-configured realtime model |

The public agent config also returns `realtime_model` and, when applicable, `realtime_reasoning_effort`. v100 passes those values into the browser `RealtimeSession`:

```javascript
model: this.agentConfig.realtime_model || "gpt-realtime-2"
config: {
  reasoning: { effort: this.agentConfig.realtime_reasoning_effort }
}
```

The backend omits reasoning effort for legacy realtime models. This keeps the backend-minted ephemeral session and browser-created Realtime session aligned without sending unsupported reasoning config to older model paths.

---

## Consent Prompt

When an agent config includes:

```json
{
  "consent_enabled": true,
  "consent_message": "..."
}
```

v100 shows a consent prompt before microphone permission, token fetch, or Realtime session connection.

Key behavior:

- Consent is requested every time the visitor starts a new voice session.
- Consent is not remembered in `localStorage`, `sessionStorage`, cookies, or the MindFire backend.
- Selecting **Cancel** closes the consent prompt and does not start a session.
- Selecting **Agree** emits `voice.consent.accepted`, then proceeds with session startup.

---

## New Event: `voice.consent.accepted`

The Web Component emits this DOM `CustomEvent` every time the visitor explicitly clicks **Agree** in the consent prompt.

Example:

```javascript
const voiceComponent = document.querySelector("voice-chat-component");

voiceComponent.addEventListener("voice.consent.accepted", (event) => {
  console.log(event.detail);
});
```

Payload:

```json
{
  "account_id": "36038",
  "agent_id": "6939b1f2fa486d985bff76ae",
  "sdk_version": "v100",
  "consent_enabled": true,
  "consent_message": "By selecting Agree...",
  "accepted_at": "2026-06-02T18:30:00.000Z",
  "page_url": "https://example.com/page"
}
```

Downstream event persistence SDKs should listen for this event and persist it in their own event store. They should also add their own server-side or ingestion-side receipt timestamp, because `accepted_at` comes from the visitor's browser clock.

---

## Event Compatibility

Existing OpenAI Realtime server/client events continue to be forwarded with their original event names through the component's DOM event stream.

Existing custom events remain:

- `voice.conversation.ended`
- `guardrail_tripped`
- `error`

New custom event:

- `voice.consent.accepted`

---

## Mute UX

v100 centralizes mute state updates so manual and programmatic mute changes keep the microphone tracks, button state, accessible label, and in-modal muted banner in sync.

The modal now shows a prominent muted-state banner when the visitor is muted.

---

## Validation Checklist

- [ ] `public/voice-chat-component-v100-stg.js` uses `https://z-server-stg.uc.r.appspot.com/api`.
- [ ] v100 token calls include `sdk_version=v100`.
- [ ] v100 browser session uses `agentConfig.realtime_model` when present.
- [ ] Consent prompt appears before microphone permission when `consent_enabled=true`.
- [ ] Consent prompt appears again for each new session.
- [ ] Clicking **Agree** emits `voice.consent.accepted` before the session starts.
- [ ] `voice.consent.accepted.detail` includes account ID, agent ID, SDK version, consent message, browser timestamp, and page URL.
- [ ] Clicking **Cancel** does not request microphone permission or start a session.
- [ ] Existing event listeners for Realtime events still receive original event names.
- [ ] v090 staging/production assets remain available and unchanged.
