import { useId } from "react";

type Props = {
  /** רוחב/גובה בפיקסלים */
  size?: number;
  className?: string;
  /** hero = כרטיס בראש המסך; tab = סמל בניווט התחתון */
  variant?: "hero" | "tab";
};

/**
 * סמל מותאם לראשי — עלה רך על אריח ירוק עם ניצוצות (מתאים לפלטת האפליקציה).
 */
export function HomeHeroIcon({
  size,
  className = "",
  variant = "hero",
}: Props) {
  const rawId = useId().replace(/[^a-zA-Z0-9]/g, "");
  const bg = `hhb-${rawId}`;
  const leaf = `hhl-${rawId}`;
  const shine = `hhs-${rawId}`;

  const dim = size ?? (variant === "tab" ? 26 : 56);

  return (
    <svg
      className={`home-hero-svg${variant === "tab" ? " home-hero-svg--tab" : ""} ${className}`.trim()}
      width={dim}
      height={dim}
      viewBox="0 0 48 48"
      aria-hidden
    >
      <defs>
        <linearGradient id={bg} x1="6" y1="3" x2="42" y2="45" gradientUnits="userSpaceOnUse">
          <stop stopColor="#042a1c" />
          <stop offset="0.38" stopColor="#0f5238" />
          <stop offset="0.72" stopColor="#2d6a4f" />
          <stop offset="1" stopColor="#5db876" />
        </linearGradient>
        <linearGradient id={leaf} x1="24" y1="9" x2="24" y2="41" gradientUnits="userSpaceOnUse">
          <stop stopColor="#ffffff" stopOpacity="0.96" />
          <stop offset="0.45" stopColor="#ecfdf5" stopOpacity="0.92" />
          <stop offset="1" stopColor="#b1f0ce" stopOpacity="0.88" />
        </linearGradient>
        <radialGradient id={shine} cx="35%" cy="28%" r="55%">
          <stop offset="0%" stopColor="#ffffff" stopOpacity="0.35" />
          <stop offset="100%" stopColor="#ffffff" stopOpacity="0" />
        </radialGradient>
      </defs>

      {/* אריח */}
      <rect x="1" y="1" width="46" height="46" rx="15" fill={`url(#${bg})`} />

      {/* הברקה עליונה */}
      <ellipse cx="24" cy="11" rx="17" ry="7" fill={`url(#${shine})`} />

      {/* עלה — סימטרי, רך */}
      <path
        fill={`url(#${leaf})`}
        d="M24 8.2c-7.8 5.4-12.4 13.5-12.4 22.6 0 6.8 4.4 12.8 12.4 16 8-3.2 12.4-9.2 12.4-16 0-9.1-4.6-17.2-12.4-22.6z"
      />

      {/* עורק עדין */}
      <path
        d="M24 17.5v17"
        stroke="#063822"
        strokeOpacity="0.14"
        strokeWidth="1.25"
        strokeLinecap="round"
      />

      {/* ניצוצות */}
      <circle cx="11.5" cy="13" r="1.6" fill="#fff" fillOpacity="0.55" />
      <circle cx="37" cy="15.5" r="1.15" fill="#fff" fillOpacity="0.42" />
      <circle cx="35.5" cy="36" r="1" fill="#d6efde" fillOpacity="0.95" />

      {/* נקודת חום קטנה — אנרגיה / קלוריות */}
      <circle cx="24" cy="11.5" r="1.35" fill="#c47200" fillOpacity="0.92" />
    </svg>
  );
}
