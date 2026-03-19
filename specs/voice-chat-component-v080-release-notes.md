# Voice Chat Component v0.8.0 — Release Notes

**Release date**: March 2026
**CDN (staging)**: `https://mf-cdn.web.app/voice-chat-component-v080-stg.js`

---

## Bug Fixes

### Button text color in dark mode (MPR-180)

The dark mode CSS media query was overriding the agent's configured text color on the start button, forcing it to white regardless of branding. The button now uses a dedicated `--button-text-color` CSS variable that dark mode does not touch, preserving the agent's intended button text color in all color schemes.

---

## New Features

### Button size and style customization (MPR-181)

Two new theme properties let clients control how the start button fits into their landing pages:

| Property | Values | Default | Purpose |
|----------|--------|---------|---------|
| `button_size` | `"small"`, `"medium"`, `"large"` | `"medium"` | Controls padding, font-size, avatar size, and min-height |
| `button_style` | `"filled"`, `"outline"`, `"soft"` | `"filled"` | Controls background treatment |

These are configured in the agent's theme on the server. When not set, the button renders exactly as it did in v0.7.0 (`medium` + `filled`).

**Size examples:**
- `small` — compact button (36px min-height, 12px font)
- `medium` — default (44px min-height, 14px font)
- `large` — prominent CTA (52px min-height, 16px font)

**Style examples:**
- `filled` — solid background with the primary color (default, same as v0.7.0)
- `outline` — transparent background with a colored border; fills on hover
- `soft` — subtle tinted background using the primary color at 15% opacity

### Closed captions / accessibility (MPR-179)

A new CC toggle button in the conversation modal lets users view real-time captions of the conversation. Designed for hearing-impaired users and noisy environments.

**How it works:**
- A [CC] button appears in the modal controls toolbar (between mute and stop) when `show_cc_button` is enabled in the agent config
- Toggling CC on reveals a YouTube-style caption bar fixed to the bottom of the viewport
- **User captions** appear immediately after the user speaks
- **Agent captions** are revealed word-by-word at natural speaking pace, synced with audio playback — text begins appearing only when the agent's audio starts playing
- When the user interrupts the agent (barge-in), whatever the agent said up to that point remains visible
- Captions maintain correct conversation order even when transcription events arrive out of sequence
- The caption bar and CC button state reset when the conversation ends

**Accessibility:**
- Caption container has `role="log"` and `aria-live="polite"` for screen readers
- CC button has `aria-pressed` state and `aria-label`
- All keyboard-accessible via Enter/Space

**Configuration:**
- `show_cc_button` (boolean, default `false`) — set in agent config on the server. When `false` or absent, the CC button is not rendered at all

---

## No Breaking Changes

This release is fully backward compatible with v0.7.0. All existing functionality is unchanged:

- Voice conversation, mute/unmute, stop
- Modal UI and sound wave animation
- `data` and `history` properties
- All custom DOM events (`session.created`, `voice.conversation.ended`, etc.)
- Knowledge base search and MCP Zapier tools
- Server-side VAD with 15-second idle timeout
- Output guardrails
