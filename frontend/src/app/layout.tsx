import type { Metadata } from "next";
import Script from "next/script";
import "./globals.css";

export const metadata: Metadata = {
  title: "AI Social Cross Posting Agent",
  description: "Draft-to-multi-platform AI cross posting dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const adClient = process.env.NEXT_PUBLIC_ADSENSE_CLIENT;
  const adsEnabled = process.env.NEXT_PUBLIC_ENABLE_ADS === "true";

  return (
    <html lang="ko">
      <body>
        {children}
        {adsEnabled && adClient && (
          <Script
            id="adsbygoogle-script"
            async
            strategy="afterInteractive"
            src={`https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${adClient}`}
            crossOrigin="anonymous"
          />
        )}
      </body>
    </html>
  );
}
