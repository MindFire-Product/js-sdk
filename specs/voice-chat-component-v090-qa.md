# Voice Chat Component v0.9.0 — QA Test Plan

**CDN URL under test**: `https://mf-cdn.web.app/voice-chat-component-v090-stg.js`

---

## What Changed in v0.9.0

### Feature: Server-configurable VAD (Voice Activation Detection)

Turn detection is now read from the agent config server instead of being hardcoded. Two VAD types are supported:

| VAD Type | Parameters |
|----------|-----------|
| `server_vad` | `threshold`, `silence_duration_ms`, `prefix_padding_ms` |
| `semantic_vad` | `eagerness` |

Common parameters: `interrupt_response`, `idle_timeout_ms` (default 15000ms).

When no `turn_detection` is configured on the agent, the component falls back to `server_vad` with a 15-second idle timeout (same behavior as v0.8.0).

### Feature: Input Audio Transcription

Input audio transcription is now configurable per-agent. Parameters: `model` (default `"gpt-4o-transcribe"`), `language` (default `"en"`), `prompt` (optional). All agents get transcription by default.

### Feature: Noise Reduction

Optional noise reduction (`near_field` or `far_field`) can be configured per-agent to filter audio before VAD processing.

### Feature: Graceful `conversation_already_has_active_response` handling

When interrupt is disabled and the user speaks during an active response, the session no longer crashes. The expected error is silently ignored and the wave animation resets.

### Feature: Enhanced error logging

Session errors now include structured JSON output in the console for easier debugging.

### Bug Fix: Restored `show_button_shadow` configurability

The `show_button_shadow` theme property was accidentally broken in the initial v090 copy. The conditional shadow logic has been restored for all states (base, hover, high-DPI).

---

## Test Environment Setup

To test, create an HTML page that loads the v0.9.0 staging component:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>v0.9.0 QA Test</title>
</head>
<body>
  <voice-chat-component
    data-agent-id="YOUR_AGENT_ID"
    data-account-id="YOUR_ACCOUNT_ID">
  </voice-chat-component>

  <script type="module">
    import 'https://mf-cdn.web.app/voice-chat-component-v090-stg.js';
  </script>

  <script>
    const vc = document.querySelector('voice-chat-component');

    vc.data = {
      name: "Jane Smith",
      email: "jane@example.com",
      propertyAddress: "456 Oak Ave, Austin TX"
    };
  </script>
