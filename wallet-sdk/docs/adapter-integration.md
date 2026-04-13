# Adapter Integration Rules (Adapter-first)

- UI/pages must call `frontend/lib/wallet-adapter.ts` only.
- Do not import `wallet-sdk/src/internal/*` from business code.
- Map SDK error codes to user-facing Chinese copy in adapter.
- Keep default chain config and typed-data templates in adapter, not page code.
- Use `WalletOpsPanel` as smoke-test surface for switch/sign/tx actions.
- Keep wallet session transitions in adapter/store: `idle -> pendingApproval -> signing -> submitted/unlocked/failed`.
- In embedded runtime, inject `password` and `rpcUrl` via adapter config instead of page-level provider logic.
- Persist tx history (submitted/confirmed/failed) through adapter APIs and render-only in page components.
