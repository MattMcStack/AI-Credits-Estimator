import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { ContentstackUserProvider } from "./ContentstackUserContext";
import { ContentstackGuard } from "./ContentstackGuard";

const inter = Inter({ subsets: ["latin"], variable: "--font-inter" });

export const metadata: Metadata = {
  title: "AI Credit Pricing Calculator",
  description: "Modeling consumption and overage forecasting based on volume of runs.",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={inter.variable}>
      <body className={`min-h-screen bg-slate-50 text-slate-900 antialiased ${inter.className}`}>
        <ContentstackUserProvider>
          <ContentstackGuard>{children}</ContentstackGuard>
        </ContentstackUserProvider>
      </body>
    </html>
  );
}
