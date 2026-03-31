# Voice Chat Component v0.8.0 — QA Test Plan

**CDN URL under test**: `https://mf-cdn.web.app/voice-chat-component-v080-stg.js`

---

## What Changed in v0.8.0

### Bug Fix: Button text color in dark mode (MPR-180)

The dark mode CSS media query was overriding the agent's configured `text_color` on the start button, forcing it to white. A new `--button-text-color` CSS variable is now used for the button, which dark mode does not override.

### Bug Fix: Modal text white-on-white in light mode

The `--text-color` CSS variable was set to the agent's configured button text color (e.g. `#ffffff`), causing white modal text on a white background. Now hardcoded to `#1f2937` for light mode. Dark mode continues to override to white.

### Feature: Configurable button shadow

New `show_button_shadow` theme property (boolean, default `true`). When `false`, removes box-shadow from the filled button in all states (base, hover, high-DPI). Outline and soft styles are unaffected.

### Feature: Button size and style customization (MPR-181)

Two new agent theme properties control the start button appearance:

| Property | Values | Default |
|----------|--------|---------|
| `button_size` | `"small"`, `"medium"`, `"large"` | `"medium"` |
| `button_style` | `"filled"`, `"outline"`, `"soft"` | `"filled"` |

### Feature: Closed captions (MPR-179)

A CC toggle button in the modal reveals a caption bar at the bottom of the viewport. Agent captions are revealed word-by-word at spoken pace, synced to audio playback. User captions appear immediately. Controlled by `show_cc_button` in the agent config (default `false`).

### Bug Fix: CC active color and wave visibility

The CC button active state is no longer tied to the agent primary color, and the sound-wave bars now remain visible for very light or very dark brand colors in both light and dark mode.

---

## Test Environment Setup

To test, create an HTML page that loads the v0.8.0 staging component:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>v0.8.0 QA Test</title>
</head>
<body>
  <voice-chat-component
    data-agent-id="YOUR_AGENT_ID"
    data-account-id="YOUR_ACCOUNT_ID">
  </voice-chat-component>

  <script type="module">
    import 'https://mf-cdn.web.app/voice-chat-component-v080-stg.js';
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

### TC-1: Button text color preserved in dark mode (MPR-180)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with a non-white `text_color` (e.g. `#1a1a2e`) | Agent config loads with the custom color |
| 2 | Open the test page in a browser set to **light mode** | Start button text matches the configured `text_color` |
| 3 | Switch the browser/OS to **dark mode** | Start button text color remains the configured `text_color` — it does NOT turn white |
| 4 | Verify the modal text (agent name, status) turns white in dark mode | Modal text adapts to dark mode as expected |

**Result**: Pass / Fail

---

### TC-1b: Modal text readable in light mode

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Configure an agent with a white `text_color` (`#ffffff`) | Agent config loads |
| 2 | Open the test page in **light mode** | Modal agent name and status text are dark (`#1f2937`) on white background — NOT white-on-white |
| 3 | Switch to **dark mode** | Modal text turns white (`#f9fafb`) on dark background — still readable |

**Result**: Pass / Fail

---

### TC-1c: Button shadow — enabled (default)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `show_button_shadow: true` (or leave unset) in agent theme | Agent config loads |
| 2 | Inspect the filled-style start button | Box-shadow is visible |
| 3 | Hover over the button | Enhanced shadow is visible |
| 4 | Test on a high-DPI display (Retina) or emulate one in DevTools | High-DPI shadow is visible |

**Result**: Pass / Fail

---

### TC-1d: Button shadow — disabled

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `show_button_shadow: false` in agent theme | Agent config loads |
| 2 | Inspect the filled-style start button | `box-shadow: none` — no shadow visible |
| 3 | Hover over the button | Still no shadow |
| 4 | Test on a high-DPI display or emulate one | Still no shadow (high-DPI media query respects the setting) |
| 5 | Switch to outline or soft button style | Shadow behavior is unaffected (these styles never have shadows) |

**Result**: Pass / Fail

---

### TC-2: Button size — small

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set agent theme `button_size: "small"` | No errors |
| 2 | Inspect the start button | Min-height ~36px, font-size 12px, compact padding |
| 3 | If avatar is shown, verify avatar size | Avatar is ~24x24px |
| 4 | Resize browser to mobile widths (480px, 320px) | Button retains its small sizing — responsive overrides do NOT apply |

**Result**: Pass / Fail

---

### TC-3: Button size — medium (default)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Do NOT set `button_size` or set it to `"medium"` | Button renders same as v0.7.0 (44px min-height, 14px font) |
| 2 | Resize browser to 768px | Responsive overrides apply (padding/font adjust) |
| 3 | Resize to 480px | Further responsive adjustments apply |
| 4 | Resize to 320px | Smallest responsive adjustments apply |

**Result**: Pass / Fail

---

### TC-4: Button size — large

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set agent theme `button_size: "large"` | No errors |
| 2 | Inspect the start button | Min-height ~52px, font-size 16px, generous padding |
| 3 | If avatar is shown, verify avatar size | Avatar is ~40x40px |
| 4 | Resize browser to mobile widths | Button retains its large sizing — responsive overrides do NOT apply |

