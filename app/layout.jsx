import { Inter } from "next/font/google";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  display: "swap",
  variable: "--font-inter",
});

export const metadata = {
  title: "Wild · Wave — NeurIPS 2026",
  description: "Environment ↔ AI agency 即時音樂/視覺 (Lyria PCM + AS7341 11 通道)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant" className={inter.variable}>
      <body className={inter.className}>{children}</body>
    </html>
  );
}
