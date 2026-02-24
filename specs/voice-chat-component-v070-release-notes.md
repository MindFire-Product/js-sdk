# Voice Chat Component v0.7.0 — Release Notes

**Release date**: February 24, 2026
**CDN (staging)**: `https://mf-cdn.web.app/voice-chat-component-v070-stg.js`

---

## New Features

### `data` property (replaces `visitorInfo`)

Pass any contextual information to the AI agent — visitor details, property listings, product specs, account info, or anything else relevant to the conversation.

```js
const vc = document.querySelector('voice-chat-component');
vc.data = {
  name: "Jane Smith",
  propertyAddress: "456 Oak Ave, Austin TX",
  listingPrice: "$475,000"
};
```

The agent receives this as additional context and can reference it naturally during the conversation.

### `history` property (new)

Give the agent memory across sessions by passing in transcripts of previous conversations. The agent will use this to personalize responses and avoid repeating itself.

```js
vc.history = [
  {
    date: "2025-12-10",
    summary: "Jane asked about 3-bedroom homes in Austin under $500k."
  },
  {
    date: "2026-01-20",
    summary: "Narrowed search to 78745 zip code. Wanted to schedule a showing."
  }
];
```

This property is optional. When not set, the agent behaves as a first-time conversation.

---

## Breaking Changes

### `visitorInfo` removed

The `visitorInfo` property has been replaced by `data`. Any code using `visitorInfo` must be updated:

```diff
- vc.visitorInfo = { name: "Jane", email: "jane@example.com" };
+ vc.data = { name: "Jane", email: "jane@example.com" };
```

The agent prompt text has also changed from *"You are assisting a person with the following information"* to *"Here is some additional context for this conversation"*, making it appropriate for all types of data — not just person info.

---

## Migration Guide

| Before (v0.6.0) | After (v0.7.0) |
|---|---|
| `vc.visitorInfo = { ... }` | `vc.data = { ... }` |
| Property not set | Works the same — defaults to `{}` |
| N/A | `vc.history = [...]` (new, optional) |

---

## No Other Changes

All existing functionality is unchanged:

- Voice conversation, mute/unmute, stop
- Modal UI and sound wave animation
- All custom DOM events (`session.created`, `voice.conversation.ended`, etc.)
- Knowledge base search and MCP Zapier tools
- Server-side VAD with 15-second idle timeout
- Output guardrails
