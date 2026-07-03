export const metadata = {
  title: "NeurIPS2026 · Lyria Stream",
  description: "Environment ↔ AI agency 即時音樂/視覺 (Lyria PCM + AS7341 11 通道)",
};

export default function RootLayout({ children }) {
  return (
    <html lang="zh-Hant">
      <body
        style={{
          margin: 0,
          background: "#05060a",
          color: "#e8ecf4",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, 'Noto Sans TC', sans-serif",
        }}
      >
        {children}
      </body>
    </html>
  );
}
