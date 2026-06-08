import Link from "next/link";

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-[90] border-b border-[var(--uoft-border)]/70 bg-white/90 shadow-[0_1px_0_0_rgba(15,27,46,0.06)] backdrop-blur-md supports-[backdrop-filter]:bg-white/80">
      <div className="mx-auto flex max-w-6xl items-center px-4 py-3 sm:px-6 sm:py-4">
        <Link
          href="/"
          className="text-base font-semibold leading-snug tracking-tight text-[var(--uoft-blue)] no-underline hover:opacity-90 sm:text-lg"
        >
          Management Consulting Prep Program
        </Link>
      </div>
    </header>
  );
}
