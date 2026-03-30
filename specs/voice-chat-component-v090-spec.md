# Voice Chat Component v0.9.0 — Feature Spec

**Target file to edit**: `voice-chat-component-v090-dev.js` (root of repo — copy from `voice-chat-component-v080-dev.js` before starting)
**OpenAI SDK version**: `@openai/agents-realtime@0.7.2`

> **IMPORTANT**: Only `-dev.js` files may be edited by agents. Never edit versioned files (e.g. `public/voice-chat-component-v080.js`) directly.

---

## Overview

Multiple features and one bug fix are being made to the Voice Chat Component:

1. **Feature: Server-configurable VAD (Voice Activation Detection)** — Replace the hardcoded `server_vad` turn detection with a dynamic configuration read from the agent config server. Supports both `server_vad` and `semantic_vad` types with full parameter control.

2. **Feature: Input audio transcription** — Enable server-configurable input audio transcription with model, language, and prompt parameters read from the agent config.

3. **Feature: Noise reduction** — Add optional noise reduction filtering (`near_field` or `far_field`) configurable per-agent to reduce VAD false positives.

4. **Feature: Graceful `conversation_already_has_active_response` handling** — When interrupt is disabled and the user speaks during an active response, silently ignore the expected error instead of killing the session.

5. **Feature: Enhanced error logging** — Add structured JSON logging for session errors to aid debugging.

6. **Bug fix: Restore `show_button_shadow` configurability** — The `show_button_shadow` conditional was accidentally removed when creating the v090 dev file from v080. Restore it so the theme property continues to control button shadow visibility.

---

## Feature 1: Server-configurable VAD / turn detection

### Motivation

In v0.8.0, the turn detection was hardcoded to `server_vad` with a 15-second idle timeout. This prevented per-agent customization of voice activity detection behavior. Different use cases benefit from different VAD settings — for example, agents handling complex queries may need longer silence thresholds, while conversational agents benefit from faster turn-taking via semantic VAD.

### Agent config `turn_detection` schema

The agent config server returns an optional `turn_detection` object on the agent configuration:

| Field | Type | Applies to | Description |
|-------|------|------------|-------------|
| `type` | `"server_vad"` \| `"semantic_vad"` | Both | The VAD algorithm to use |
| `threshold` | `number` (0.0–1.0) | `server_vad` only | Sensitivity threshold for voice detection |
| `silence_duration_ms` | `number` | `server_vad` only | Duration of silence (ms) before a turn ends |
| `prefix_padding_ms` | `number` | `server_vad` only | Audio padding (ms) before detected speech |
| `eagerness` | `string` | `semantic_vad` only | How eagerly the model takes turns (e.g. `"low"`, `"medium"`, `"high"`, `"auto"`) |
| `interrupt_response` | `boolean` | Both | Whether the user can interrupt the agent's response |
| `idle_timeout_ms` | `number` | `server_vad` only | Timeout (ms) after which a model response is triggered due to inactivity (5000–30000). Defaults to `15000`. Not supported for `semantic_vad` per OpenAI API. |

### Changes

#### 1. Build `turnDetection` dynamically from `agentConfig.turn_detection`

In `startConversation()`, before creating the `RealtimeSession`, read the agent config and build the turn detection object:

```javascript
// Build turnDetection config from agent settings or use defaults
const td = this.agentConfig.turn_detection;
const turnDetection = td
  ? {
      type: td.type,
      ...(td.type === "server_vad" && {
        threshold: td.threshold,
        silenceDurationMs: td.silence_duration_ms,
        prefixPaddingMs: td.prefix_padding_ms,
      }),
      ...(td.type === "semantic_vad" && {
        eagerness: td.eagerness,
      }),
      interruptResponse: td.interrupt_response,
      idleTimeoutMs: td.idle_timeout_ms ?? 15000,
    }
  : {
      type: "server_vad",
      idleTimeoutMs: 15000,
    };
```

