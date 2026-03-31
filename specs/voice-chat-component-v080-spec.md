# Voice Chat Component v0.8.0 — Feature Spec

**Target file to edit**: `voice-chat-component-v080-dev.js` (root of repo — copy from `voice-chat-component-v070-dev.js` before starting)
**OpenAI SDK version**: `@openai/agents-realtime@0.7.2`

> **IMPORTANT**: Only `-dev.js` files may be edited by agents. Never edit versioned files (e.g. `public/voice-chat-component-v070.js`) directly.

**Jira references**: MPR-180 (button color bug), MPR-181 (button customization), MPR-179 (closed captions)

---

## Overview

Five changes are being made to the Voice Chat Component:

1. **Bug fix: Button text color in dark mode** (MPR-180) — The dark mode CSS media query overrides the agent's configured text color to white, breaking button branding on dark-mode browsers. Fix by introducing an isolated CSS variable for button text.

2. **Button customization options** (MPR-181) — Add `button_size` and `button_style` theme properties so clients can control how the start button fits into their landing pages. Also ensure existing theme properties (`border_radius`, `font_family`) are documented for admin UI exposure.

3. **Closed captions / accessibility** (MPR-179) — Add a CC toggle button to the modal and render a YouTube-style caption bar at the bottom of the viewport. Agent captions are delayed until audio playback finishes to avoid spoiling the response.

4. **Bug fix: CC active-state visibility** — The CC button active state must stay visible even when the agent primary color is white or very light. Use a fixed semantic active color instead of `primary_color`.

5. **Bug fix: Sound wave visibility** — Idle and active wave bars must remain visible in both light and dark mode, even when the agent primary color is extremely light or dark.

---

## Feature 1: Fix button text color in dark mode (MPR-180)

### Problem

The dark mode media query at the bottom of the component CSS blanket-overrides `--text-color` to `#f9fafb` (white), which stomps on the agent's configured `theme.text_color`. This causes the button text to turn white in dark-mode browsers regardless of the agent's intended branding.

### Solution

Introduce a dedicated `--button-text-color` CSS variable that the dark mode block does not touch.

### Changes

#### 1. Add `--button-text-color` to the `:host` CSS variable block

In the `render()` method, inside the `:host { ... }` block, add:

```css
--button-text-color: ${this.agentConfig.theme.text_color};
```

#### 2. Update `.start-button` to use the new variable

Find:
```css
.start-button {
    /* ... */
    color: var(--text-color);
```

Replace:
```css
.start-button {
    /* ... */
    color: var(--button-text-color);
```

#### 3. Do NOT add `--button-text-color` to the dark mode block

The existing dark mode block should remain unchanged:
```css
@media (prefers-color-scheme: dark) {
    :host {
        --modal-bg-color: #1f2937;
        --text-color: #f9fafb;
        --secondary-text-color: #d1d5db;
    }
}
```

`--button-text-color` is intentionally absent here — dark mode adapts the modal text but never overrides the branded button text.

---

## Feature 1b: Fix modal text white-on-white in light mode

### Problem

The `--text-color` CSS variable was set to the agent's configured `theme.text_color` (e.g. `#ffffff` for white button text), but this variable was also used for the modal agent name and other modal text. This caused white text on a white modal background in light mode.

### Solution

Hardcode `--text-color` to `#1f2937` (dark gray) in the `:host` CSS variable block. The dark mode `@media (prefers-color-scheme: dark)` block already overrides `--text-color` to `#f9fafb`, so no change is needed there. The button uses `--button-text-color` (from Feature 1) separately.

### Changes

In the `:host` CSS variables block inside `render()`:

```diff
- --text-color: ${this.agentConfig.theme.text_color};
+ --text-color: #1f2937;
```

---

## Feature 1c: Configurable button shadow (`show_button_shadow`)

### Motivation

The filled-style button always had a hardcoded box-shadow. Clients need the ability to disable the shadow via the admin UI when it doesn't fit their page design.

