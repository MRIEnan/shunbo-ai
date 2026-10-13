import { LOGOS } from "@/content/site";

export function LogoMarquee() {
  const items = [...LOGOS, ...LOGOS];
  return (
    <section className="py-10 sm:py-14">
      <p className="eyebrow text-center text-ink/60">Used by professionals at</p>
      <div className="relative mt-8 overflow-hidden [mask-image:linear-gradient(to_right,transparent,black_12%,black_88%,transparent)]">
        <div className="marquee flex w-max items-center gap-14 pr-14" style={{ ["--marquee-duration" as string]: "45s" }}>
          {items.map((name, i) => (
            <span
              key={`${name}-${i}`}
              className="font-serif text-2xl sm:text-3xl text-ink/60 whitespace-nowrap select-none"
            >
              {name}
            </span>
          ))}
        </div>
      </div>
    </section>
  );
}
