import type { ButtonHTMLAttributes, ReactNode } from "react";

export function cx(...parts: Array<string | false | null | undefined>) {
  return parts.filter(Boolean).join(" ");
}

type Variant = "primary" | "secondary" | "ghost" | "danger";

const variants: Record<Variant, string> = {
  primary: "bg-emerald-600 text-white active:bg-emerald-700 shadow-sm",
  secondary:
    "bg-stone-100 text-stone-800 active:bg-stone-200 border border-stone-200",
  ghost: "text-emerald-700 active:bg-emerald-50",
  danger: "bg-rose-600 text-white active:bg-rose-700",
};

export function Button({
  variant = "primary",
  className,
  ...props
}: ButtonHTMLAttributes<HTMLButtonElement> & { variant?: Variant }) {
  return (
    <button
      {...props}
      className={cx(
        "inline-flex h-11 items-center justify-center gap-2 rounded-2xl px-4 text-sm font-semibold transition-colors disabled:pointer-events-none disabled:opacity-40",
        variants[variant],
        className,
      )}
    />
  );
}

interface Segment<T extends string> {
  value: T;
  label: ReactNode;
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className,
}: {
  options: Segment<T>[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div
      className={cx(
        "flex rounded-2xl bg-stone-100 p-1 text-sm font-semibold",
        className,
      )}
    >
      {options.map((o) => (
        <button
          key={o.value}
          type="button"
          onClick={() => onChange(o.value)}
          className={cx(
            "flex flex-1 items-center justify-center gap-1.5 rounded-xl px-2 py-2 transition-colors",
            value === o.value
              ? "bg-white text-emerald-700 shadow-sm"
              : "text-stone-500 active:text-stone-800",
          )}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}

export function Card({
  className,
  children,
}: {
  className?: string;
  children: ReactNode;
}) {
  return (
    <div
      className={cx(
        "rounded-3xl border border-stone-200/70 bg-white p-4 shadow-sm",
        className,
      )}
    >
      {children}
    </div>
  );
}