### New theme property

| Property | Type | Default | Purpose |
|----------|------|---------|---------|
| `show_button_shadow` | boolean | `true` | Controls whether the filled-style button has a box-shadow |

### Changes

#### 1. Make base shadow conditional in `.start-button`

```diff
- box-shadow: 0 4px 20px rgba(0,123,255,0.3);
+ box-shadow: ${this.agentConfig.theme.show_button_shadow !== false ? '0 4px 20px rgba(0,123,255,0.3)' : 'none'};
```

#### 2. Make hover shadow conditional in `.start-button:hover:not(.loading)`

```diff
- box-shadow: 0 6px 25px rgba(0,123,255,0.4);
+ box-shadow: ${this.agentConfig.theme.show_button_shadow !== false ? '0 6px 25px rgba(0,123,255,0.4)' : 'none'};
```

#### 3. Make high-DPI shadows conditional

The `@media (-webkit-min-device-pixel-ratio: 2), (min-resolution: 192dpi)` block also hardcodes shadows that override the base styles. Both must be made conditional:

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

> **Note:** The outline and soft button styles already set `box-shadow: none` and are unaffected by this setting.

---

## Feature 2: Button customization options (MPR-181)

### Motivation

The start button currently only supports background color and text color configuration. Clients often need the button to match the visual weight and style of other CTAs on their landing pages.

### New theme properties

| Property | Values | Default | Purpose |
|----------|--------|---------|---------|
| `button_size` | `"small"`, `"medium"`, `"large"` | `"medium"` | Controls padding, font-size, avatar size, and min-height |
| `button_style` | `"filled"`, `"outline"`, `"soft"` | `"filled"` | Controls background treatment |

### Changes

#### 1. Add size presets as CSS in `render()`

Add the following CSS rules after the existing `.start-button` block:

```css
/* Button size presets */
.start-button.size-small {
    padding: 8px 14px;
    font-size: 12px;
    min-height: 36px;
    gap: 8px;
}

.start-button.size-small .avatar {
    width: 24px;
    height: 24px;
}

.start-button.size-medium {
    padding: 12px 20px;
    font-size: 14px;
    min-height: 44px;
    gap: 12px;
}

.start-button.size-medium .avatar {
    width: 32px;
    height: 32px;
}

.start-button.size-large {
    padding: 16px 28px;
    font-size: 16px;
    min-height: 52px;
    gap: 14px;
}

.start-button.size-large .avatar {
    width: 40px;
    height: 40px;
}
```

#### 2. Add style presets as CSS in `render()`

Add the following CSS rules after the size presets:

```css
/* Button style presets */
.start-button.style-outline {
    background: transparent;
    border: 2px solid var(--button-bg-color);
    color: var(--button-bg-color);
    box-shadow: none;
}

.start-button.style-outline:hover:not(.loading) {
    background: var(--button-bg-color);
    color: var(--button-text-color);
    transform: translateY(-2px);
    box-shadow: 0 6px 25px rgba(0,123,255,0.4);
}

.start-button.style-soft {
    background: color-mix(in srgb, var(--button-bg-color) 15%, transparent);
    color: var(--button-bg-color);
    box-shadow: none;
}

.start-button.style-soft:hover:not(.loading) {
    background: color-mix(in srgb, var(--button-bg-color) 25%, transparent);
    transform: translateY(-2px);
}
```

> **Note:** `color-mix()` is supported in all modern browsers (Chrome 111+, Firefox 113+, Safari 16.2+). For the target audience of this SDK this is acceptable. If broader support is needed in the future, a fallback using opacity can be added.

#### 3. Apply classes to the start button element

In the `render()` method, update the `<button>` element to include size and style classes:

Find:
```html
<button
    class="start-button"
    id="start-button"
```

Replace with (using template literal logic):
```html
<button
    class="start-button size-${this.agentConfig.theme.button_size || 'medium'} style-${this.agentConfig.theme.button_style || 'filled'}"
    id="start-button"
```

