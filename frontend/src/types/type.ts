const CHAIN_ID = parseInt(process.env.NEXT_PUBLIC_DEFAULT_CHAIN_ID || '31337', 10);
const RPC_URL  = process.env.NEXT_PUBLIC_RPC_URL || 'http://127.0.0.1:8545';

export { CHAIN_ID, RPC_URL };