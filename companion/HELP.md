# Advanced Expressions

This module provides supported Companion actions for logging, shared data, and a request queue. It does not register callable functions in the native expression editor.

## PRINT logging

Use **PRINT: Write to Companion log** to write to the Companion log through the module SDK's `InstanceBase.log()` API. Select DEBUG, INFO, WARN, or ERROR, optionally provide a prefix, and enter either plain text or JSON. JSON arrays and objects are formatted as readable multi-line output; strings remain strings. Cyclic objects, errors, and values that cannot be serialized have safe fallback formatting.

The message is a real Companion module log entry, not text returned as an expression result. The internal **Write to companion log** action uses Companion's separate custom-message logger; the module API does not expose that internal action or logger directly.

## Shared data

Use **Shared data: Set value** with a key and a JSON-formatted value. Valid values are strings (including quoted JSON strings), finite numbers, Booleans, arrays, and objects. Examples:

```json
{ "shouldSend": true, "message": "Hello World!" }
```

```json
["one", 2, false]
```

```json
"Hello World!"
```

Use **Shared data: Get value** to update these variables:

- `sharedDataKey`
- `sharedDataValue` (JSON representation)
- `sharedDataExists`

**Shared data: Check key** refreshes the same values; the `sharedDataExists` variable is `"true"` or `"false"`. Values are saved in the module's Companion configuration with `saveConfig()`, so they persist across module restarts and Companion restarts. Config is not a secret store; do not save credentials or other sensitive values here. Local variables in an expression are not read or persisted by this feature.

## Request queue

Use **Request queue: Add request** with a JSON object containing `id`, `shouldSend`, `action`, and object-valued `payload`. For example:

```json
{
	"id": 1,
	"shouldSend": true,
	"action": "PRINT",
	"payload": {
		"message": "Hello World!",
		"level": "INFO"
	}
}
```

The queue rejects duplicate IDs. **Request queue: Find request** updates `requestFound` and `requestValue` (`"true"`/`"false"` and the request's JSON state). **Request queue: Check ready and pending** refreshes `requestQueueReady` and `requestQueuePending`.

Requests are not executed when added or found. **Request queue: Process ready requests** is the explicit processor. At this version it executes only `PRINT`; each eligible request moves from pending to processing and then completed or failed. Failed requests keep their error text and are not retried automatically. Requests for unsupported actions are marked failed rather than pretending they ran. The queue and its completion history live in memory and reset when the module instance restarts.

## Companion integration limits

Companion 5.1.1 evaluates expressions through the separate `@companion-app/expressions` engine. The module API has no extension point for adding built-in functions. Implementing native functions requires coordinated changes to that engine and Companion's expression context. In particular, `actionSend()` has side effects and would require an asynchronous, authorization-aware dispatch path rather than a pure synchronous expression function.

Companion's built-in internal action implementation is `System.executeAction()` in [Companion v5.1.1](https://github.com/bitfocus/companion/blob/v5.1.1/companion/lib/Internal/System.ts). The `custom_log` case calls an internal custom-message logger. This internal execution method and the dispatcher are not exposed through `@companion-module/base`; invoking arbitrary actions by ID requires a new supported core API, action validation, execution-context handling, and safeguards against loops/re-entrancy.
