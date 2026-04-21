// ---- 图标 SVG ----

function LoadingSpinner() {
  return (
    <svg className="animate-spin h-5 w-5 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden>
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z" />
    </svg>
  );
}

function MetaMaskIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" aria-hidden>
      <path d="M35.2 3 22.1 12.7l2.4-5.7L35.2 3z" fill="#E2761B" stroke="#E2761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M4.8 3l13 9.8-2.3-5.8L4.8 3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M30.3 27.8l-3.5 5.3 7.5 2.1 2.2-7.3-6.2-.1z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M3.5 27.9 5.7 35l7.5-2.1-3.5-5.3-6.2.3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.2 18.4-2.1 3.2 7.5.3-.2-8-5.2 4.5z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m26.8 18.4-5.3-4.6-.2 8.1 7.5-.3-2-3.2z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m13.2 33.2 4.5-2.2-3.9-3-.6 5.2z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
      <path d="m22.3 31-3.9 2.2-.7-5.2 4.6 3z" fill="#E4761B" stroke="#E4761B" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function EmbeddedIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9" fill="none" aria-hidden>
      <rect x="6" y="10" width="28" height="20" rx="4" stroke="#0A2540" strokeWidth="2.2" />
      <rect x="14" y="18" width="12" height="8" rx="2" stroke="#0A2540" strokeWidth="2" />
      <path d="M20 14v4" stroke="#0A2540" strokeWidth="2.2" strokeLinecap="round" />
      <circle cx="20" cy="22" r="1.5" fill="#0A2540" />
    </svg>
  );
}

function WalletConnectIcon() {
  return (
    <svg viewBox="0 0 40 40" className="w-9 h-9 text-[#0A2540]" aria-hidden>
      <circle cx="20" cy="20" r="17" fill="none" stroke="currentColor" strokeWidth="1.8" />
      <path
        d="M12 19c4.2-4.2 11-4.2 15.2 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <path
        d="M15 22c2.5-2.5 7.5-2.5 10 0"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
      <circle cx="20" cy="26.5" r="1.8" fill="currentColor" />
    </svg>
  );
}

export {
    LoadingSpinner,
    MetaMaskIcon,
    EmbeddedIcon,
    WalletConnectIcon,
}