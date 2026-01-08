import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "WebSSH Terminal",
  description: "Secure web-based SSH terminal built with Next.js and shadcn/ui",
  viewport: {
    width: 'device-width',
    initialScale: 1,
    maximumScale: 5,
    userScalable: true,
    viewportFit: 'cover',
  },
  themeColor: [
    { media: '(prefers-color-scheme: light)', color: '#ffffff' },
    { media: '(prefers-color-scheme: dark)', color: '#0a0a0a' },
  ],
  appleWebApp: {
    capable: true,
    statusBarStyle: 'default',
    title: 'WebSSH Terminal',
  },
  formatDetection: {
    telephone: false,
    date: false,
    address: false,
    email: false,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className="h-full">
      <body className="antialiased h-full overflow-hidden bg-background text-foreground">
        <div className="h-full w-full overflow-hidden">
          {children}
        </div>
      </body>
    </html>
  );
}