**Result**: Pass / Fail

---

### TC-5: Button style — filled (default)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Do NOT set `button_style` or set it to `"filled"` | Button has solid background with primary color, same as v0.7.0 |
| 2 | Hover over the button | Button lifts (translateY) with enhanced shadow |

**Result**: Pass / Fail

---

### TC-6: Button style — outline

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set agent theme `button_style: "outline"` | Button has transparent background, 2px colored border, text matches border color |
| 2 | Hover over the button | Button fills with the primary color, text changes to `button-text-color` |
| 3 | Verify no box-shadow in default state | Shadow only appears on hover |

**Result**: Pass / Fail

---

### TC-7: Button style — soft

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set agent theme `button_style: "soft"` | Button has a subtle tinted background (15% of primary color), text matches primary color |
| 2 | Hover over the button | Tint intensifies to ~25% |
| 3 | Verify no box-shadow | No shadow in either state |

**Result**: Pass / Fail

---

### TC-8: Button size + style combinations

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `button_size: "small"` and `button_style: "outline"` | Small outlined button renders correctly |
| 2 | Set `button_size: "large"` and `button_style: "soft"` | Large soft button renders correctly |
| 3 | Set unrecognized values: `button_size: "huge"`, `button_style: "neon"` | Falls back to medium/filled defaults — no errors, no broken styles |

**Result**: Pass / Fail

---

### TC-9: CC button visibility

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `show_cc_button: true` in agent config | CC button appears in the modal controls toolbar (between mute and stop) |
| 2 | Set `show_cc_button: false` or do not set it | CC button is NOT rendered in the modal |
| 3 | Inspect the CC button | Has `aria-label="Toggle closed captions"`, `aria-pressed="false"`, SVG icon with "CC" text |

**Result**: Pass / Fail

---

### TC-10: CC toggle on/off

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Start a conversation with CC button visible | CC button shows with label "CC" |
| 2 | Click the CC button | Caption bar appears at the bottom of the viewport. Button turns blue (`#3b82f6`) with white icon/text, label changes to "CC On", and `aria-pressed` becomes `"true"` |
| 3 | Click the CC button again | Caption bar disappears. Button returns to default gray. Label changes back to "CC". `aria-pressed` becomes `"false"` |
| 4 | Toggle CC on via keyboard (Tab to button, press Enter or Space) | Same behavior as mouse click |

**Result**: Pass / Fail

---

### TC-10b: CC active state visible with light primary color

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Use an agent with `primary_color: "#ffffff"` or another very light color | Agent config loads |
| 2 | Open the voice modal and enable CC | CC button turns blue (`#3b82f6`) with white icon/text and remains clearly visible |
| 3 | Disable CC | Button returns to default gray inactive state |

**Result**: Pass / Fail

---

### TC-11: CC caption bar appearance

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC and trigger a conversation | Caption bar appears fixed at the bottom of the viewport |
| 2 | Verify the caption bar is OUTSIDE the modal | It should be visible even if the modal is scrolled or repositioned. Inspect DOM — the container is on `document.body`, not inside shadow DOM |
| 3 | Verify styling | Semi-transparent dark background (not pitch black), white text, adequate padding around text, max-height ~140px with scroll |
| 4 | Verify z-index | Caption bar renders above the modal overlay (z-index 10001 vs 10000) |

**Result**: Pass / Fail

---

### TC-12: User captions appear immediately

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC and start a conversation | Caption bar visible |
| 2 | Speak to the agent | After you finish speaking, your caption appears in the bar prefixed with "You:" |
| 3 | Verify timing | Your caption appears shortly after you stop speaking (when transcription completes) — no artificial delay |

**Result**: Pass / Fail

---

### TC-13: Agent captions — word-by-word reveal at spoken pace

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC and start a conversation | Wait for the agent to respond |
| 2 | Observe the agent's caption line | Text appears word-by-word, roughly matching the pace of the agent's speech |
| 3 | Verify no "spoiler" effect | You should NOT see the agent's full response text before hearing it |
| 4 | Verify text starts when audio starts | Caption words should begin appearing only when you hear the agent start speaking, not before |
| 5 | Let the agent finish a long response | All words should be revealed by the time the agent stops speaking. Any remaining words flush when audio ends |

**Result**: Pass / Fail

---

### TC-14: Agent captions — interruption (barge-in)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC, start a conversation, and let the agent begin a long response | Agent caption words are appearing gradually |
| 2 | Interrupt the agent by speaking over it | Agent audio stops. Your caption appears below the agent's partial caption |
| 3 | Verify the agent's partial caption | Whatever the agent said before you interrupted should remain visible — it should NOT disappear |
| 4 | Verify conversation continues | The agent responds to your interruption. New captions appear in correct order |

**Result**: Pass / Fail

---