**Key behaviors:**
- When `turn_detection` is present, all specified fields are forwarded to the OpenAI SDK
- When `turn_detection` is absent/null, falls back to `server_vad` with 15s idle timeout (same as v0.8.0)
- `server_vad`-specific fields (`threshold`, `silenceDurationMs`, `prefixPaddingMs`) are only included when `type` is `"server_vad"`
- `semantic_vad`-specific fields (`eagerness`) are only included when `type` is `"semantic_vad"`
- `idleTimeoutMs` defaults to 15000ms if not specified in the config

#### 2. Pass `turnDetection` to the `RealtimeSession` config

Replace the hardcoded turn detection object:

```diff
  this.session = new RealtimeSession(this.agent, {
    model: "gpt-realtime",
    outputGuardrails: guardrails,
    tracingDisabled: false,
    config: {
      audio: {
        input: {
-         turnDetection: {
-           type: "server_vad",
-           idleTimeoutMs: 15000,
-         }
+         turnDetection: turnDetection,
        }
      }
    }
  });
```

The `config.audio.input.turnDetection` nesting matches the OpenAI Realtime API structure (`audio.input.turn_detection`).

---

## Feature 2: Input audio transcription

### Motivation

Input audio transcription allows the component to receive text transcriptions of user speech, enabling features like closed captions for user utterances and conversation transcript logging.

### Admin UI status