#### 4. Update responsive breakpoints

The existing responsive breakpoints hardcode padding and font-size values for `.start-button`. These should be updated to only override when the size class is `size-medium` (the default), or removed in favor of letting the size presets handle it. The simplest approach:

In each `@media` breakpoint that targets `.start-button`, scope the overrides to `.start-button.size-medium` so that explicit `small` or `large` choices are respected:

```css
@media (max-width: 768px) {
    .start-button.size-medium {
        font-size: 14px;
        padding: 14px 20px;
        gap: 8px;
    }
}

@media (max-width: 480px) {
    .start-button.size-medium {
        font-size: 13px;
        padding: 12px 16px;
        gap: 6px;
    }
}

@media (max-width: 320px) {
    .start-button.size-medium {
        font-size: 12px;
        padding: 10px 14px;
    }
}
```

---

## Feature 3: Closed captions (MPR-179)

### Motivation

Accessibility for hearing-impaired users. The component already captures full conversation transcripts internally (`this.conversationTranscript`), so this is a UI-only feature.

### Design decisions

- **Placement**: YouTube-style caption bar fixed at the bottom of the viewport, **outside** the Shadow DOM (appended to `document.body`). This avoids crowding the modal and works well on mobile.
- **Visibility**: Hidden by default. A [CC] toggle button in the modal controls shows/hides the caption bar.
- **Agent config**: New boolean `show_cc_button` (default `false`). When `false`, the CC button is not rendered at all.
- **Transcript timing**: User captions appear in real-time (their transcription arrives after they speak). Agent captions are **buffered and only revealed after `output_audio_buffer.stopped` fires** — this prevents showing text before the audio finishes, avoiding a spoiler effect.

### Changes

#### 1. Add state properties in `_initializeState()`

Add after existing state properties:

```javascript
// Closed captions state
this.ccEnabled = false;
this.ccContainer = null;
this._pendingAgentCaption = null;
```

#### 2. Add CC toggle method

Add a new method:

```javascript
/**
 * Toggle closed captions visibility
 */
toggleCC() {
  this.ccEnabled = !this.ccEnabled;

  const ccBtn = this.shadowRoot?.querySelector("#cc-btn");
  const ccLabel = this.shadowRoot?.querySelector("#cc-btn-label");

  if (ccBtn) {
    ccBtn.classList.toggle("cc-active", this.ccEnabled);
    ccBtn.setAttribute("aria-pressed", this.ccEnabled.toString());
  }
  if (ccLabel) {
    ccLabel.textContent = this.ccEnabled ? "CC On" : "CC";
  }

  if (this.ccEnabled) {
    this._createCCContainer();
  } else {
    this._removeCCContainer();
  }
}
```

#### 3. Add CC container management (outside Shadow DOM)

```javascript
/**
 * Create the CC caption bar on document.body
 * @private
 */
_createCCContainer() {
  if (this.ccContainer) return;

  const container = document.createElement("div");
  container.id = "voice-chat-cc-container";
  container.setAttribute("role", "log");
  container.setAttribute("aria-live", "polite");
  container.setAttribute("aria-label", "Closed captions");
  container.style.cssText = `
    position: fixed;
    bottom: 0;
    left: 0;
    width: 100%;
    max-height: 120px;
    overflow-y: auto;
    background: rgba(0, 0, 0, 0.8);
    color: #ffffff;
    font-family: ${this.agentConfig?.theme?.font_family || '"Arial", sans-serif'};
    font-size: 16px;
    line-height: 1.5;
    padding: 12px 24px;
    z-index: 10001;
    box-sizing: border-box;
  `;
  document.body.appendChild(container);
  this.ccContainer = container;
}

/**
 * Remove the CC caption bar from document.body
 * @private
 */
_removeCCContainer() {
  if (this.ccContainer) {
    this.ccContainer.remove();
    this.ccContainer = null;
  }
}

/**
 * Append a caption line to the CC container
 * @private
 * @param {string} speaker - "You" or the agent's name
 * @param {string} text - Caption text
 */
_appendCaption(speaker, text) {
  if (!this.ccContainer || !this.ccEnabled) return;

  const line = document.createElement("div");
  line.style.cssText = "margin-bottom: 4px;";
  line.innerHTML = `<strong>${speaker}:</strong> ${text}`;
  this.ccContainer.appendChild(line);

  // Auto-scroll to bottom
  this.ccContainer.scrollTop = this.ccContainer.scrollHeight;
}
```

