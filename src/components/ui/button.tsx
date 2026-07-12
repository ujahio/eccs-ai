import Link from "next/link";
import type { ComponentPropsWithoutRef } from "react";

type ButtonVariant = "primary" | "secondary" | "ghost" | "inverse";
type ButtonSize = "sm" | "md";

type ButtonStyleProps = {
  variant?: ButtonVariant;
  size?: ButtonSize;
  className?: string;
};

const baseClasses =
  "inline-flex items-center justify-center rounded font-bold uppercase transition focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-brand-teal disabled:pointer-events-none disabled:opacity-60";

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-primary-action !text-white hover:bg-success-mint hover:!text-white",
  secondary:
    "border border-border-gray bg-white text-primary-text hover:border-primary-action",
  ghost: "bg-transparent text-primary-text hover:text-brand-teal",
  inverse:
    "border border-white bg-white !text-primary-action shadow-sm hover:bg-app-canvas hover:!text-primary-action"
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "h-9 px-4 text-xs",
  md: "h-11 px-6 text-sm"
};

function cx(...classes: Array<string | undefined>) {
  return classes.filter(Boolean).join(" ");
}

export function buttonVariants({
  variant = "primary",
  size = "md",
  className
}: ButtonStyleProps = {}) {
  return cx(baseClasses, variantClasses[variant], sizeClasses[size], className);
}

type ButtonProps = ComponentPropsWithoutRef<"button"> & ButtonStyleProps;

export function Button({
  className,
  variant = "primary",
  size = "md",
  type = "button",
  ...props
}: ButtonProps) {
  return (
    <button
      className={buttonVariants({ variant, size, className })}
      type={type}
      {...props}
    />
  );
}

type ButtonLinkProps = ComponentPropsWithoutRef<typeof Link> & ButtonStyleProps;

export function ButtonLink({
  className,
  variant = "primary",
  size = "md",
  ...props
}: ButtonLinkProps) {
  return (
    <Link
      className={buttonVariants({ variant, size, className })}
      {...props}
    />
  );
}
