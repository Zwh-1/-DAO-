# Wallet SDK Security & Release Checklist

- [ ] Confirm no key/mnemonic logging in SDK and adapter paths.
- [ ] Run `npm audit` and record high/critical results.
- [ ] Run `npm run check` and keep CI green.
- [ ] Validate migration tool with sample export.
- [ ] Verify browser and node signing/tx flows.
- [ ] Confirm error-code mapping table unchanged for v1.
