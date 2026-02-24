# Voice Chat Component v0.7.0 — Feature Spec

**Target file to edit**: `voice-chat-component-v060-dev.js` (root of repo)

> ⚠️ **IMPORTANT**: Only `-dev.js` files may be edited by agents. Never edit versioned files (e.g. `public/voice-chat-component-v060.js`) directly.

---

## Overview

Two new features are being added to the Voice Chat Component:

1. **Rename `visitorInfo` → `data`** — The property is being renamed to a shorter, more neutral name. Callers may pass in any kind of contextual data — not just info about the page visitor (e.g. real estate listing details, product specs, account info, etc.). The system prompt injection text must also be updated to remove assumptions about "a person."

2. **Add `history` property** — A new optional property that accepts a JSON object containing the transcript of prior conversations this AI agent has had with the user. When present, it is injected into the agent's system prompt so the agent has memory of prior sessions.

---

## Feature 1: Rename `visitorInfo` → `data`

### Motivation

The old name `visitorInfo` implied the data was always about the landing page visitor. The new name `data` is short, neutral, and easy to type.

### All locations to change in `voice-chat-component-v060-dev.js`

#### 1. JSDoc comment block (near top of file, lines ~20–28)

Find:
```javascript
 * // 3. Optionally set visitor info
 * <script>
 *   const voiceComponent = document.querySelector('voice-chat-component');
 *   voiceComponent.visitorInfo = {
 *     name: "John Doe",
 *     email: "john@example.com",
 *     phone: "1234567890"
 *   };
 * </script>
```

Replace with:
```javascript
 * // 3. Optionally set data (contextual variables for the conversation)
 * <script>
 *   const voiceComponent = document.querySelector('voice-chat-component');
 *   voiceComponent.data = {
 *     name: "John Doe",
 *     email: "john@example.com",
 *     propertyAddress: "123 Main St"
 *   };
 * </script>
```

---

#### 2. `_initializeState()` method (lines ~97–122)

Find:
```javascript
// Default visitor information
this._visitorInfo = {};
```

Replace with:
```javascript
// Default data (contextual variables)
this._data = {};
```

---

#### 3. Constructor `_upgradeProperty` call (lines ~74–91)

Find:
```javascript
this._upgradeProperty("visitorInfo");
```

Replace with:
```javascript
this._upgradeProperty("data");
```

---

#### 4. Getter and setter (lines ~309–331)

Find:
```javascript
get visitorInfo() {
  return this._visitorInfo || {};
}

set visitorInfo(value) {
  // Validate that the incoming value is a non-null object
  if (value && typeof value === "object" && value !== null) {
    this._visitorInfo = value;
  } else {
    // If the value is invalid but not null/undefined, warn the developer
    if (value) {
      console.warn(
        `Failed to set visitorInfo: value must be an object. Received type: ${typeof value}`
      );
    }
    // Reset to a default empty object
    this._visitorInfo = {};
  }
}
```

Replace with:
```javascript
get data() {
  return this._data || {};
}

set data(value) {
  // Validate that the incoming value is a non-null object
  if (value && typeof value === "object" && value !== null) {
    this._data = value;
  } else {
    // If the value is invalid but not null/undefined, warn the developer
    if (value) {
      console.warn(
        `Failed to set data: value must be an object. Received type: ${typeof value}`
      );
    }
    // Reset to a default empty object
    this._data = {};
  }
}
```

---

#### 5. `_buildInstructions()` method (lines ~1500–1518)

Find:
```javascript
// Add visitor information if available
if (this.visitorInfo && Object.keys(this.visitorInfo).length > 0) {
  instructions += `\n\nYou are assisting a person with the following information: ${JSON.stringify(
    this.visitorInfo
  )}`;
}
```

Replace with:
```javascript
// Add contextual data if available
if (this.data && Object.keys(this.data).length > 0) {
  instructions += `\n\nHere is some additional context for this conversation: ${JSON.stringify(
    this.data
  )}`;
}
```

---

#### 6. Search for any remaining references

After making the above changes, do a full search of the file for any remaining occurrences of:
- `visitorInfo`
- `_visitorInfo`

There should be zero remaining. If any are found, rename them following the same pattern above.

---

## Feature 2: Add `history` Property

### Motivation

