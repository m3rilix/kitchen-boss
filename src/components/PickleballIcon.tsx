interface PickleballIconProps {
  className?: string;
}

export function PickleballIcon({ className = "w-6 h-6" }: PickleballIconProps) {
  return (
    <svg
      viewBox="0 0 100 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      className={className}
    >
      {/* Paddle head */}
      <ellipse
        cx="50"
        cy="35"
        rx="28"
        ry="32"
        fill="currentColor"
        opacity="0.2"
      />
      <ellipse
        cx="50"
        cy="35"
        rx="28"
        ry="32"
        stroke="currentColor"
        strokeWidth="4"
        fill="none"
      />
      {/* Paddle holes pattern */}
      <circle cx="40" cy="25" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="50" cy="25" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="60" cy="25" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="45" cy="35" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="55" cy="35" r="3" fill="currentColor" opacity="0.3" />
      <circle cx="50" cy="45" r="3" fill="currentColor" opacity="0.3" />
      {/* Handle */}
      <rect
        x="44"
        y="64"
        width="12"
        height="28"
        rx="4"
        fill="currentColor"
        opacity="0.6"
      />
      <rect
        x="44"
        y="64"
        width="12"
        height="28"
        rx="4"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      {/* Ball */}
      <circle
        cx="75"
        cy="70"
        r="12"
        fill="currentColor"
        opacity="0.15"
      />
      <circle
        cx="75"
        cy="70"
        r="12"
        stroke="currentColor"
        strokeWidth="3"
        fill="none"
      />
      {/* Ball holes */}
      <circle cx="71" cy="66" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="79" cy="66" r="2" fill="currentColor" opacity="0.4" />
      <circle cx="75" cy="74" r="2" fill="currentColor" opacity="0.4" />
    </svg>
  );
}
