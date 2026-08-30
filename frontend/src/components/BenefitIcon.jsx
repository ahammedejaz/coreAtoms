/**
 * BenefitIcon.jsx — Curated icon set for product "Key Benefits".
 *
 * A fixed vocabulary keeps every product page visually consistent: the admin
 * picks a name from ICON_OPTIONS, the PDP renders the matching stroke icon.
 * Unknown names fall back to the check-circle so old data never breaks.
 *
 * @module components/BenefitIcon
 */

const P = { fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round" };

const ICONS = {
  energy: <path {...P} d="M13 2 4.8 13.2H11L9.6 22l8.6-11.2H12L13 2Z" />,
  heart: <path {...P} d="M12 20.5S3.5 15.4 3.5 9.3a4.6 4.6 0 0 1 8.5-2.4 4.6 4.6 0 0 1 8.5 2.4c0 6.1-8.5 11.2-8.5 11.2Z" />,
  immunity: <path {...P} d="M12 2.8 4.8 5.6v5.2c0 4.6 3 8.9 7.2 10.4 4.2-1.5 7.2-5.8 7.2-10.4V5.6L12 2.8ZM9 11.8l2.2 2.2L15.4 9.6" />,
  bones: (
    <>
      <circle {...P} cx="6.2" cy="6.2" r="2.1" />
      <circle {...P} cx="17.8" cy="17.8" r="2.1" />
      <path {...P} d="M7.8 7.8 16.2 16.2M7.9 10.6l2.7-2.7M13.4 16.1l2.7-2.7" />
    </>
  ),
  muscle: (
    <>
      <rect {...P} x="2.2" y="9" width="3" height="6" rx="1" />
      <rect {...P} x="18.8" y="9" width="3" height="6" rx="1" />
      <rect {...P} x="5.8" y="7" width="3.4" height="10" rx="1.2" />
      <rect {...P} x="14.8" y="7" width="3.4" height="10" rx="1.2" />
      <path {...P} d="M9.2 12h5.6" />
    </>
  ),
  focus: (
    <>
      <circle {...P} cx="12" cy="12" r="8.2" />
      <circle {...P} cx="12" cy="12" r="4.4" />
      <circle cx="12" cy="12" r="1.4" fill="currentColor" />
    </>
  ),
  skin: (
    <>
      <path {...P} d="M12 3.5c.7 3.6 2 5.6 5.5 6.3-3.5.7-4.8 2.7-5.5 6.3-.7-3.6-2-5.6-5.5-6.3 3.5-.7 4.8-2.7 5.5-6.3Z" />
      <path {...P} d="M18.4 14.6c.35 1.8 1 2.8 2.7 3.1-1.7.3-2.35 1.3-2.7 3.1-.35-1.8-1-2.8-2.7-3.1 1.7-.3 2.35-1.3 2.7-3.1Z" />
    </>
  ),
  sleep: <path {...P} d="M20.2 14.5A8.5 8.5 0 0 1 9.5 3.8a8.5 8.5 0 1 0 10.7 10.7Z" />,
  calm: (
    <>
      <path {...P} d="M12 20.8C6 17.4 5 9.6 12 4.2c7 5.4 6 13.2 0 16.6Z" />
      <path {...P} d="M12 20.8V9.8" />
    </>
  ),
  digestion: <path {...P} d="M4.6 9.5a7.7 7.7 0 0 1 14-2.1M19.4 14.5a7.7 7.7 0 0 1-14 2.1M19.4 3.6v3.8h-3.8M4.6 20.4v-3.8h3.8" />,
  vision: (
    <>
      <path {...P} d="M2.5 12S6 5.8 12 5.8 21.5 12 21.5 12 18 18.2 12 18.2 2.5 12 2.5 12Z" />
      <circle {...P} cx="12" cy="12" r="2.8" />
    </>
  ),
  absorption: <path {...P} d="M12 3.2v10.4m0 0 3.8-3.8M12 13.6 8.2 9.8M4.5 15.5v3.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-3.2" />,
  general: (
    <>
      <circle {...P} cx="12" cy="12" r="8.8" />
      <path {...P} d="m8.4 12.2 2.4 2.4 4.8-4.8" />
    </>
  ),
};

export const ICON_OPTIONS = [
  { value: "energy", label: "Energy ⚡" },
  { value: "heart", label: "Heart health" },
  { value: "immunity", label: "Immunity" },
  { value: "bones", label: "Bones & joints" },
  { value: "muscle", label: "Muscle & strength" },
  { value: "focus", label: "Focus & brain" },
  { value: "skin", label: "Skin & glow" },
  { value: "sleep", label: "Sleep" },
  { value: "calm", label: "Stress & calm" },
  { value: "digestion", label: "Digestion & metabolism" },
  { value: "vision", label: "Vision" },
  { value: "absorption", label: "Absorption" },
  { value: "general", label: "General wellness" },
];

export default function BenefitIcon({ name, className = "h-5 w-5" }) {
  return (
    <svg viewBox="0 0 24 24" className={className} aria-hidden="true">
      {ICONS[name] || ICONS.general}
    </svg>
  );
}
