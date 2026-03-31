# Voice Chat Component v0.9.0 — Release Notes

**Release date**: March 2026
**CDN (staging)**: `https://mf-cdn.web.app/voice-chat-component-v090-stg.js`

---

## New Features

### Server-configurable Voice Activation Detection (VAD)

Turn detection parameters are now read from the agent configuration server instead of being hardcoded. This allows per-agent customization of how the component detects when the user starts and stops speaking.

**Two VAD types are supported:**

| VAD Type | Use Case | Key Parameters |
|----------|----------|----------------|
| `server_vad` | Standard voice detection based on audio signal levels | `threshold`, `silence_duration_ms`, `prefix_padding_ms` |
| `semantic_vad` | AI-powered turn-taking based on semantic understanding of speech | `eagerness` (`"low"`, `"medium"`, `"high"`, `"auto"`) |

**Common parameters (both types):**

| Parameter | Default | Description |
|-----------|---------|-------------|
| `interrupt_response` | `true` | Whether the user can interrupt the agent while it's speaking |
| `idle_timeout_ms` | `15000` | Time in milliseconds before the session ends due to inactivity |

**How it works:**
- The component reads `turn_detection` from the agent config returned by the server
- If `turn_detection` is present, all specified parameters are forwarded to the OpenAI Realtime session
- If `turn_detection` is absent or null, the component falls back to `server_vad` with a 15-second idle timeout — the same behavior as v0.8.0
- `idle_timeout_ms` is only supported for `server_vad` mode (OpenAI API constraint, range 5000–30000ms)

**Configuration examples:**

Server VAD with custom sensitivity:
```json
{
  "turn_detection": {
    "type": "server_vad",
    "threshold": 0.7,
    "silence_duration_ms": 1000,
    "prefix_padding_ms": 500,
    "idle_timeout_ms": 30000
  }
}
```

Semantic VAD for natural conversation:
```json
{
  "turn_detection": {
    "type": "semantic_vad",
    "eagerness": "low"
  }
}
```

### Input Audio Transcription

Input audio transcription is now enabled for all agents by default via server-side configuration. The component reads transcription settings from the agent config and forwards them to the OpenAI Realtime session.

| Parameter | Default | Description |
|-----------|---------|-------------|
| `model` | `"gpt-4o-transcribe"` | Full transcription model (chosen over OpenAI's default `gpt-4o-mini-transcribe` for better accuracy) |
| `language` | `"en"` | Language hint — guides transcription to English output; does **not** prevent the agent from speaking other languages |
| `prompt` | `null` | Optional prompt to guide transcription |

All agents receive transcription config by default from the server. The transcription configuration controls are intentionally hidden from the admin UI — no admin action is required. This enables user speech transcription for closed captions and conversation transcript logging.

### Noise Reduction

Optional noise reduction can now be configured per-agent to filter audio before VAD processing, reducing false voice detection triggers from background noise.

| Mode | Use Case |
|------|----------|
| `near_field` | Headphones or close microphone |
| `far_field` | Laptop speakers or speakerphone |

Noise reduction is off by default (`null`). When enabled, it is applied before voice activity detection.

---

## Improvements

### Graceful handling of `conversation_already_has_active_response` error

When interrupt is disabled (`interrupt_response: false`) and the user speaks during an active agent response, the OpenAI API rejects the SDK's attempt to create a new response. In v0.8.0 this was treated as a fatal error and killed the session. v0.9.0 now silently ignores this expected error and resets the wave animation.

### Enhanced error logging

Session errors now include structured JSON output (`JSON.stringify`) in the console, making it easier to inspect error details during debugging.

---

## Bug Fixes

### Restored `show_button_shadow` configurability

The `show_button_shadow` theme property (introduced in v0.8.0) was accidentally broken during the v0.9.0 file creation. The conditional shadow logic in the high-DPI media query was replaced with unconditional shadows, causing the button to always display a shadow regardless of the theme setting. This has been restored — setting `show_button_shadow: false` correctly removes the shadow in all states (base, hover, high-DPI).

---

## No Breaking Changes

This release is fully backward compatible with v0.8.0. All existing functionality is unchanged:

- Voice conversation, mute/unmute, stop
- Modal UI and sound wave animation
- `data` and `history` properties
- All custom DOM events (`session.created`, `voice.conversation.ended`, etc.)
- Knowledge base search and MCP Zapier tools
- Closed captions / CC toggle
- Button customization (`button_size`, `button_style`, `show_button_shadow`)
- Dark mode button text color fix
- Output guardrails

### Known Limitations

- **`interrupt_response` has no effect** — Due to a bug in `@openai/agents-realtime` v0.7.2, the SDK reads `interrupt_response` from the server echo rather than the passed config. The "Allow Interruptions" toggle has been removed from the admin UI. The field is passed through and will work once the SDK is fixed.
- **`idle_timeout_ms` is only supported for `server_vad`** — Per OpenAI API constraints, idle timeout is not available for `semantic_vad` mode. Semantic VAD uses eagerness-based timeouts instead (low=8s, medium=4s, high=2s).
