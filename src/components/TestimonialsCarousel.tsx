import useEmblaCarousel from "embla-carousel-react";
import { useCallback, useEffect, useState } from "react";

interface Testimonial {
  name: string;
  role: string;
  company?: string;
  content: string;
  image?: string;
  imageAlt?: string;
  isBold?: boolean;
}

interface Props {
  testimonials: Testimonial[];
}

/**
 * Le carrousel ne connaît qu'un seul jeu de classes : elles pointent sur les
 * rôles de la charte. Posé dans une section `data-theme="nocturne"`, il bascule
 * sans qu'on lui dise rien.
 */
export default function TestimonialsCarousel({ testimonials }: Props) {
  const [emblaRef, emblaApi] = useEmblaCarousel({
    align: "start",
    slidesToScroll: 1,
    breakpoints: {
      "(min-width: 768px)": { slidesToScroll: 1 },
    },
    loop: false,
    dragFree: false,
  });

  const [selectedIndex, setSelectedIndex] = useState(0);
  const [canScrollPrev, setCanScrollPrev] = useState(false);
  const [canScrollNext, setCanScrollNext] = useState(true);

  const scrollSnaps = emblaApi?.scrollSnapList() ?? [];

  const onSelect = useCallback(() => {
    if (!emblaApi) return;
    setSelectedIndex(emblaApi.selectedScrollSnap());
    setCanScrollPrev(emblaApi.canScrollPrev());
    setCanScrollNext(emblaApi.canScrollNext());
  }, [emblaApi]);

  useEffect(() => {
    if (!emblaApi) return;
    queueMicrotask(() => onSelect());
    emblaApi.on("select", onSelect);
    emblaApi.on("reInit", onSelect);
    return () => {
      emblaApi.off("select", onSelect);
      emblaApi.off("reInit", onSelect);
    };
  }, [emblaApi, onSelect]);

  const scrollPrev = useCallback(() => emblaApi?.scrollPrev(), [emblaApi]);
  const scrollNext = useCallback(() => emblaApi?.scrollNext(), [emblaApi]);
  const scrollTo = useCallback(
    (index: number) => emblaApi?.scrollTo(index),
    [emblaApi],
  );

  return (
    <div className="relative">
      {/* Viewport */}
      <div ref={emblaRef} className="overflow-hidden">
        <div className="flex gap-6 md:gap-8">
          {testimonials.map((t, i) => (
            <div
              key={i}
              className="flex-none w-[85vw] sm:w-[70vw] md:w-[calc(50%-16px)] lg:w-[calc(33.333%-22px)]"
            >
              <div className="card flex h-full min-h-[280px] flex-col p-8 md:p-10">
                {/* Guillemets décoratifs */}
                <span className="mb-3 select-none font-serif text-6xl leading-none text-grey/30">
                  {"\u201C"}
                </span>
                <p
                  className={[
                    "mb-8 flex-1 font-normal leading-relaxed text-ink",
                    // Un cran d'écart au plus entre un verbatim court et un long :
                    // trois cartes côte à côte doivent rester de la même famille.
                    t.isBold ? "text-lg" : "text-base",
                  ].join(" ")}
                >
                  {t.content}
                </p>
                <div className="mt-auto flex items-center gap-4 border-t border-divider pt-6">
                  <img
                    src={
                      t.image ??
                      `https://ui-avatars.com/api/?name=${encodeURIComponent(t.name)}&size=128&background=e5e7eb&color=1f2937`
                    }
                    alt={t.imageAlt ?? t.name}
                    className="h-12 w-12 flex-shrink-0 grayscale rounded-full border border-divider object-cover"
                  />
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-wide text-ink">
                      {t.name}
                    </p>
                    <p className="font-mono text-xs uppercase tracking-widest leading-tight text-grey">
                      {t.role}
                    </p>
                    {t.company && (
                      <p className="mt-0.5 font-mono text-xs uppercase tracking-widest text-grey">
                        {t.company}
                      </p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between mt-8">
        {/* Dots */}
        <div className="flex gap-2 items-center">
          {scrollSnaps.map((_, index) => (
            <button
              key={index}
              onClick={() => scrollTo(index)}
              aria-label={`Aller au témoignage ${index + 1}`}
              className={[
                "h-2 w-2 rounded-sm transition-all duration-150",
                index === selectedIndex
                  ? "bg-swiss w-6"
                  : "bg-divider hover:bg-grey",
              ].join(" ")}
            />
          ))}
        </div>

        {/* Arrows */}
        <div className="flex gap-3">
          <button
            onClick={scrollPrev}
            disabled={!canScrollPrev}
            aria-label="Témoignage précédent"
            className={[
              "w-11 h-11 rounded-md border flex items-center justify-center transition-colors text-sm",
              canScrollPrev
                ? "border-ink text-ink hover:bg-ink hover:text-paper"
                : "border-divider text-grey cursor-not-allowed",
            ].join(" ")}
          >
            ←
          </button>
          <button
            onClick={scrollNext}
            disabled={!canScrollNext}
            aria-label="Témoignage suivant"
            className={[
              "w-11 h-11 rounded-md border flex items-center justify-center transition-colors text-sm",
              canScrollNext
                ? "border-ink text-ink hover:bg-ink hover:text-paper"
                : "border-divider text-grey cursor-not-allowed",
            ].join(" ")}
          >
            →
          </button>
        </div>
      </div>
    </div>
  );
}
