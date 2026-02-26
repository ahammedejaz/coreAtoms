/**
 * ScrollReveal.jsx — Scroll-triggered reveal animation wrapper.
 *
 * Uses IntersectionObserver to animate children when they enter the viewport.
 * Supports multiple animation variants and stagger delays.
 *
 * @param {{ children, variant?, delay?, threshold?, className?, as? }} props
 * @module components/ScrollReveal
 */
import { useEffect, useRef, useState } from "react";

const VARIANTS = {
    "fade-up": "translate-y-8 opacity-0",
    "fade-down": "translate-y-[-2rem] opacity-0",
    "fade-left": "translate-x-8 opacity-0",
    "fade-right": "translate-x-[-2rem] opacity-0",
    "fade": "opacity-0",
    "scale": "scale-95 opacity-0",
};

export default function ScrollReveal({
    children,
    variant = "fade-up",
    delay = 0,
    threshold = 0.15,
    className = "",
    as: Tag = "div",
}) {
    const ref = useRef(null);
    const [visible, setVisible] = useState(false);

    useEffect(() => {
        const el = ref.current;
        if (!el) return;

        const observer = new IntersectionObserver(
            ([entry]) => {
                if (entry.isIntersecting) {
                    setVisible(true);
                    observer.unobserve(el);
                }
            },
            { threshold, rootMargin: "0px 0px -40px 0px" }
        );

        observer.observe(el);
        return () => observer.disconnect();
    }, [threshold]);

    const hiddenClass = VARIANTS[variant] || VARIANTS["fade-up"];

    return (
        <Tag
            ref={ref}
            className={`transition-all duration-700 ease-out ${visible ? "translate-y-0 translate-x-0 opacity-100 scale-100" : hiddenClass} ${className}`}
            style={{ transitionDelay: `${delay}ms` }}
        >
            {children}
        </Tag>
    );
}

/**
 * ScrollRevealGroup — Wraps multiple children with staggered reveal.
 * Each direct child gets an increasing delay.
 *
 * @param {{ children, variant?, stagger?, threshold?, className? }} props
 */
export function ScrollRevealGroup({
    children,
    variant = "fade-up",
    stagger = 80,
    threshold = 0.1,
    className = "",
}) {
    const childArray = Array.isArray(children) ? children : [children];

    return (
        <>
            {childArray.map((child, i) => (
                <ScrollReveal
                    key={child?.key ?? i}
                    variant={variant}
                    delay={i * stagger}
                    threshold={threshold}
                    className={className}
                >
                    {child}
                </ScrollReveal>
            ))}
        </>
    );
}
