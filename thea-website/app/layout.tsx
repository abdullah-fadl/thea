import type { Metadata } from "next";
import { Plus_Jakarta_Sans, Tajawal } from "next/font/google";
import "./globals.css";
import { LanguageProvider } from "@/context/LanguageContext";
import { ThemeProvider } from "@/context/ThemeContext";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

const jakarta = Plus_Jakarta_Sans({
  subsets: ["latin"],
  variable: "--font-jakarta",
  display: "swap",
  weight: ["300", "400", "500", "600", "700", "800"],
});

const tajawal = Tajawal({
  subsets: ["arabic"],
  variable: "--font-tajawal",
  display: "swap",
  weight: ["300", "400", "500", "700", "800"],
});

export const metadata: Metadata = {
  title: {
    default: "Thea — Everything You Need, Between Your Hands",
    template: "%s | Thea",
  },
  description:
    "Enterprise SaaS platforms for HR and Healthcare — AI-powered, Saudi-compliant",
  keywords: [
    "HR",
    "EHR",
    "SaaS",
    "Saudi Arabia",
    "AI",
    "CVision",
    "Thea",
    "Healthcare",
    "Human Resources",
  ],
  authors: [{ name: "Thea Technologies" }],
  creator: "Thea Technologies",
  openGraph: {
    type: "website",
    locale: "en_US",
    alternateLocale: "ar_SA",
    title: "Thea Technologies",
    description:
      "Enterprise SaaS platforms for HR and Healthcare — AI-powered, Saudi-compliant",
    siteName: "Thea",
    images: [
      {
        url: "/og-image.png",
        width: 1200,
        height: 630,
        alt: "Thea Technologies",
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: "Thea Technologies",
    description:
      "Enterprise SaaS platforms for HR and Healthcare — AI-powered, Saudi-compliant",
    images: ["/og-image.png"],
  },
  icons: {
    icon: "/logos/thea-favicon.svg",
    shortcut: "/logos/thea-favicon.svg",
    apple: "/logos/thea-icon.svg",
  },
  metadataBase: new URL("https://thea.sa"),
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${jakarta.variable} ${tajawal.variable} font-sans bg-white dark:bg-thea-dark text-slate-900 dark:text-white min-h-screen`}
      >
        <ThemeProvider>
          <LanguageProvider>
            <Navbar />
            <main className="min-h-screen">{children}</main>
            <Footer />
          </LanguageProvider>
        </ThemeProvider>
      </body>
    </html>
  );
}
