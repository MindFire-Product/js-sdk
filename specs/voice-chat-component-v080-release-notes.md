# Voice Chat Component v0.8.0 — Release Notes

**Release date**: March 2026
**CDN (staging)**: `https://mf-cdn.web.app/voice-chat-component-v080-stg.js`

---

## Bug Fixes

### Button text color in dark mode (MPR-180)

The dark mode CSS media query was overriding the agent's configured text color on the start button, forcing it to white regardless of branding. The button now uses a dedicated `--button-text-color` CSS variable that dark mode does not touch, preserving the agent's intended button text color in all color schemes.

### Modal text white-on-white in light mode

The `--text-color` CSS variable (used for the modal agent name and status text) was set to the agent's configured button text color (e.g. `#ffffff`), causing white text on a white modal background. This is now hardcoded to a dark gray (`#1f2937`) for light mode. Dark mode continues to override it to white as expected.

### CC button active-state color

The CC button's active state previously used `var(--primary-color)` as its background. For agents with a white or very light primary color, toggling CC on could make the button effectively disappear. The active state now uses a fixed blue (`#3b82f6`) with a white icon, so the enabled state remains visible regardless of brand color.

### Sound wave visibility in light and dark mode

Wave bars were previously tied directly to `primary_color`, which could make them disappear against the modal background. This was especially noticeable with white/light primaries in light mode and very dark primaries in dark mode.

**What changed:**
- **Idle bars** now use a neutral color instead of a faded primary color: `#d1d5db` in light mode and `#4b5563` in dark mode
- **Active bars** now pass through `_getWaveColor()`, which adjusts only extreme light/dark colors so the speaking state stays visible against the modal background
- The old idle-bar `opacity: 0.4` was removed to avoid washing out the bars

---

## New Features

### Configurable button shadow

A new `show_button_shadow` theme property (boolean, default `true`) controls whether the filled-style button displays a box-shadow. When set to `false` in the admin UI, the shadow is removed in all states (default, hover, and high-DPI). Outline and soft button styles are unaffected (they never have shadows).

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

**Visual behavior:**
- CC active state uses a fixed accessible blue instead of the agent primary color
- Idle and active wave bars remain visible even when the agent primary color is very light or very dark

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
