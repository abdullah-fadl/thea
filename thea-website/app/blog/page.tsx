import type { Metadata } from "next";
import BlogContent from "./BlogContent";

export const metadata: Metadata = {
  title: "Blog — Insights & Updates",
  description:
    "Latest insights on HR technology, healthcare innovation, AI, and digital transformation in Saudi Arabia.",
  openGraph: {
    title: "Blog | Thea Technologies",
    description:
      "Latest insights on HR tech, healthcare innovation, and AI in Saudi Arabia.",
    images: ["/og-image.png"],
  },
};

export default function BlogPage() {
  return <BlogContent />;
}
