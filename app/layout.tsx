import type { Metadata } from "next";
import "./globals.css";
import { ContentstackUserProvider } from "./ContentstackUserContext";
import { ContentstackGuard } from "./ContentstackGuard";

export const metadata: Metadata = {
  title: "Contentstack Subscription",
  description: "Manage your Contentstack subscription and add-ons",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en">
      <body className="h-screen flex flex-col overflow-hidden antialiased font-sans">
        <ContentstackUserProvider>
          <ContentstackGuard>{children}</ContentstackGuard>
        </ContentstackUserProvider>
      </body>
    </html>
  );
}
