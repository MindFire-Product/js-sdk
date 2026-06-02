# Voice Chat Component v1.0.0 — Release Notes

**Release date**: TBD
**CDN (staging)**: `https://mf-cdn.web.app/voice-chat-component-v100-stg.js`
**CDN (production, planned)**: `https://mf-cdn.web.app/voice-chat-component-v100.js`

---

## New Features

### Consent Prompt

Agents can now require a visitor consent prompt before a voice chat session starts. When enabled, the visitor must select **Agree** before the component requests microphone permission or connects to the Realtime session.

Consent is requested every time a new voice session starts. The SDK does not remember consent in browser storage and does not persist consent to the MindFire backend.

### Consent Acceptance Event

v1.0.0 adds a new DOM custom event:

```javascript
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

Downstream event persistence SDKs should persist this event in their own event store and add their own receipt timestamp.

### Backend-Controlled Realtime Model Path

v1.0.0 sends `sdk_version=v100` when requesting the ephemeral Realtime token. The backend uses this value to keep older SDKs on the legacy realtime model while allowing v100 to use the backend-configured `realtime_model` returned by the public agent config.

This keeps model selection aligned between the backend-created ephemeral session and the browser-created Realtime session.

### Muted-State Banner

The in-session modal now shows a clear muted-state banner when the visitor is muted. Manual and programmatic mute changes keep the microphone tracks, button label, and banner state in sync.

---

## Compatibility Notes

- v090 and older SDKs do not send `sdk_version`; backend token requests treat them as legacy.
- v100 sends `sdk_version=v100`; backend token requests use the current configured realtime model.
- v100 reads `realtime_model` from the public agent config and passes it into `RealtimeSession`.
- Existing Realtime event names are still forwarded unchanged.
- `voice.consent.accepted` is additive and should not break existing listeners.

---

## Staging Validation

- Use `https://mf-cdn.web.app/voice-chat-component-v100-stg.js`.
- Confirm the staged file points to `https://z-server-stg.uc.r.appspot.com/api`.
- Confirm consent prompt appears before microphone permission.
- Confirm `voice.consent.accepted` fires every time the visitor clicks **Agree**.
- Confirm no consent state is persisted in browser storage.
- Confirm live conversation still connects and emits existing transcript/session events.
