# Voice Chat Component v0.7.0 — QA Test Plan

**CDN URL under test**: `https://mf-cdn.web.app/voice-chat-component-v070-stg.js`

---

## What Changed in v0.7.0

### Feature 1: `visitorInfo` renamed to `data`

The property used to pass contextual information to the AI agent has been renamed from `visitorInfo` to `data`. This is a **breaking change** for any page that was using `visitorInfo` on the staging component.

| | Before (v0.6.0) | After (v0.7.0) |
|---|---|---|
| **Property name** | `visitorInfo` | `data` |
| **Default value** | `{}` | `{}` |
| **What it does** | Injected visitor details into the agent's system prompt | Same — injects contextual data into the agent's system prompt |
| **Prompt text** | "You are assisting a person with the following information: ..." | "Here is some additional context for this conversation: ..." |

**Why**: The old name implied the data was always about a person visiting a landing page. In practice, developers pass all kinds of context (real estate listings, product details, account info, etc.). The new name `data` is shorter, neutral, and easier to type.

### Feature 2: New `history` property

A new optional property that lets you pass the transcript of previous conversations to the AI agent. When set, the agent receives prior session context in its system prompt and can personalize responses accordingly.

| Attribute | Detail |
|---|---|
| **Property name** | `history` |
| **Type** | `Object` or `Array` (JSON-serializable) |
| **Default value** | `null` |
| **Required** | No — fully optional |
| **What it does** | When set, appends previous conversation transcripts to the agent's system prompt |
| **Prompt text** | "The following is the transcript of previous conversations you have had with this person. Use it to personalize your responses and avoid repeating yourself: ..." |

---

## Test Environment Setup

To test, create an HTML page that loads the v0.7.0 staging component:

```html
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <title>v0.7.0 QA Test</title>
</head>
<body>
  <voice-chat-component
    data-agent-id="YOUR_AGENT_ID"
    data-account-id="YOUR_ACCOUNT_ID">
  </voice-chat-component>

  <script src="https://mf-cdn.web.app/voice-chat-component-v070-stg.js" type="module"></script>

  <script>
    const vc = document.querySelector('voice-chat-component');

    // Set data (replaces old visitorInfo)
    vc.data = {
      name: "Jane Smith",
      email: "jane@example.com",
      propertyAddress: "456 Oak Ave, Austin TX"
    };

    // Set history (new in v0.7.0)
    vc.history = [
      {
        date: "2025-12-10",
        summary: "Jane asked about 3-bedroom homes in Austin under $500k. She was interested in properties near good schools."
      },
      {
        date: "2026-01-20",
        summary: "Follow-up call. Jane narrowed her search to the 78745 zip code. Wanted to schedule a showing for 456 Oak Ave."
      }
    ];
  </script>
</body>
</html>
```

---

## Test Cases

### TC-1: Component loads and renders correctly

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Open the test page | The Voice Chat button renders (with agent name and avatar if configured) |
| 2 | Inspect the browser console | No errors or warnings on page load |

**Result**: Pass / Fail

---

### TC-2: `data` property — basic functionality

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Before clicking the button, run in console: `document.querySelector('voice-chat-component').data` | Returns the object you set: `{ name: "Jane Smith", email: "jane@example.com", propertyAddress: "456 Oak Ave, Austin TX" }` |
| 2 | Click the Voice Chat button to start a conversation | Modal opens, connection established |
| 3 | Wait for the agent's greeting | Agent should reference or be aware of the context from `data` (e.g. may greet by name, mention the property address) |
| 4 | Ask the agent: "What do you know about me?" | Agent should reference information from the `data` object |

**Result**: Pass / Fail

---

### TC-3: `data` property — agent uses neutral prompt framing

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `data` to non-person context, e.g.: `vc.data = { listingId: "MLS-12345", price: "$475,000", bedrooms: 3, address: "456 Oak Ave" }` | No errors |
| 2 | Start a conversation and ask "What property are we discussing?" | The agent should reference the listing details naturally. It should NOT say "you are a person with the following information" or treat the data as visitor identity |

**Result**: Pass / Fail

---

### TC-4: `data` property — empty/not set

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Do NOT set the `data` property at all | `vc.data` returns `{}` |
| 2 | Start a conversation | Agent works normally without any contextual data in its prompt. No errors in console |

**Result**: Pass / Fail

---

### TC-5: `data` property — invalid input handling

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | `vc.data = "hello"` | Console shows warning: `Failed to set data: value must be an object. Received type: string` |
| 2 | `vc.data` | Returns `{}` (reset to default) |
| 3 | `vc.data = 42` | Console shows warning with type `number` |
| 4 | `vc.data` | Returns `{}` |
| 5 | `vc.data = null` | No warning |
| 6 | `vc.data` | Returns `{}` |
| 7 | `vc.data = { key: "value" }` then `vc.data = undefined` | After setting undefined, `vc.data` returns `{}` |

**Result**: Pass / Fail

---

### TC-6: `visitorInfo` no longer exists (breaking change)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | `vc.visitorInfo` | Returns `undefined` |
| 2 | `vc.visitorInfo = { name: "test" }` | Sets a plain JS property (not the validated setter). This data will NOT be injected into the agent prompt |
| 3 | Start a conversation and ask "What do you know about me?" | Agent has NO awareness of the `visitorInfo` data. Only `data` works now |

**Result**: Pass / Fail

---

