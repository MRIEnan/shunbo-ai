import Link from "next/link";
import { cn } from "@/lib/cn";

type Props = {
  href?: string;
  variant?: "primary" | "outline" | "dark" | "ghost" | "light";
  size?: "sm" | "md" | "lg";
  className?: string;
  children: React.ReactNode;
  onClick?: () => void;
};

const base =
  "inline-flex items-center justify-center gap-2 rounded-pill font-medium transition-all duration-200 whitespace-nowrap";
const variants = {
  primary:
    "bg-lavender text-ink border border-ink/80 shadow-[0_2px_0_0_rgba(26,26,26,0.8)] hover:-translate-y-0.5 hover:shadow-[0_4px_0_0_rgba(26,26,26,0.8)] active:translate-y-0 active:shadow-none",
  outline: "border border-ink/20 text-ink hover:bg-ink/5",
  dark: "bg-forest text-cream hover:bg-forest-2",
  light: "bg-cream text-ink hover:bg-cream-2",
  ghost: "text-ink hover:bg-ink/5",
};
const sizes = {
  sm: "h-9 px-4 text-sm",
  md: "h-11 px-5 text-sm",
  lg: "h-13 px-7 text-base",
};

export function Button({ href = "#", variant = "primary", size = "md", className, children, onClick }: Props) {
  const cls = cn(base, variants[variant], sizes[size], className);
  if (onClick) {
    return (
      <button type="button" onClick={onClick} className={cls}>
        {children}
      </button>
    );
  }
  return (
    <Link href={href} className={cls}>
      {children}
    </Link>
  );
}
