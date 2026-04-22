import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { Toaster } from "@/components/ui/toaster";
import { ThemeProvider } from "next-themes";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "Albos Tracker",
  description:
    "Albos Tracker platform built with Next.js, TypeScript, Tailwind CSS, and shadcn/ui.",
  keywords: [
    "Albos",
    "Albos Tracker",
    "Next.js",
    "TypeScript",
    "Tailwind CSS",
    "shadcn/ui",
    "React",
  ],
  authors: [{ name: "Albos Team" }],
  openGraph: {
    title: "Albos Tracker",
    description: "Albos Tracker platform",
    siteName: "Albos",
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Albos Tracker",
    description: "Albos Tracker platform",
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-background text-foreground`}
      >
        <ThemeProvider attribute="class" defaultTheme="system" enableSystem>
          {children}
          <Toaster />
        </ThemeProvider>
      </body>
    </html>
  );
}