The transcription configuration controls are **intentionally hidden** from the agent admin UI. The fields exist in the Agent model and are set with server-side defaults for all agents. This means:
- All agents automatically get transcription enabled — no admin action required
- The default model is `gpt-4o-transcribe` (chosen over OpenAI's default `gpt-4o-mini-transcribe` for better accuracy)
- The default language is `"en"` — this does **not** prevent the agent from speaking in other languages, but guides the transcription engine toward English output, reducing misdetection from accents

### Agent config `input_audio_transcription` schema

| Field | Type | Default | Description |
|-------|------|---------|-------------|
| `model` | `string` | `"gpt-4o-transcribe"` | The transcription model (intentionally set to full model, not mini, for accuracy) |
| `language` | `string` | `"en"` | Language hint for transcription — guides output to English, does not restrict agent language |
| `prompt` | `string` | `null` | Optional prompt to guide transcription (not exposed in admin UI) |

All agents get transcription by default (it's a non-null field with defaults on the server). The config controls are hidden from the admin UI — changes require direct model updates.

### Changes

In `startConversation()`, after building the `turnDetection` config, read the transcription config and add it to the audio input:

```javascript
const transcription = this.agentConfig.input_audio_transcription;
if (transcription) {
  audioInput.transcription = {
    model: transcription.model,
    ...(transcription.language && { language: transcription.language }),
    ...(transcription.prompt && { prompt: transcription.prompt }),
  };
}
```

**Key behaviors:**
- Only includes `language` and `prompt` if they have truthy values (avoids sending `null`)
- All agents receive transcription config by default from the server
- The transcription object is added to `audioInput` alongside `turnDetection`

---

## Feature 3: Noise reduction

### Motivation

Background noise can cause false VAD triggers, especially in environments with laptop speakers or speakerphones. Noise reduction filters the audio before VAD processing to reduce false positives.

### Agent config `input_audio_noise_reduction` schema

| Field | Type | Description |
|-------|------|-------------|
| `type` | `"near_field"` \| `"far_field"` | `near_field` for headphones/close mic, `far_field` for laptop/speakerphone |

This field is `null` by default (noise reduction off).

### Changes

```javascript
const noiseReduction = this.agentConfig.input_audio_noise_reduction;
if (noiseReduction) {
  audioInput.noiseReduction = { type: noiseReduction.type };
}
```

**Key behaviors:**
- Only added to `audioInput` when the agent has noise reduction configured
- When absent/null, no noise reduction is applied (same as v0.8.0)

---

## Feature 4: Graceful `conversation_already_has_active_response` error handling

### Motivation

When `interrupt_response` is `false`, the OpenAI API won't cancel an active response when the user speaks. However, the SDK still detects speech end and tries to create a new response, which OpenAI rejects with `conversation_already_has_active_response`. In v0.8.0 this was treated as a fatal error and killed the session.

### Changes

In the session event handler for `"error"` events:

```javascript
if (event.error?.code === "conversation_already_has_active_response") {
  console.warn("[Voice Component] Ignored expected error: user spoke during active response (interrupt disabled)");
  this.toggleSoundWave(false);
  break;
}
```

**Key behaviors:**
- Silently ignores the expected error instead of killing the session
- Resets the wave animation since the SDK's `interrupt()` call may have cleared the audio buffer on the client side
- Only applies to this specific error code — all other errors still follow the fatal error path

---

## Feature 5: Enhanced error logging

### Changes

Added structured JSON logging for session errors:

```javascript
console.error("Session error details:", JSON.stringify(event.error || event, null, 2));
```

This makes it easier to inspect error objects in browser devtools when debugging session issues.

---

## Feature 6: Restore `show_button_shadow` configurability (regression fix)

### Problem

When creating v090-dev.js from v080-dev.js, the `show_button_shadow` conditional was accidentally removed from the high-DPI media query shadow declarations. This caused the button shadow to always display, ignoring the theme setting.

### Changes

Restore the conditional in the `@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)` block:

```diff
  @media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi) {
      .start-button {
-         box-shadow: 0 2px 10px rgba(0,123,255,0.3);
+         box-shadow: ${this.agentConfig.theme.show_button_shadow !== false ? '0 2px 10px rgba(0,123,255,0.3)' : 'none'};
      }
      .start-button:hover {
-         box-shadow: 0 3px 15px rgba(0,123,255,0.4);
+         box-shadow: ${this.agentConfig.theme.show_button_shadow !== false ? '0 3px 15px rgba(0,123,255,0.4)' : 'none'};
      }
  }
```

---

## Bug Fix 2: CC button decoupled from primary color and `show_cc_button`

### Problem

The CC button had two issues:
1. It was conditionally rendered based on `agentConfig.show_cc_button`, making it admin-configurable — inconsistent with mute and stop, which are always present as modal controls
2. Its active state used `var(--primary-color)` as the background color. When an agent's primary color is white, the active CC button (white background + white icon) was invisible

### Changes

1. Remove the `show_cc_button` conditional — the CC button always renders
2. `.cc-btn.cc-active` uses fixed `#3b82f6` (blue) instead of `var(--primary-color)`

All three modal control buttons now follow the same pattern: fixed semantic colors independent of the agent's primary color.

| Button | Inactive | Active |
|--------|----------|--------|
| Mute | Gray `#6b7280` | Amber `#f59e0b` |
| CC | Gray `#6b7280` | Blue `#3b82f6` |
| Stop | Red `#dc2626` | — |

---

## Bug Fix 3: Sound wave visibility in light and dark mode

### Problem

Both `--sound-wave-color` (idle) and `--sound-wave-active-color` (speaking) were tied directly to `primary_color`. Two compounding issues:

1. **White/light primary in light mode**: wave bars invisible on the white modal background
2. **Dark primary in dark mode**: wave bars invisible on the dark (`#1f2937`) modal background
3. **Opacity compounding**: Idle bars had `opacity: 0.4`. Even a darkened wave color becomes invisible at 40% opacity on white — pure black at 0.4 opacity on white yields only ~1.6:1 contrast, below any usability threshold

### Changes

**Idle bars:**
- `--sound-wave-idle-color` replaces `opacity: 0.4` + primary color
- Fixed neutral: `#d1d5db` in light mode, `#4b5563` in dark mode
- Set in both the JS `:host` block (at render time) and the CSS `@media (prefers-color-scheme: dark)` block (for dynamic mode changes)
- `opacity: 0.4` removed from `.wave-bar`

**Active/speaking bars:**
- `_getWaveColor(primaryColor)` — new private method
- Parses hex color and computes WCAG relative luminance
- Light mode + luminance > 0.5 → blend 50% toward `#374151`
- Dark mode + luminance < 0.15 → blend 50% toward `#e5e7eb`
- Otherwise returns primary color unchanged
- Falls back to original string if color cannot be parsed (named colors, CSS variables)

**New private methods added:**
- `_parseHexColor(hex)` — parses `#rrggbb` / `#rgb` to `{r, g, b}`
- `_getLuminance(r, g, b)` — WCAG relative luminance formula
- `_getWaveColor(primaryColor)` — returns adjusted color or original

---

## Validation Checklist

### Server-configurable VAD
- [ ] Agent with `turn_detection.type: "server_vad"` and custom `threshold`, `silence_duration_ms`, `prefix_padding_ms` — all values forwarded to session config
- [ ] Agent with `turn_detection.type: "semantic_vad"` and custom `eagerness` — eagerness forwarded, no server_vad-specific fields included
- [ ] Agent with `turn_detection.interrupt_response: false` — user cannot interrupt agent
- [ ] Agent with custom `idle_timeout_ms` — session times out after the specified duration
- [ ] Agent with no `turn_detection` field — falls back to `server_vad` with 15s idle timeout (same as v0.8.0)
- [ ] `turnDetection` object is passed at `config.audio.input.turnDetection` path

### Input audio transcription
- [ ] Agent with default transcription config (`model: "gpt-4o-transcribe"`, `language: "en"`) — transcription is applied to session
- [ ] Agent with custom `language` — language value forwarded
- [ ] Agent with custom `prompt` — prompt value forwarded
- [ ] Agent with `prompt: null` — prompt field is not included in the config sent to OpenAI

### Noise reduction
- [ ] Agent with `input_audio_noise_reduction: { type: "near_field" }` — noise reduction applied
- [ ] Agent with `input_audio_noise_reduction: { type: "far_field" }` — noise reduction applied
- [ ] Agent with `input_audio_noise_reduction: null` — no noise reduction (same as v0.8.0)

### Graceful error handling
- [ ] With `interrupt_response: false`, speak during agent response — session continues, no fatal error
- [ ] Wave animation resets after the ignored error
- [ ] Other session errors still trigger fatal error handling

### Enhanced error logging
- [ ] Session error produces structured JSON output in console

### Button shadow regression fix
- [ ] With `show_button_shadow: true` (or absent), filled button has shadow on high-DPI displays
- [ ] With `show_button_shadow: false`, filled button has no shadow on high-DPI displays

### CC button independence
- [ ] CC button renders regardless of `show_cc_button` value in agent config
- [ ] CC button inactive: gray `#6b7280`
- [ ] CC button active (CC on): blue `#3b82f6` with white icon — not tied to primary color
- [ ] White primary color agent: CC active state is clearly visible (blue, not white)

### Sound wave visibility
- [ ] White/light primary color in light mode: idle bars visible as `#d1d5db` neutral gray
- [ ] Normal primary color in light mode: idle bars visible, active bars use primary color
- [ ] Dark primary color in dark mode: active bars blended lighter, idle bars visible as `#4b5563`
- [ ] Dynamic dark/light mode switch: idle bar color updates via CSS media query

---

## After Implementation

Once the dev file is updated:

1. A human developer will review the diff
2. The dev file will be copied to a new staging versioned file (e.g. `public/voice-chat-component-v090-stg.js`)
3. **Verify `apiBaseUrl`** is set to `https://z-server-stg.uc.r.appspot.com/api` for staging
4. After staging validation, it will be copied to a production versioned file (`public/voice-chat-component-v090.js`)
5. **Verify `apiBaseUrl`** is set to `https://z-server-prod.uc.r.appspot.com/api` for production
6. `public/index.html` will be updated to list the new version
7. Firebase deployment will be triggered
