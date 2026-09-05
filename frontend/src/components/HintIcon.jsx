/**
 * HintIcon.jsx — Maps admin-authored free text (a pillar title, a trust-row
 * label, a category name) to a single lucide icon so the web storefront never
 * renders emoji/unicode glyphs as icons.
 *
 * The underlying `emoji`/`icon` fields stay untouched in `app_settings` —
 * mobile (`HomeScreen.jsx`) still reads and renders them. This component only
 * changes what the web client draws in their place.
 *
 * @param {{ hint: string, className?: string, strokeWidth?: number }} props
 * @module components/HintIcon
 */
import {
  FlaskConical,
  ClipboardCheck,
  Banknote,
  Truck,
  Package,
  Bone,
  Activity,
  ShieldPlus,
  Leaf,
  Flower2,
  HeartPulse,
  Brain,
  Sparkles,
  Dna,
  Pill,
} from "lucide-react";

/** Ordered rules — first regex to match the hint text wins. `clean|label` and
 *  `cod|cash|pay` must come before the lab rule: "labels" and "available" both
 *  contain the substring "lab", so an unguarded lab rule first would swallow
 *  them (confirmed live: three of four homepage pillars rendered the same
 *  flask icon before this reordering + the `\blab\b` word boundary). */
const RULES = [
  [/clean|label|disclos|ingredient|filler/i, ClipboardCheck],
  [/cod|cash|pay/i, Banknote],
  [/\blab\b|lab-|tested|verif|purity|potency/i, FlaskConical],
  [/dispatch|fulfil|ship|deliver|fast/i, Truck],
  [/pack|box/i, Package],
  [/bone|calcium/i, Bone],
  [/joint|muscle|mobility/i, Activity],
  [/immun/i, ShieldPlus],
  [/gut|digest|probiotic|fib/i, Leaf],
  [/women|prenatal|pregnan/i, Flower2],
  [/heart|cardio|omega/i, HeartPulse],
  [/brain|memory|focus|sleep|stress/i, Brain],
  [/hair|skin|nail|beauty|glow/i, Sparkles],
  [/collagen|dna|protein/i, Dna],
  [/multi|vitamin|wellness|daily|general|energy/i, Pill],
];

export default function HintIcon({ hint, className = "h-5 w-5", strokeWidth = 1.5 }) {
  const Icon = (RULES.find(([re]) => re.test(String(hint || ""))) || [null, Pill])[1];
  return <Icon className={className} strokeWidth={strokeWidth} aria-hidden="true" />;
}
