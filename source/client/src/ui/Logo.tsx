export function Logo({ size = 36 }: { size?: number }) {
  return (
    <svg viewBox="0 0 64 64" width={size} height={size} fill="none" role="img" aria-label="Кермо">
      <defs>
        <linearGradient id="kermo-g" x1="8" y1="4" x2="56" y2="60" gradientUnits="userSpaceOnUse">
          <stop stopColor="#14B8A6" />
          <stop offset="1" stopColor="#0B5F73" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="16" fill="url(#kermo-g)" />
      <circle cx="32" cy="32" r="17" stroke="#fff" strokeWidth="4.5" />
      <circle cx="32" cy="32" r="4.5" fill="#fff" />
      <path d="M15 31.5h12.5M36.5 31.5H49M32 36.5V49" stroke="#fff" strokeWidth="4.5" strokeLinecap="round" />
    </svg>
  );
}