### TC-15: CC caption ordering

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC and have a multi-turn conversation | Multiple You/Agent caption lines appear |
| 2 | Verify ordering | Captions appear in conversational order: each "You:" line appears BEFORE the agent's response to it. No interleaving or out-of-order lines |
| 3 | Have several rapid back-and-forth exchanges | Order remains consistent throughout |

**Result**: Pass / Fail

---

### TC-16: CC auto-scroll

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC and have a long conversation | Caption bar fills with multiple lines |
| 2 | Observe as new captions arrive | Caption bar automatically scrolls to show the latest caption at the bottom |

**Result**: Pass / Fail

---

### TC-17: CC cleanup on stop

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC, start a conversation, see some captions | CC button highlighted, caption bar visible |
| 2 | Click the Stop button | Modal closes. Caption bar is removed from the page. CC button returns to default (unhighlighted) state |
| 3 | Start a new conversation | CC button shows as OFF (label "CC", not highlighted). No leftover caption bar from previous session |
| 4 | Click CC to enable again | Fresh caption bar appears. New captions start from scratch |

**Result**: Pass / Fail

---

### TC-18: CC cleanup on ESC key

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC, start a conversation | Caption bar visible |
| 2 | Press Escape to close the modal | Same cleanup behavior as TC-17: caption bar removed, CC button reset |

**Result**: Pass / Fail

---

### TC-19: CC punctuation spacing

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Enable CC and have a conversation where the agent uses punctuation (commas, periods, exclamation marks, quotes) | Punctuation should attach to the preceding word with no extra space (e.g. "Hello, how are you?" not "Hello , how are you ?") |

**Result**: Pass / Fail

---

### TC-19b: Sound wave visibility with extreme primary colors

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Use an agent with `primary_color: "#ffffff"` in light mode | Idle wave bars are visible as neutral gray, not invisible white |
| 2 | Start a conversation | Active bars remain visible and appear darker than pure white |
| 3 | Use an agent with a very dark primary color (for example `#0a0a0a`) in dark mode | Idle bars are visible against the dark modal |
| 4 | Start a conversation in dark mode | Active bars remain visible and appear lighter than the raw dark primary |

**Result**: Pass / Fail

---

### TC-20: Regression — v0.7.0 features still work

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Start a conversation | Modal opens, "Connecting..." shown, then "Connected" with green dot |
| 2 | Speak to the agent | Agent responds with audio; sound wave animation activates |
| 3 | Click Mute, then Unmute | Mute state toggles correctly |
| 4 | Click Stop | Conversation ends, modal closes |
| 5 | Set `data` and `history` properties | Agent uses both in conversation |
| 6 | Listen for events: `session.created`, `output_audio_buffer.started/stopped`, `response.output_audio_transcript.done`, `conversation.item.input_audio_transcription.completed`, `voice.conversation.ended` | All events fire with expected payloads |
| 7 | Press Escape while modal is open | Modal closes, conversation ends |

**Result**: Pass / Fail

---

### TC-21: CDN dashboard updated

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Visit `https://mf-cdn.web.app` | Production tab loads correctly |
| 2 | Click the "Staging" tab | Staging tab loads |
| 3 | Verify Voice Chat Component section | v0.8.0-stg is listed at the top with "Pre-release" badge |
| 4 | Click the copy button for v0.8.0-stg | URL `https://mf-cdn.web.app/voice-chat-component-v080-stg.js` is copied to clipboard |
| 5 | Verify older versions still listed | v0.7.0, v0.6.0-stg, etc. all present with correct URLs |

**Result**: Pass / Fail

---

## Summary Checklist

| Test Case | Feature | Priority | Result |
|-----------|---------|----------|--------|
| TC-1 | Dark mode button text fix (MPR-180) | High | |
| TC-1b | Modal text readable in light mode | High | |
| TC-1c | Button shadow — enabled (default) | Medium | |
| TC-1d | Button shadow — disabled | High | |
| TC-2 | Button size — small | Medium | |
| TC-3 | Button size — medium (default) | High | |
| TC-4 | Button size — large | Medium | |
| TC-5 | Button style — filled (default) | High | |
| TC-6 | Button style — outline | Medium | |
| TC-7 | Button style — soft | Medium | |
| TC-8 | Button size + style combinations | Medium | |
| TC-9 | CC button visibility | High | |
| TC-10 | CC toggle on/off | High | |
| TC-10b | CC active state visible with light primary color | Medium | |
| TC-11 | CC caption bar appearance | Medium | |
| TC-12 | User captions — immediate | High | |
| TC-13 | Agent captions — word-by-word reveal | High | |
| TC-14 | Agent captions — interruption | High | |
| TC-15 | CC caption ordering | High | |
| TC-16 | CC auto-scroll | Medium | |
| TC-17 | CC cleanup on stop | High | |
| TC-18 | CC cleanup on ESC | Medium | |
| TC-19 | CC punctuation spacing | Low | |
| TC-19b | Sound wave visibility with extreme primary colors | High | |
| TC-20 | Regression — v0.7.0 features | High | |
| TC-21 | CDN dashboard updated | Low | |
