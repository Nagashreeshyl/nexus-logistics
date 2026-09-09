import type { ImgHTMLAttributes } from "react";

interface BrandLogoProps extends Omit<ImgHTMLAttributes<HTMLImageElement>, "src" | "alt"> {
  alt?: string;
}

/** Nexus application mark — same asset as favicon. */
export function BrandLogo({ className, alt = "Nexus", ...rest }: BrandLogoProps) {
  return <img src="/logo.svg" alt={alt} className={className} draggable={false} {...rest} />;
}
