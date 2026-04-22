"use client";

import WebsiteShell from "./WebsiteShell";
import HeroSection from "./sections/HeroSection";
import ProductsSection from "./sections/ProductsSection";
import WhyTheaSection from "./sections/WhyTheaSection";
import StatsSection from "./sections/StatsSection";
import TestimonialsSection from "./sections/TestimonialsSection";
import CTASection from "./sections/CTASection";

export default function WebsiteHomePage() {
  return (
    <WebsiteShell>
      <HeroSection />
      <ProductsSection />
      <WhyTheaSection />
      <StatsSection />
      <TestimonialsSection />
      <CTASection />
    </WebsiteShell>
  );
}
