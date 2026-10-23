import type { ClassValue } from "clsx";
import { clsx } from "clsx";
import { twMerge } from "tailwind-merge";

/**
 * Combine conditional classes and resolve conflicting Tailwind utilities.
 * @param inputs - Class names or conditional class values.
 * @returns The merged class string.
 */
export const cn = (...inputs: ClassValue[]) => twMerge(clsx(inputs));
