# Advanced Expressions for Bitfocus Companion

Advanced Expressions adds reusable logging, persistent shared JSON data, and a small request queue as Companion module actions and variables. It preserves the module template's sample action and config fields.

## Development

This repository uses Yarn 4 through Corepack:

```powershell
corepack yarn install
corepack yarn build
corepack yarn test
corepack yarn lint
```

## What the module can and cannot do

The supported module API provides module logging, action definitions, variables, and `saveConfig()`. It does not provide a way for a module to register new functions in Companion's expression editor or invoke another module's action by ID.

Consequently, `print(...)`, `setSharedData(...)`, `getSharedData(...)`, `hasSharedData(...)`, and `actionSend(...)` are **not native expression functions** in this module. Use the corresponding module actions and read their result variables from Companion expressions. A native function implementation requires changes to Companion's expression engine and host integration; arbitrary action dispatch requires a new, permission-checked Companion core API.

See [companion/HELP.md](./companion/HELP.md) for action usage and integration details.
