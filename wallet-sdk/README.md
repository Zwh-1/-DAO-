# Wallet SDK v1

Hybrid wallet SDK for browser + node runtimes.

## Stable API contract (v1)

Browser (`createWalletClient`):
- `getRuntimeInfo()`
- `requestAccounts()`
- `signMessage(message, opts?)`
- `signTypedData(typedData, opts?)`
- `sendTransaction(tx, opts?)`
- `switchChain(chainIdHex)`
- `addChainThenSwitch(chainConfig)`
- `createEmbeddedWallet(password)` → `{ address, mnemonic }`（助记词仅创建时返回一次，用于备份展示）
- `importEmbeddedMnemonic(password, mnemonic)`
- `deriveNextEmbeddedAccount(password)`
- `listEmbeddedAccounts(password)`
- `selectEmbeddedAccount(password, address)`
- `subscribe({ onAccountsChanged, onChainChanged, onDisconnect, onEvent })`

Node (`createNodeWalletClient`):
- `getRuntimeInfo()`
- `createEmbeddedWallet(password)` → `{ address, mnemonic }`（助记词仅创建时返回一次，用于备份展示）
- `signMessage(message, opts)`
- `signTypedData(typedData, opts)`
- `sendTransaction(tx, opts)`
- `switchChain()` -> throws `UNSUPPORTED_METHOD`
- `importEmbeddedMnemonic(password, mnemonic)`
- `deriveNextEmbeddedAccount(password)`
- `listEmbeddedAccounts(password)`
- `selectEmbeddedAccount(password, address)`

## Runtime modes

- `mode: "auto"`: injected wallet first, fallback to embedded keystore
- `mode: "injected"`: EIP-1193 only
- `mode: "embedded"`: local encrypted keystore only

## Error codes (frozen v1)

- `PROVIDER_NOT_FOUND`
- `INVALID_PASSWORD`
- `WALLET_NOT_FOUND`
- `DECRYPT_FAILED`
- `UNSUPPORTED_METHOD`
- `USER_REJECTED`
- `INVALID_PARAMS`
- `CHAIN_SWITCH_REJECTED`
- `CHAIN_NOT_ADDED`
- `TRANSACTION_FAILED`
- `RPC_UNAVAILABLE`
- `INSUFFICIENT_FUNDS`
- `NONCE_CONFLICT`
- `GAS_ESTIMATION_FAILED`
- `MNEMONIC_INVALID`
- `STORAGE_CORRUPTED`

## TxRequestV1

`sendTransaction` now accepts a stable transaction model across browser/node:

- required: `to`, `valueWei`
- optional: `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`, `nonce`, `chainId`, `data`

## Build & test

- `npm run typecheck`
- `npm run test`
- `npm run build`
- `npm run check` (typecheck + test + build)

## Security baseline

- AES-GCM-256 + PBKDF2(SHA-256, 100000)
- No private key/mnemonic logs
- Browser keystore default: `localStorage` (adapter-based; can evolve)
- Node keystore default: file-based envelope
- Node write path uses atomic write strategy (`tmp -> fsync -> rename`) with in-process mutex.
- Mnemonic strategy supports `mnemonic-persisted` (default) and `mnemonic-ephemeral`.

## Migration tool

`tools/migrate-extension-storage.mjs` converts exported extension wallet data into SDK keystore envelope:

```bash
node tools/migrate-extension-storage.mjs --in ./export.json --out ./.wallet-sdk.keystore.json --password your_password
```

## Governance for app integration

Business apps should consume SDK through app-level `wallet-adapter` and avoid importing SDK internal modules.

## Docs

- Migration details: `docs/migration.md`
