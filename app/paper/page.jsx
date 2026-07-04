import Link from "next/link";

export const metadata = {
  title: "Paper — Wild · Wave",
  description: "NeurIPS 2026 Creative AI Track — 論文與研究資料",
};

const SECTIONS = [
  {
    eyebrow: "Abstract",
    title: "Environment ↔ AI agency",
    body: "Wild · Wave 探討如何以環境光譜作為 AI 生成音樂的驅動源。透過 AS7341 十一通道感測器與 Google Lyria RealTime，即時將光的節律轉譯為聲音的結構——讓 AI 具備對「當下環境」的感知與回應能力。",
  },
  {
    eyebrow: "Pipeline",
    title: "從光到聲的資料流",
    body: "感測器每分鐘採樣一次，經 Supabase 儲存後以 100ms 三次平滑插值送入 Lyria 參數映射。系統將冷／暖色簇能量、光譜熵、紅外亮度等特徵，分別對應到音樂的密度、引導強度與亮度控制。",
  },
  {
    eyebrow: "Contribution",
    title: "研究貢獻",
    body: "本作提出以低成本光譜感測作為生成式 AI 的即時 embodied prompt，示範了物理環境訊號驅動大型音樂模型的完整實驗管線，並以 Web Audio + Three.js 前端呈現實時互動。",
  },
];

export default function PaperPage() {
  return (
    <div className="page subpage">
      <header className="hero">
        <p className="hero-eyebrow reveal-load" style={{ "--d": "0ms" }}>
          Paper · NeurIPS 2026
        </p>
        <h1 className="hero-title reveal-load" style={{ "--d": "80ms" }}>
          Reading light,<br />writing sound.
        </h1>
        <p className="hero-sub reveal-load" style={{ "--d": "200ms" }}>
          Creative AI Track 提案摘要與研究說明。完整 PDF 與補充資料釋出後，將於此頁面提供下載。
        </p>
      </header>

      <section className="prose-section">
        {SECTIONS.map((s, i) => (
          <article className="prose-block" key={s.title} style={{ "--i": i }}>
            <p className="section-eyebrow">{s.eyebrow}</p>
            <h2 className="section-title">{s.title}</h2>
            <p className="prose-body">{s.body}</p>
          </article>
        ))}
      </section>

      <section className="downloads">
        <p className="section-eyebrow">Resources</p>
        <h2 className="section-title">下載與連結</h2>
        <ul className="download-list">
          <li>
            <span className="download-label">Preprint (PDF)</span>
            <span className="download-meta">Coming soon</span>
          </li>
          <li>
            <span className="download-label">Supplementary materials</span>
            <span className="download-meta">Coming soon</span>
          </li>
          <li>
            <span className="download-label">Source code</span>
            <a
              className="download-link"
              href="https://github.com/tklovln/wildwave"
              target="_blank"
              rel="noreferrer"
            >
              github.com/tklovln/wildwave ↗
            </a>
          </li>
        </ul>
      </section>

      <footer className="footer">
        <span className="footer-text">
          <Link href="/">← Back to Wild · Wave</Link>
        </span>
        <span className="footer-tag">Paper</span>
      </footer>
    </div>
  );
}