The agent has no memory between separate conversation sessions. By passing in a `history` object — a structured transcript of prior sessions — the agent can greet the user appropriately, avoid repeating itself, and build on prior context.

### Property Contract

- **Name**: `history`
- **Type**: `Object` or `Array` (JSON-serializable)
- **Required**: No — this is fully optional
- **When not set**: The property defaults to `null`; nothing is injected into the prompt
- **When set**: Its JSON representation is appended to the system prompt before the session starts

### Changes to make in `voice-chat-component-v060-dev.js`

#### 1. Initialize in `_initializeState()` (lines ~97–122)

Add after the `this._data = {};` line:

```javascript
// Previous conversation history (optional)
this._history = null;
```

---

#### 2. Add `_upgradeProperty` call in the constructor (lines ~74–91)

Add after `this._upgradeProperty("data");`:

```javascript
this._upgradeProperty("history");
```

---

#### 3. Add getter and setter

Add the following getter/setter block immediately after the `data` getter/setter:

```javascript
get history() {
  return this._history || null;
}

set history(value) {
  // Accept objects or arrays; reject primitives
  if (value && (typeof value === "object" || Array.isArray(value))) {
    this._history = value;
  } else {
    if (value !== null && value !== undefined) {
      console.warn(
        `Failed to set history: value must be an object or array. Received type: ${typeof value}`
      );
    }
    this._history = null;
  }
}
```

---

#### 4. Inject into `_buildInstructions()` (lines ~1500–1518)

Add a new block **after** the `data` injection block and **before** the `return instructions;` statement:

```javascript
// Add conversation history if available
if (this.history !== null) {
  instructions += `\n\nThe following is the transcript of previous conversations you have had with this person. Use it to personalize your responses and avoid repeating yourself:\n${JSON.stringify(
    this.history
  )}`;
}
```

The final shape of `_buildInstructions()` after both features are applied should be:

```javascript
_buildInstructions() {
  if (!this.agentConfig) {
    throw new Error("Agent configuration not loaded");
  }

  let instructions = this.agentConfig.instructions;

  // Add current date
  instructions += `\n\nToday's date is ${new Date().toLocaleDateString()}`;

  // Add contextual data if available
  if (this.data && Object.keys(this.data).length > 0) {
    instructions += `\n\nHere is some additional context for this conversation: ${JSON.stringify(
      this.data
    )}`;
  }

  // Add conversation history if available
  if (this.history !== null) {
    instructions += `\n\nThe following is the transcript of previous conversations you have had with this person. Use it to personalize your responses and avoid repeating yourself:\n${JSON.stringify(
      this.history
    )}`;
  }

  return instructions;
}
```

---

#### 5. Update JSDoc comment block (near top of file)

Find the existing usage example comment block and add a `history` example after the `data` example:

```javascript
 * // 4. Optionally pass conversation history
 * <script>
 *   voiceComponent.history = [
 *     {
 *       date: "2025-01-15",
 *       summary: "User asked about 3-bedroom listings in Austin. Was interested in properties under $500k."
 *     }
 *   ];
 * </script>
```

---

## Validation Checklist (for the implementing agent)

Before considering the implementation complete, verify each of the following:

- [ ] No occurrences of `visitorInfo` or `_visitorInfo` remain anywhere in the file
- [ ] `data` getter returns `{}` when not set
- [ ] `data` setter warns and resets to `{}` on invalid input
- [ ] `_upgradeProperty("data")` is called in the constructor
- [ ] `history` getter returns `null` when not set
- [ ] `history` setter accepts both objects and arrays
- [ ] `history` setter warns and resets to `null` on invalid primitive input
- [ ] `_upgradeProperty("history")` is called in the constructor
- [ ] `_buildInstructions()` injects `data` with the neutral prompt text
- [ ] `_buildInstructions()` injects `history` only when not `null`
- [ ] Both injections appear in the correct order: `data` first, `history` second
- [ ] JSDoc usage examples at the top of the file are updated

---

## After Implementation

Once `voice-chat-component-v060-dev.js` is updated:

1. A human developer will review the diff
2. The dev file will be copied to a new staging versioned file (e.g. `public/voice-chat-component-v070-stg.js`)
3. After staging validation, it will be copied to a production versioned file (`public/voice-chat-component-v070.js`)
4. `public/index.html` will be updated to list the new version
5. Firebase deployment will be triggered