### TC-7: `history` property — basic functionality

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `history` as shown in the setup example | `vc.history` returns the array of conversation objects |
| 2 | Start a conversation | Agent should be aware of prior conversations |
| 3 | Ask the agent: "What have we discussed before?" | Agent should reference the history — e.g. mentioning 3-bedroom homes, Austin, 78745 zip code, or the showing at 456 Oak Ave |
| 4 | Ask a follow-up like "Did I mention a budget?" | Agent should recall "$500k" from the history context |

**Result**: Pass / Fail

---

### TC-8: `history` property — agent does not repeat itself

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set `history` with a summary that the agent already provided a recommendation | No errors |
| 2 | Start a conversation | Agent should NOT re-introduce itself as if it's a first conversation. It should acknowledge the ongoing relationship |
| 3 | Ask: "Can you remind me of your recommendation?" | Agent should reference the prior conversation rather than starting from scratch |

**Result**: Pass / Fail

---

### TC-9: `history` property — not set (optional)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Do NOT set the `history` property | `vc.history` returns `null` |
| 2 | Start a conversation | Agent works normally as a first-time conversation. No errors in console. No mention of previous conversations |

**Result**: Pass / Fail

---

### TC-10: `history` property — invalid input handling

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | `vc.history = "hello"` | Console shows warning: `Failed to set history: value must be an object or array. Received type: string` |
| 2 | `vc.history` | Returns `null` |
| 3 | `vc.history = 42` | Console shows warning with type `number` |
| 4 | `vc.history` | Returns `null` |
| 5 | `vc.history = null` | No warning |
| 6 | `vc.history` | Returns `null` |
| 7 | `vc.history = { summary: "single object" }` | No warning — objects are accepted |
| 8 | `vc.history` | Returns `{ summary: "single object" }` |

**Result**: Pass / Fail

---

### TC-11: `data` and `history` together

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Set both `data` and `history` as shown in the setup example | Both properties return their values |
| 2 | Start a conversation | Agent is aware of BOTH the contextual data AND the conversation history |
| 3 | Ask: "Who am I and what did we talk about last time?" | Agent should reference the name/email from `data` AND the prior conversations from `history` |
| 4 | Verify the agent's tone | Agent should speak as if continuing an ongoing relationship, not meeting someone for the first time |

**Result**: Pass / Fail

---

### TC-12: Properties set before component upgrade

This tests that properties set on the HTML element before the JS module finishes loading are correctly picked up.

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Create a page where `data` and `history` are set in an inline `<script>` ABOVE the `<script src="...v070-stg.js">` tag | No errors on page load |
| 2 | After page loads, check `vc.data` and `vc.history` | Both return the values that were set before the component upgraded |
| 3 | Start a conversation | Agent is aware of both the data and history |

**Result**: Pass / Fail

---

### TC-13: Existing v0.6.0 features still work (regression)

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Start a conversation | Modal opens, "Connecting..." shown, then "Connected" with green dot |
| 2 | Speak to the agent | Agent responds with audio; sound wave animation activates while agent speaks |
| 3 | Click the Mute button | Button changes to muted state; agent cannot hear you |
| 4 | Click Mute again | Unmuted; agent can hear you again |
| 5 | Click the Stop button | Conversation ends, modal closes |
| 6 | Listen for `voice.conversation.ended` event (add `addEventListener` in test page) | Event fires with `trigger`, `timestamp`, `transcript`, and `durationMs`/`durationSeconds` |
| 7 | Press Escape while modal is open | Modal closes, conversation ends |
| 8 | Check all other events fire: `session.created`, `output_audio_buffer.started/stopped`, `response.output_audio_transcript.done`, `conversation.item.input_audio_transcription.completed` | All events emit correctly with expected `detail` payloads |

**Result**: Pass / Fail

---

### TC-14: CDN dashboard updated

| # | Step | Expected Result |
|---|------|-----------------|
| 1 | Visit `https://mf-cdn.web.app` | Production tab loads correctly |
| 2 | Click the "Staging" tab | Staging tab loads |
| 3 | Verify Voice Chat Component section | v0.7.0-stg is listed at the top with "Pre-release" badge |
| 4 | Click the copy button for v0.7.0-stg | URL `https://mf-cdn.web.app/voice-chat-component-v070-stg.js` is copied to clipboard |
| 5 | Verify older versions still listed | v0.6.0-stg, v0.5.0-stg, v0.4.0-stg all present with correct URLs |
| 6 | Verify footer | Shows "© 2026 MindFire. All rights reserved." |

**Result**: Pass / Fail

---

## Summary Checklist

| Test Case | Feature | Priority | Result |
|-----------|---------|----------|--------|
| TC-1 | Component loads | High | |
| TC-2 | `data` — basic functionality | High | |
| TC-3 | `data` — neutral prompt framing | Medium | |
| TC-4 | `data` — empty/not set | High | |
| TC-5 | `data` — invalid input handling | Medium | |
| TC-6 | `visitorInfo` removed | High | |
| TC-7 | `history` — basic functionality | High | |
| TC-8 | `history` — no repetition | Medium | |
| TC-9 | `history` — not set | High | |
| TC-10 | `history` — invalid input handling | Medium | |
| TC-11 | `data` + `history` together | High | |
| TC-12 | Pre-upgrade property setting | Medium | |
| TC-13 | Regression — v0.6.0 features | High | |
| TC-14 | CDN dashboard updated | Low | |
