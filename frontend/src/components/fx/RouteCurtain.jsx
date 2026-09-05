/**
 * RouteCurtain.jsx — The navy wipe between pages.
 *
 * When the path changes, a navy field rises from the foot of the viewport
 * over the page that is leaving (280ms), the new page is swapped in and
 * scrolled to the top underneath it, then the field lifts away (520ms)
 * while the new content rises to meet it. The destination's name sits on
 * the field for the beat it is on screen, so even a slow chunk load reads
 * as intent rather than a stall. Query-string and hash changes (shop
 * filters, section links) never trigger it.
 *
 * The outgoing page is kept on screen through `useOutlet()`: the element
 * from the previous render is held in a ref while the field covers it.
 * Without the curtain (reduced motion, admin) the live outlet renders
 * with the short `page-enter` fade.
 *
 * @param {{ children: (content: React.ReactNode, arriving: boolean, curtain: boolean, fullBleed: boolean) => React.ReactNode }} props
 * @module components/fx/RouteCurtain
 */
import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { useLocation, useMatches, useOutlet } from "react-router-dom";
import { useMotion } from "../../context/MotionContext";
import { useScrollToTop } from "./SmoothScroll";

const COVER_MS = 300;
const HOLD_MS = 60;
const REVEAL_MS = 560;

const LABELS = [
  [/^\/$/, "Home"],
  [/^\/shop/, "Shop"],
  [/^\/product\//, "Formula"],
  [/^\/cart/, "Cart"],
  [/^\/checkout/, "Checkout"],
  [/^\/orders/, "My orders"],
  [/^\/(login|forgot-password|reset-password)/, "Account"],
  [/^\/faq/, "Questions"],
  [/^\/contact/, "Contact"],
  [/^\/(terms|privacy|shipping-policy|refund-policy)/, "Policies"],
];
const labelFor = (path) => (LABELS.find(([re]) => re.test(path)) || [null, ""])[1];

export default function RouteCurtain({ children }) {
  const { curtain } = useMotion();
  const { pathname } = useLocation();
  const outlet = useOutlet();
  const fullBleed = useMatches().some((m) => m.handle?.fullBleed);
  const scrollToTop = useScrollToTop();

  const [phase, setPhase] = useState("idle"); // idle | cover | reveal
  const [label, setLabel] = useState("");
  const [held, setHeld] = useState(null);
  const lastIdleRef = useRef({ outlet, fullBleed });
  const lastPathRef = useRef(pathname);
  const timers = useRef([]);

  // Runs after every render. While the path is unchanged it records the page
  // the visitor is looking at; when the path changes, that record is the
  // page the curtain covers, so the swap underneath never shows a flash.
  useLayoutEffect(() => {
    if (lastPathRef.current === pathname) {
      if (phase === "idle") lastIdleRef.current = { outlet, fullBleed };
      return;
    }
    lastPathRef.current = pathname;
    timers.current.forEach(clearTimeout);
    timers.current = [];

    if (!curtain) {
      scrollToTop();
      lastIdleRef.current = { outlet, fullBleed };
      return;
    }

    setHeld(lastIdleRef.current);
    setLabel(labelFor(pathname));
    setPhase("cover");
    timers.current.push(setTimeout(() => {
      scrollToTop();
      setPhase("reveal");
      timers.current.push(setTimeout(() => setPhase("idle"), REVEAL_MS));
    }, COVER_MS + HOLD_MS));
  }, [pathname, outlet, fullBleed, phase, curtain, scrollToTop]);

  useEffect(() => () => timers.current.forEach(clearTimeout), []);

  const shown = phase === "cover" && held ? held : { outlet, fullBleed };
  const arriving = phase === "reveal";

  return (
    <>
      {children(shown.outlet, arriving, curtain, shown.fullBleed)}
      {curtain && (
        <div className={`curtain ${phase !== "idle" ? `is-${phase}` : ""}`} aria-hidden="true">
          <div className="curtain-field field-navy grain">
            <span className="curtain-label">{label}</span>
          </div>
        </div>
      )}
    </>
  );
}