#### 4. Update `_setupSessionEventHandlers()` to feed captions

In the `conversation.item.input_audio_transcription.completed` case (user speech), add after the existing `_appendTranscriptEntry` call:

```javascript
// Show user caption immediately (timing is natural — transcription arrives after they speak)
const agentFirstName = this.agentConfig?.name?.split(" ")[0] || "Agent";
this._appendCaption("You", event.transcript);
```

In the `response.output_audio_transcript.done` case (agent speech), **buffer** the caption instead of showing it immediately. Replace/add after the existing `_appendTranscriptEntry` call:

```javascript
// Buffer agent caption — will be shown when audio stops
this._pendingAgentCaption = event.transcript;
```

In the `output_audio_buffer.stopped` case, add after the existing `this.toggleSoundWave(false)`:

```javascript
// Show buffered agent caption now that audio has finished
if (this._pendingAgentCaption) {
  const agentFirstName = this.agentConfig?.name?.split(" ")[0] || "Agent";
  this._appendCaption(agentFirstName, this._pendingAgentCaption);
  this._pendingAgentCaption = null;
}
```

#### 5. Add CC button to modal controls

In the `render()` method, add a CC button to the `.controls` toolbar. It should only appear when `this.agentConfig.show_cc_button` is truthy.

Add this block **before** the mute button `<div class="control-item">`:

```html
${this.agentConfig.show_cc_button ? `
<div class="control-item">
    <button
        class="control-btn cc-btn"
        id="cc-btn"
        title="Toggle closed captions"
        aria-label="Toggle closed captions"
        aria-pressed="false"
        role="button"
        tabindex="0"
    >
        <svg width="24" height="24" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
            <rect x="2" y="4" width="20" height="16" rx="3" stroke="currentColor" stroke-width="2" fill="none"/>
            <text x="7" y="15" font-size="8" font-weight="bold" fill="currentColor" font-family="Arial">CC</text>
        </svg>
    </button>
    <span class="control-label" id="cc-btn-label">CC</span>
</div>
` : ""}
```

#### 6. Add CC button CSS

Add to the component styles:

```css
.cc-btn {
    background: #6b7280;
    color: white;
}

.cc-btn:hover {
    background: #4b5563;
}

.cc-btn.cc-active {
    background: #3b82f6;
    color: white;
}
```

#### 6b. Keep wave bars visible across extreme primary colors

Add three private helpers:

```js
_parseHexColor(hex) { /* parse #rgb / #rrggbb */ }
_getLuminance(r, g, b) { /* WCAG luminance */ }
_getWaveColor(primaryColor) { /* blend only too-light / too-dark colors */ }
```

Update the `:host` CSS variable block:

```css
--sound-wave-idle-color: ${window.matchMedia("(prefers-color-scheme: dark)").matches ? "#4b5563" : "#d1d5db"};
--sound-wave-color: ${this._getWaveColor(this.agentConfig.theme.primary_color)};
--sound-wave-active-color: ${this._getWaveColor(this.agentConfig.theme.primary_color)};
```

Update `.wave-bar`:

```diff
- background: var(--sound-wave-color);
+ background: var(--sound-wave-idle-color);
  border-radius: 2px;
  height: 2px;
  transition: height 0.3s ease, background-color 0.3s ease;
- opacity: 0.4;
```

Update the dark-mode block:

