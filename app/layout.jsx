import "./globals.css";
import SiteNav from "./SiteNav";

export const metadata = {
  title: "Wild · Wave — NeurIPS 2026",
  description: "Environment ↔ AI agency 即時音樂/視覺 (Lyria PCM + AS7341 11 通道)",
};

// 在 hydration 前套用主題, 避免閃爍 (FOUC)。預設深色。
const themeInit = `(function(){try{var t=localStorage.getItem('theme')||'dark';document.documentElement.setAttribute('data-theme',t);}catch(e){document.documentElement.setAttribute('data-theme','dark');}})();`;

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInit }} />
      </head>
      <body>
        <SiteNav />
        {children}
      </body>
    </html>
  );
}
