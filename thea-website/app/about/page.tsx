import type { Metadata } from "next";
import AboutContent from "./AboutContent";

export const metadata: Metadata = {
  title: "About — Our Mission & Vision",
  description:
    "Learn about Thea Technologies — building AI-powered enterprise platforms for HR and Healthcare in Saudi Arabia, aligned with Vision 2030.",
  openGraph: {
    title: "About Thea Technologies",
    description:
      "Building AI-powered enterprise platforms for Saudi Arabia, aligned with Vision 2030.",
    images: ["/og-image.png"],
  },
};

export default function AboutPage() {
  return <AboutContent />;
}
