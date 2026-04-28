import type { Metadata } from "next";
import ContactContent from "./ContactContent";

export const metadata: Metadata = {
  title: "Contact Us — Get in Touch",
  description:
    "Contact Thea Technologies for enterprise HR and Healthcare solutions. Schedule a demo, request pricing, or get support.",
  openGraph: {
    title: "Contact Thea Technologies",
    description: "Get in touch for enterprise HR and Healthcare solutions.",
    images: ["/og-image.png"],
  },
};

export default function ContactPage() {
  return <ContactContent />;
}
