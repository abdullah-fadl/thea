import type { Metadata } from "next";
import PricingContent from "./PricingContent";

export const metadata: Metadata = {
  title: "Pricing — Flexible Plans for Every Business",
  description:
    "Transparent pricing for Thea's enterprise SaaS platforms. Choose the plan that fits your organization's needs.",
  openGraph: {
    title: "Pricing | Thea Technologies",
    description:
      "Transparent pricing for enterprise HR and Healthcare platforms.",
    images: ["/og-image.png"],
  },
};

export default function PricingPage() {
  return <PricingContent />;
}