```css
@media (prefers-color-scheme: dark) {
    :host {
        --modal-bg-color: #1f2937;
        --text-color: #f9fafb;
        --secondary-text-color: #d1d5db;
        --sound-wave-idle-color: #4b5563;
    }
}
```

#### 7. Register event listeners for the CC button

Add to the `listeners` array in `setupEventListeners()`:

```javascript
{ selector: "#cc-btn", event: "click", handler: this.toggleCC },
{ selector: "#cc-btn", event: "keydown", handler: this._handleButtonKeyDown },
```

Add the same entries to `_removeEventListeners()`.

#### 8. Bind `toggleCC` in `_bindMethods()`

Add:
```javascript
this.toggleCC = this.toggleCC.bind(this);
```

#### 9. Cleanup CC container on stop/disconnect

In `stopConversation()`, add before the UI reset section:

```javascript
// Remove CC container
this._removeCCContainer();
this.ccEnabled = false;
this._pendingAgentCaption = null;
```

In `cleanup()`, add:

```javascript
this._removeCCContainer();
```

---

## Validation Checklist

### Bug fix — button text color (MPR-180)
- [ ] `--button-text-color` is defined in `:host` from `theme.text_color`
- [ ] `.start-button` uses `color: var(--button-text-color)` instead of `var(--text-color)`
- [ ] `--button-text-color` does NOT appear in the dark mode `@media` block
- [ ] Button text color is preserved when testing in a dark-mode browser

### Bug fix — modal text white-on-white
- [ ] `--text-color` is hardcoded to `#1f2937` in `:host` (not derived from `theme.text_color`)
- [ ] Modal agent name is readable in light mode (dark text on white background)
- [ ] Dark mode still overrides `--text-color` to `#f9fafb`

### Button shadow (`show_button_shadow`)
- [ ] With `show_button_shadow: true` (or absent), filled button has shadow on base, hover, and high-DPI
- [ ] With `show_button_shadow: false`, filled button has no shadow in any state (base, hover, high-DPI)
- [ ] Outline and soft styles are unaffected (always no shadow)

### Button customization (MPR-181)
- [ ] `button_size` with values `small`, `medium`, `large` applies correct padding/font-size/min-height
- [ ] `button_style` with values `filled`, `outline`, `soft` renders correctly
- [ ] Missing or unrecognized values fall back to `medium` and `filled`
- [ ] Responsive breakpoints only override `size-medium` so explicit sizes are respected
- [ ] `outline` hover transitions to filled state
- [ ] `soft` background tint is visible and adapts to the primary color

### Closed captions (MPR-179)
- [ ] CC button only appears when `show_cc_button` is `true` in agent config
- [ ] CC button toggles the caption bar on/off
- [ ] CC active state uses blue `#3b82f6` with white icon/text and does not depend on `primary_color`
- [ ] Caption bar renders at the bottom of the viewport (not inside the modal)
- [ ] User captions appear immediately after the user speaks
- [ ] Agent captions appear only after the agent finishes speaking (after `output_audio_buffer.stopped`)
- [ ] Caption bar auto-scrolls to the latest entry
- [ ] Caption bar is removed when conversation stops or component disconnects
- [ ] `aria-live="polite"` is set on the caption container
- [ ] CC button has correct `aria-pressed` state

### Sound wave visibility
- [ ] Idle wave bars use neutral gray in light mode and remain visible with very light primary colors
- [ ] Idle wave bars use dark neutral gray in dark mode and remain visible with very dark primary colors
- [ ] Active wave bars remain visible in both light and dark mode for extreme primary colors
- [ ] `.wave-bar` no longer depends on reduced opacity for idle visibility

---

## After Implementation

Once the dev file is updated:

1. A human developer will review the diff
2. The dev file will be copied to a new staging versioned file (e.g. `public/voice-chat-component-v080-stg.js`)
3. After staging validation, it will be copied to a production versioned file (`public/voice-chat-component-v080.js`)
4. `public/index.html` will be updated to list the new version
5. Firebase deployment will be triggered
