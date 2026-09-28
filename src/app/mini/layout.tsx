import type { ReactNode } from "react";
import { createPageMetadata } from "@/lib/seo";

export const metadata = createPageMetadata({
  title: "miniSaurus Minimalist AI Dictionary",
  description:
    "A focused DynaSaurus dictionary experience for personalized word, phrase, and language questions with minimal interface distractions.",
  path: "/mini",
});

export default function MiniLayout({ children }: { children: ReactNode }) {
  return children;
}
