import { useEffect, useState } from "react";

interface NavigationProps {
  currentPath: string;
}

const LINKS: { href: string; label: string; match: (p: string) => boolean }[] =
  [
    {
      href: "/claude-code-suisse",
      label: "Claude Code",
      match: (p) => p.startsWith("/claude-code"),
    },
    {
      href: "/n8n-suisse",
      label: "n8n",
      match: (p) => p.startsWith("/n8n-suisse"),
    },
    {
      href: "/agents-ia",
      label: "Agents IA",
      match: (p) => p.startsWith("/agents-ia"),
    },
    { href: "/a-propos", label: "À propos", match: (p) => p === "/a-propos" },
  ];

export default function Navigation({
  currentPath: initialPath,
}: NavigationProps) {
  const [pathname] = useState(() =>
    typeof window !== "undefined" ? window.location.pathname : initialPath,
  );
  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);

  // Élévation discrète de la barre une fois la page défilée (polish).
  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 8);
    onScroll();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  return (
    <nav
      className={`sticky top-0 z-50 w-full border-b border-divider bg-paper/80 backdrop-blur-md transition-shadow duration-300 ${
        scrolled ? "shadow-soft" : ""
      }`}
    >
      <div className="container-custom flex items-center justify-between py-4 px-4 md:px-6">
        <a
          href="/"
          className="flex items-center gap-4 transition-opacity hover:opacity-80"
        >
          <img
            src="https://cdn.avqn.ch/logo/logo-black.svg"
            alt="AVQN Logo"
            className="h-8 w-auto"
          />
          <span className="font-display text-2xl tracking-[0.18em] text-ink">
            AVQN
          </span>
        </a>

        {/* Desktop menu */}
        <div className="hidden items-center md:flex">
          {LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`group relative px-5 font-mono text-[11px] font-medium uppercase tracking-widest transition-colors ${
                  active ? "text-ink" : "text-grey hover:text-ink"
                }`}
              >
                {link.label}
                <span
                  className={`absolute -bottom-1 left-5 h-0.5 bg-swiss transition-all duration-300 ease-out ${
                    active
                      ? "w-[calc(100%-40px)]"
                      : "w-0 group-hover:w-[calc(100%-40px)]"
                  }`}
                ></span>
              </a>
            );
          })}

          {/* CTA unique — Contact, en primaire rouge Swiss */}
          <div className="ml-6 flex items-center">
            <a
              href="/contact"
              className="rounded-md bg-swiss px-5 py-2.5 text-sm font-semibold text-paper transition-colors duration-150 hover:bg-swiss-dark active:translate-y-px"
            >
              Contact
            </a>
          </div>
        </div>

        {/* Mobile menu button */}
        <div className="flex items-center gap-4 md:hidden">
          <button
            onClick={() => setIsMenuOpen(!isMenuOpen)}
            className="flex h-9 w-9 cursor-pointer flex-col items-center justify-center gap-1.5 rounded-md border border-ink bg-paper transition-colors hover:bg-paper2"
            aria-label="Ouvrir le menu"
            aria-expanded={isMenuOpen}
          >
            <span
              className={`h-0.5 w-4 bg-ink transition-all duration-300 ${isMenuOpen ? "translate-y-2 rotate-45" : ""}`}
            ></span>
            <span
              className={`h-0.5 w-4 bg-ink transition-all duration-300 ${isMenuOpen ? "opacity-0" : ""}`}
            ></span>
            <span
              className={`h-0.5 w-4 bg-ink transition-all duration-300 ${isMenuOpen ? "-translate-y-2 -rotate-45" : ""}`}
            ></span>
          </button>
        </div>
      </div>

      {/* Mobile menu */}
      <div
        className={`absolute left-0 right-0 top-full border-b border-divider bg-paper/95 backdrop-blur-md transition-all duration-300 md:hidden ${
          isMenuOpen
            ? "max-h-[80vh] opacity-100"
            : "max-h-0 overflow-hidden opacity-0"
        }`}
      >
        <div className="container-custom flex flex-col gap-2 px-4 py-6 md:px-6">
          {LINKS.map((link) => {
            const active = link.match(pathname);
            return (
              <a
                key={link.href}
                href={link.href}
                aria-current={active ? "page" : undefined}
                className={`border-l-4 py-3 pl-4 font-mono text-[11px] font-medium uppercase tracking-widest transition-colors ${
                  active
                    ? "border-swiss bg-paper2 text-ink"
                    : "border-transparent text-grey"
                }`}
                onClick={() => setIsMenuOpen(false)}
              >
                {link.label}
              </a>
            );
          })}
          <div className="mt-4 flex flex-col">
            <a
              href="/contact"
              className="w-full rounded-md bg-swiss py-3.5 text-center text-sm font-semibold text-paper transition-colors duration-150 hover:bg-swiss-dark"
              onClick={() => setIsMenuOpen(false)}
            >
              Contact
            </a>
          </div>
        </div>
      </div>
    </nav>
  );
}
