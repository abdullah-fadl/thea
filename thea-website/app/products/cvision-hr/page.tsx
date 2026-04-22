import type { Metadata } from "next";
import CVisionHRContent from "./CVisionHRContent";

export const metadata: Metadata = {
  title: "CVision HR — AI-Powered Human Resources Platform",
  description:
    "Streamline your HR operations with AI-powered recruitment, payroll management, performance tracking, and full Saudi labor law compliance. GOSI, Mudad, and Elm integrated.",
  openGraph: {
    title: "CVision HR — AI-Powered HR Platform | Thea",
    description:
      "Streamline HR operations with AI. Saudi-compliant, GOSI & Mudad integrated.",
    images: ["/og-image.png"],
  },
};

export default function CVisionHRPage() {
  return <CVisionHRContent />;
}
