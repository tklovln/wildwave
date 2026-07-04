"use client";

import { useEffect, useRef, useState } from "react";

// 打字機：逐字顯示 text，text 變動時重新打字。
function Typewriter({ text, speed = 26 }) {
  const [shown, setShown] = useState("");
  useEffect(() => {
    setShown("");
    if (!text) return;
    let i = 0;
    const id = setInterval(() => {
      i += 1;
      setShown(text.slice(0, i));
      if (i >= text.length) clearInterval(id);
    }, speed);
    return () => clearInterval(id);
  }, [text, speed]);
  return (
    <span className="tw">
      {shown}
      <span className="tw-caret" />
    </span>
  );
}

export default function PromptPanel({ snapshot, apiBase }) {
  // 後端新版會送 prompts；舊版只有 clusters，這裡以 clusters 重建為 fallback。
  const prompts =
    snapshot?.prompts ||
    (snapshot?.clusters
      ? [
          { text: "cool ethereal ambient synth pads", weight: snapshot.clusters.cold ?? 0.5 },
          { text: "warm analog lo-fi soulful groove", weight: snapshot.clusters.warm ?? 0.5 },
        ]
      : []);
  const custom = snapshot?.custom || null;
  const m = snapshot?.music || {};

  // 打字機文本：只用「詞句」(穩定)，權重與參數另外即時顯示避免不斷重打。
  const typedLine = prompts.map((p) => p.text).join("  ·  ") || "等待光譜資料…";

  // 自訂編輯器狀態；首次拿到後端 custom 時初始化一次。
  const [enabled, setEnabled] = useState(false);
  const [text, setText] = useState("");
  const [weight, setWeight] = useState(0.5);
  const [status, setStatus] = useState(null);
  const [busy, setBusy] = useState(false);
  const initedRef = useRef(false);

  useEffect(() => {
    if (!initedRef.current && custom) {
      initedRef.current = true;
      setEnabled(!!custom.enabled);
      setText(custom.text || "");
      if (typeof custom.weight === "number") setWeight(custom.weight);
    }
  }, [custom]);

  async function apply(nextEnabled = enabled) {
    setBusy(true);
    setStatus(null);
    try {
      const res = await fetch(`${apiBase}/api/prompt`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ enabled: nextEnabled, text, weight }),
      });
      if (!res.ok) throw new Error(String(res.status));
      setStatus("已套用到 Lyria");
    } catch (e) {
      setStatus("套用失敗（後端未啟動？）");
    } finally {
      setBusy(false);
      setTimeout(() => setStatus(null), 2600);
    }
  }

  function toggleEnabled() {
    const next = !enabled;
    setEnabled(next);
    apply(next);
  }

  return (
    <section className="prompt-section">
      <p className="section-eyebrow">Live prompt</p>
      <h2 className="section-title">當前提示詞</h2>

      <div className="prompt-stage">
        <span className="prompt-lead">Now generating</span>
        <div className="prompt-typed">
          <Typewriter text={typedLine} />
        </div>
      </div>

      {/* 各 prompt 的即時權重 */}
      <div className="prompt-weights">
        {prompts.map((p, i) => {
          const isCustom = custom?.enabled && p.text === custom.text;
          const pct = Math.max(0, Math.min(100, p.weight * 100));
          return (
            <div className="prompt-weight-row" key={`${p.text}-${i}`}>
              <span className={`prompt-tag ${isCustom ? "is-custom" : ""}`}>
                {isCustom ? "自訂" : i === 0 ? "冷" : "暖"}
              </span>
              <span className="prompt-weight-text">{p.text}</span>
              <span className="prompt-weight-bar">
                <span className="prompt-weight-fill" style={{ width: `${pct}%` }} />
              </span>
              <span className="prompt-weight-val">{p.weight.toFixed(2)}</span>
            </div>
          );
        })}
      </div>

      {/* 即時生成參數 */}
      <div className="prompt-params">
        <Chip label="brightness" value={m.brightness} />
        <Chip label="density" value={m.density} />
        <Chip label="guidance" value={m.guidance} digits={2} />
      </div>

      {/* 自訂 prompt 編輯器 (blend + toggle) */}
      <div className="prompt-editor">
        <div className="prompt-editor-head">
          <span className="prompt-editor-title">自訂 prompt</span>
          <button
            type="button"
            className={`prompt-switch ${enabled ? "is-on" : ""}`}
            onClick={toggleEnabled}
            aria-pressed={enabled}
            disabled={busy}
          >
            <span className="prompt-switch-thumb" />
            <span className="prompt-switch-label">{enabled ? "混合中" : "已關閉"}</span>
          </button>
        </div>

        <textarea
          className="prompt-input"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder="例如：dreamy shoegaze guitar with tape hiss"
          rows={2}
        />

        <div className="prompt-slider-row">
          <label className="prompt-slider-label">
            權重 <b>{weight.toFixed(2)}</b>
          </label>
          <input
            className="prompt-slider"
            type="range"
            min="0"
            max="1"
            step="0.05"
            value={weight}
            onChange={(e) => setWeight(parseFloat(e.target.value))}
          />
        </div>

        <div className="prompt-editor-actions">
          <button
            type="button"
            className="btn btn-primary prompt-apply"
            onClick={() => apply(true)}
            disabled={busy || !text.trim()}
          >
            {busy ? "套用中…" : "套用並混合"}
          </button>
          {status && <span className="prompt-status">{status}</span>}
        </div>
        <p className="prompt-hint">
          自訂 prompt 會與光譜自動生成的冷／暖提示併入，權重越高越主導音色。
        </p>
      </div>
    </section>
  );
}

function Chip({ label, value, digits = 3 }) {
  const v = value == null ? null : Number(value);
  return (
    <span className="prompt-chip">
      <span className="prompt-chip-label">{label}</span>
      <span className="prompt-chip-val">{v == null ? "—" : v.toFixed(digits)}</span>
    </span>
  );
}
