import Link from "next/link";

export const metadata = {
  title: "Member — Wild · Wave",
  description: "Wild · Wave 團隊與致謝",
};

const MEMBERS = [
  // {
  //   name: "Wang, Ting-Kang",
  //   role: "System / Lyria Pipeline",
  //   note: "整合 Lyria RealTime、後端串流與 Web Audio 播放。",
  // },
  // {
  //   name: "Peng, Yueh-Po",
  //   role: "Frontend / Visualization",
  //   note: "Next.js UI、Three.js 光譜視覺與互動設計。",
  // },
  // {
  //   name: "Field Team",
  //   role: "Sensing @ Hsinchu",
  //   note: "AS7341 十一通道感測部署與長期資料收集。",
  // },
];

export default function MemberPage() {
  return (
    <div className="page subpage">
      <header className="hero">
        <p className="hero-eyebrow reveal-load" style={{ "--d": "0ms" }}>
          Member · Wild · Wave
        </p>
        <h1 className="hero-title reveal-load" style={{ "--d": "80ms" }}>
          The people<br />behind the wave.
        </h1>
        <p className="hero-sub reveal-load" style={{ "--d": "200ms" }}>
          由跨領域團隊共同完成——感測、系統、AI 音樂、前端視覺缺一不可。
        </p>
      </header>

      <section className="member-section">
        <ul className="member-list">
          {MEMBERS.map((m, i) => (
            <li className="member-row" key={m.name} style={{ "--i": i }}>
              <div className="member-name">{m.name}</div>
              <div className="member-role">{m.role}</div>
              <div className="member-note">{m.note}</div>
            </li>
          ))}
        </ul>
      </section>

      <section className="ack-section">
        <p className="section-eyebrow">Acknowledgements</p>
        <h2 className="section-title">致謝</h2>
        <p className="prose-body">
          感謝 NeurIPS 2026 Creative AI Track、Google DeepMind Lyria RealTime 團隊，以及新竹現場長期支援感測部署的夥伴。
        </p>
      </section>

      <footer className="footer">
        <span className="footer-text">
          <Link href="/">← Back to Wild · Wave</Link>
        </span>
        <span className="footer-tag">Member</span>
      </footer>
    </div>
  );
}
