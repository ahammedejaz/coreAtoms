/**
 * HeroCarousel.jsx — Auto-advancing image carousel with dot navigation.
 *
 * Cycles through an array of image URLs at a configurable interval.
 * Includes manual dot controls and lazy-loading for non-first images.
 *
 * @param {{ images: string[], intervalMs?: number, className?: string }} props
 * @module components/HeroCarousel
 */
import { useCallback, useEffect, useMemo, useState } from "react";

export default function HeroCarousel({
  images = [],
  intervalMs = 3500,
  className = "",
}) {
  const slides = useMemo(() => images.filter(Boolean), [images]);
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (slides.length <= 1) return;
    const id = setInterval(() => {
      setIndex((i) => (i + 1) % slides.length);
    }, intervalMs);
    return () => clearInterval(id);
  }, [slides.length, intervalMs]);

  /** Keyboard navigation: arrow keys to change slides. */
  const handleKeyDown = useCallback((e) => {
    if (e.key === "ArrowLeft") {
      setIndex((i) => (i - 1 + slides.length) % slides.length);
    } else if (e.key === "ArrowRight") {
      setIndex((i) => (i + 1) % slides.length);
    }
  }, [slides.length]);

  if (!slides.length) return null;

  return (
    <div
      className={`relative overflow-hidden rounded-3xl ${className}`}
      role="region"
      aria-roledescription="carousel"
      aria-label="Hero images"
      tabIndex={0}
      onKeyDown={handleKeyDown}
    >
      {/* Slides */}
      <div
        className="flex h-full w-full transition-transform duration-700 ease-out"
        style={{ transform: `translateX(-${index * 100}%)` }}
        aria-live="polite"
      >
        {slides.map((src, i) => (
          <div key={src + i} className="relative h-full w-full shrink-0" role="group" aria-roledescription="slide" aria-label={`Slide ${i + 1} of ${slides.length}`}>
            <img
              src={src}
              alt={`Hero banner ${i + 1}`}
              className="h-full w-full object-cover"
              loading={i === 0 ? "eager" : "lazy"}
              decoding="async"
            />
            {/* subtle vignette for premium feel */}
            <div className="absolute inset-0 bg-gradient-to-r from-white/85 via-white/35 to-white/10" />
            <div className="absolute inset-0 bg-gradient-to-t from-black/10 via-transparent to-transparent" />
          </div>
        ))}
      </div>

      {/* Dots */}
      {slides.length > 1 && (
        <div className="absolute bottom-4 left-6 flex items-center gap-2" role="tablist" aria-label="Carousel navigation">
          {slides.map((_, i) => (
            <button
              key={i}
              onClick={() => setIndex(i)}
              className={`h-2.5 w-2.5 rounded-full transition ${i === index ? "bg-black/70" : "bg-black/25 hover:bg-black/45"
                }`}
              aria-label={`Go to slide ${i + 1}`}
              aria-selected={i === index}
              role="tab"
              type="button"
            />
          ))}
        </div>
      )}
    </div>
  );
}

