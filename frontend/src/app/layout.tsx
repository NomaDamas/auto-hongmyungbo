import type { Metadata } from "next";
import "./globals.css";
import Script from "next/script";

export const metadata: Metadata = {
  title: "AI Social Cross Posting Agent",
  description: "Draft-to-multi-platform AI cross posting dashboard",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="ko" suppressHydrationWarning>
      <head>
        <Script id="theme-init" strategy="beforeInteractive">
          {`(function(){try{var saved=localStorage.getItem("hmb_theme_mode");var dark=saved?saved==="dark":window.matchMedia("(prefers-color-scheme: dark)").matches;document.documentElement.classList.toggle("dark",dark);}catch(e){}})();`}
        </Script>
      </head>
      <body>
        {children}
      </body>
    </html>
  );
}
