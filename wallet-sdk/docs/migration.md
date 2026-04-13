# Wallet SDK Migration Notes

## TxRequestV1 migration

Move legacy loosely-typed transaction objects to `TxRequestV1`:

- required: `to`, `valueWei`
- optional: `gasLimit`, `maxFeePerGas`, `maxPriorityFeePerGas`, `nonce`, `chainId`, `data`

## Mnemonic strategy migration

`createWalletClient` and `createNodeWalletClient` support:

- `mnemonic-persisted` (default): keeps mnemonic encrypted in keystore envelope
- `mnemonic-ephemeral`: does not persist mnemonic in keystore envelope

## Error mapping ownership migration

Provider layer now focuses on transport calls and emits raw provider errors.
Service layer owns semantic error mapping via `internal/error-mapper.ts`.
