export function LogoMark({ className = "h-9 w-9" }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 48 48"
      className={className}
      aria-hidden="true"
      fill="none"
    >
      <rect x="6" y="8" width="9" height="32" rx="1.5" fill="#7A2E2E" />
      <rect x="8" y="12" width="5" height="2" rx="1" fill="#E8D4B5" />
      <rect x="17" y="6" width="11" height="36" rx="1.5" fill="#3F5C4A" />
      <rect x="19.5" y="10" width="6" height="2" rx="1" fill="#F3E6D0" />
      <rect x="30" y="10" width="10" height="30" rx="1.5" fill="#1F3347" />
      <rect x="32" y="14" width="6" height="2" rx="1" fill="#C4923A" />
    </svg>
  );
}