</body>
</html>
```

---

## Test Cases

### TC-1: Server VAD — default fallback (no turn_detection configured)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Use an agent with NO `turn_detection` in its config | Agent config loads successfully |
| 2 | Start a conversation | Session connects normally |
| 3 | Speak to the agent and then stay silent | Agent responds, then after ~15 seconds of silence the session times out |
| 4 | Verify session event | `input_audio_buffer.timeout_triggered` event fires after idle timeout |

**Result**: Pass / Fail

---

### TC-2: Server VAD — custom parameters

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `turn_detection: { type: "server_vad", threshold: 0.7, silence_duration_ms: 1000, prefix_padding_ms: 500, idle_timeout_ms: 30000 }` | Agent config loads with turn detection settings |
| 2 | Start a conversation | Session connects with the configured VAD parameters |
| 3 | Speak briefly and pause | The agent waits approximately 1000ms of silence before responding (matching `silence_duration_ms`) |
| 4 | Stay silent after the agent responds | Session times out after ~30 seconds (matching `idle_timeout_ms`) instead of the default 15 |

**Result**: Pass / Fail

---

### TC-3: Semantic VAD — custom parameters

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `turn_detection: { type: "semantic_vad", eagerness: "low", idle_timeout_ms: 20000 }` | Agent config loads with semantic VAD settings |
| 2 | Start a conversation | Session connects with semantic VAD |
| 3 | Speak a partial sentence and pause briefly | With `eagerness: "low"`, the model waits longer before taking its turn, allowing for natural pauses in speech |
| 4 | Complete your thought | The agent responds after detecting you're done (based on semantic understanding, not just silence) |
| 5 | Stay silent after conversation | Session times out after ~20 seconds |

**Result**: Pass / Fail

---

### TC-4: Semantic VAD — high eagerness

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `turn_detection: { type: "semantic_vad", eagerness: "high" }` | Agent config loads |
| 2 | Start a conversation and speak | The agent responds more quickly after detecting a natural break in your speech compared to TC-3 |
| 3 | Stay silent after conversation | Session times out after ~15 seconds (default `idle_timeout_ms`) |

**Result**: Pass / Fail

---

### TC-5: Interrupt response — enabled (default)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `turn_detection: { type: "server_vad", interrupt_response: true }` | Agent config loads |
| 2 | Start a conversation and let the agent begin a long response | Agent speaks |
| 3 | Interrupt by speaking over the agent | Agent stops speaking and listens to your input |

**Result**: Pass / Fail

---

### TC-6: Interrupt response — disabled

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `turn_detection: { type: "server_vad", interrupt_response: false }` | Agent config loads |
| 2 | Start a conversation and let the agent begin a long response | Agent speaks |
| 3 | Attempt to interrupt by speaking over the agent | Agent continues speaking and does not get interrupted |

**Result**: Pass / Fail

---

### TC-7: Input audio transcription — default config (all agents)

> **Note:** Transcription config is set server-side for all agents with defaults (`model: "gpt-4o-transcribe"`, `language: "en"`). The admin UI does not expose these controls — they are intentionally hidden. The `language: "en"` setting guides transcription to English but does not prevent the agent from speaking other languages.

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Use any agent (all agents have transcription enabled by default) | Agent config loads with `input_audio_transcription` containing `model: "gpt-4o-transcribe"` and `language: "en"` |
| 2 | Start a conversation and speak | Session connects with transcription enabled |
| 3 | Speak a sentence | `conversation.item.input_audio_transcription.completed` event fires with transcript text in English |
| 4 | Check browser console | No transcription-related errors |
| 5 | If CC is enabled, verify user captions appear | User's speech is captioned based on transcription |

**Result**: Pass / Fail

---

### TC-8: Noise reduction — near_field

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `input_audio_noise_reduction: { type: "near_field" }` | Agent config loads |
| 2 | Start a conversation using headphones/close mic | Session connects normally with noise reduction active |
| 3 | Have a conversation | Voice detection works correctly, background noise is filtered |

**Result**: Pass / Fail

---

### TC-9: Noise reduction — off (default)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Use an agent with `input_audio_noise_reduction: null` | Agent config loads |
| 2 | Start a conversation | Session connects without noise reduction (same as v0.8.0) |

**Result**: Pass / Fail

---

### TC-10: Graceful error handling — speak during active response (interrupt disabled)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with `turn_detection: { type: "server_vad", interrupt_response: false }` | Agent config loads |
| 2 | Start a conversation and ask a question that produces a long response | Agent begins speaking |
| 3 | Speak while the agent is still responding | Session does NOT crash; console shows `[Voice Component] Ignored expected error` warning |
| 4 | Wait for agent to finish responding | Agent completes its response normally |
| 5 | Continue the conversation | Session is still active and functional |

**Result**: Pass / Fail

---

### TC-11: Enhanced error logging

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Trigger a session error (e.g., disconnect network mid-conversation) | Console shows `Session error details:` followed by formatted JSON |

**Result**: Pass / Fail

---

### TC-12: Button shadow — regression fix (shadow disabled)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `show_button_shadow: false` in agent theme | Agent config loads |
| 2 | Inspect the filled-style start button | `box-shadow: none` — no shadow visible |
| 3 | Hover over the button | Still no shadow |
| 4 | Test on a high-DPI display or emulate one in DevTools | Still no shadow (high-DPI media query respects the setting) |

**Result**: Pass / Fail

---

### TC-13: Button shadow — enabled (default)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `show_button_shadow: true` (or leave unset) in agent theme | Agent config loads |
| 2 | Inspect the filled-style start button | Box-shadow is visible |
| 3 | Hover over the button | Enhanced shadow is visible |
| 4 | Test on a high-DPI display or emulate one | High-DPI shadow is visible |

**Result**: Pass / Fail

---

### TC-14: Regression — v0.8.0 features still work

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Start a conversation | Modal opens, "Connecting..." shown, then "Connected" with green dot |
| 2 | Speak to the agent | Agent responds with audio; sound wave animation activates |
| 3 | Click Mute, then Unmute | Mute state toggles correctly |
| 4 | Click Stop | Conversation ends, modal closes |
| 5 | Set `data` and `history` properties | Agent uses both in conversation |
| 6 | Verify dark mode: button text color preserved | Button text stays the configured color in dark mode |
| 7 | Verify modal text: readable in light mode | Modal text is dark gray on white, not white-on-white |
| 8 | Test `button_size: "small"` and `button_style: "outline"` | Button renders correctly with configured size/style |
| 9 | Enable CC (`show_cc_button: true`), toggle on, have a conversation | Closed captions work: user captions immediate, agent captions word-by-word |
| 10 | Listen for events: `session.created`, `output_audio_buffer.started/stopped`, `voice.conversation.ended` | All events fire with expected payloads |
| 11 | Press Escape while modal is open | Modal closes, conversation ends |

**Result**: Pass / Fail

---

### TC-15: CDN dashboard updated

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Visit `https://mf-cdn.web.app` | Production tab loads correctly |
| 2 | Click the "Staging" tab | Staging tab loads |
| 3 | Verify Voice Chat Component section | v0.9.0-stg is listed with "Pre-release" badge |
| 4 | Click the copy button for v0.9.0-stg | URL `https://mf-cdn.web.app/voice-chat-component-v090-stg.js` is copied to clipboard |
| 5 | Verify older versions still listed | v0.8.0, v0.7.0, etc. all present with correct URLs |

**Result**: Pass / Fail

---

## Summary Checklist

| Test Case | Feature | Priority | Result |
|-----------|---------|----------|--------|
| TC-1 | Server VAD — default fallback | High | |
| TC-2 | Server VAD — custom parameters | High | |
| TC-3 | Semantic VAD — low eagerness | High | |
| TC-4 | Semantic VAD — high eagerness | Medium | |
| TC-5 | Interrupt response — enabled | High | |
| TC-6 | Interrupt response — disabled | High | |
| TC-7 | Input audio transcription — default (all agents) | High | |
| TC-8 | Noise reduction — near_field | Medium | |
| TC-9 | Noise reduction — off (default) | Medium | |
| TC-10 | Graceful error handling — interrupt disabled | High | |
| TC-11 | Enhanced error logging | Low | |
| TC-12 | Button shadow — disabled (regression fix) | High | |
| TC-13 | Button shadow — enabled (default) | Medium | |
| TC-14 | Regression — v0.8.0 features | High | |
| TC-15 | CDN dashboard updated | Low | |
