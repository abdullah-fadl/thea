import type { Metadata } from "next";
import TheaEHRContent from "./TheaEHRContent";

export const metadata: Metadata = {
  title: "Thea EHR — Electronic Health Records Platform",
  description:
    "Comprehensive Electronic Health Records system with patient management, lab integration, appointment scheduling, and Saudi NHIC compliance.",
  openGraph: {
    title: "Thea EHR — Electronic Health Records | Thea",
    description:
      "Comprehensive EHR system. Saudi NHIC compliant with full healthcare workflow integration.",
    images: ["/og-image.png"],
  },
};

export default function TheaEHRPage() {
  return <TheaEHRContent />;
}
