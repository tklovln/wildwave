"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import Visualizer from "./Visualizer";
import PromptPanel from "./PromptPanel";
import { subscribe, getSnapshot, toggleAudio } from "./audioStore";
import { Reveal, AnimatedNumber } from "./motion";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

const CH_MAX = 65535;

export default function Page() {
  const paramsRef = useRef(null);
  const paramWsRef = useRef(null);
  const [source, setSource] = useState("(未知)");
  const [connected, setConnected] = useState(false);
  const [snapshot, setSnapshot] = useState(null);

  // 播放狀態來自模組級 store，跨頁 (/, /paper, /member) 持久。
  const audio = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
  const playing = audio.playing;
  const audioStat = audio.stats;

  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((r) => r.json())
      .then((c) => setSource(c.source))
      .catch(() => setSource("(後端未啟動)"));
  }, []);

  useEffect(() => {
    let ws;
    let closed = false;
    function connect() {
      ws = new WebSocket(`${WS_BASE}/ws/params`);
      paramWsRef.current = ws;
      ws.onopen = () => setConnected(true);
      ws.onmessage = (ev) => {
        try {
          const snap = JSON.parse(ev.data);
          paramsRef.current = snap;
          setSnapshot(snap);
        } catch (_) {}
      };
      ws.onclose = () => {
        setConnected(false);
        if (!closed) setTimeout(connect, 1000);
      };
    }
    connect();
    return () => {
      closed = true;
      if (ws) try { ws.close(); } catch (_) {}
    };
  }, []);

  const toggle = toggleAudio;

  const m = snapshot?.music || {};
  const c = snapshot?.clusters || {};
  const isLive = source === "real_lyria";
  const backendDown = source === "(後端未啟動)";
  const kbReceived = audioStat.bytesReceived / 1024;

  return (
    <div className="page">
      <header className="hero" id="listen">
        <div className="hero-eyebrow reveal-load" style={{ "--d": "0ms" }}>
          <span>Environment ↔ AI Live Music</span>
          <span className={`status-pill ${connected ? "is-on" : ""}`}>
            <span className="status-dot" />
            {connected ? "Live feed" : "Connecting…"}
          </span>
        </div>
        <h1 className="hero-title reveal-load" style={{ "--d": "80ms" }}>
          Turn light<br />into sound.
        </h1>

        <div className="hero-cta reveal-load" style={{ "--d": "320ms" }}>
          <button
            type="button"
            onClick={toggle}
            className={`btn ${playing ? "btn-stop" : "btn-primary"}`}
          >
            {playing ? (
              <>
                <Equalizer />
                Stop
              </>
            ) : (
              <>
                <PlayIcon />
                Listen
              </>
            )}
          </button>
          <span className="control-hint">
            {playing ? "即時播放中" : "點擊開始播放"}
          </span>
        </div>
      </header>

      <section className="stats-row" aria-label="即時狀態">
        <Reveal className="stat-card stat-card--source" delay={0}>
          <div className={`stat-source ${isLive ? "stat-source--live" : "stat-source--mock"}`}>
            <span className="stat-source-dot" />
            {backendDown ? "—" : source}
          </div>
          <div className="stat-label">音訊來源</div>
        </Reveal>
        <Reveal className="stat-card" delay={80}>
          <div className="stat-value">
            {kbReceived.toFixed(0)}
            <span className="stat-unit">KB</span>
          </div>
          <div className="stat-label">已接收音訊</div>
        </Reveal>
        <Reveal className="stat-card" delay={160}>
          <div className="stat-value">{audioStat.framesDecoded}</div>
          <div className="stat-label">Frames 解碼</div>
        </Reveal>
        <Reveal className="stat-card" delay={240}>
          <div className="stat-value">{audioStat.queuedFrames}</div>
          <div className="stat-label">佇列中</div>
        </Reveal>
      </section>

      <section className="viz-section">
        <Reveal className="viz-header">
          <div>
            <p className="section-eyebrow">Live visualization</p>
            <h2 className="section-title">光譜驅動的即時幾何體</h2>
          </div>
          <span className={`live-tag ${connected ? "is-on" : ""}`}>
            <span className="status-dot" />
            {connected ? "串流中" : "待機"}
          </span>
        </Reveal>
        <Reveal className={`viz-frame ${playing ? "is-playing" : ""}`} delay={80}>
          <Visualizer paramsRef={paramsRef} />
        </Reveal>
      </section>

      <PromptPanel snapshot={snapshot} apiBase={API_BASE} />

      <section className="metrics-section">
        <Reveal>
          <p className="section-eyebrow">Music parameters</p>
          <h2 className="section-title">環境與 AI 控制量</h2>
        </Reveal>
        <div className="metrics-grid">
          <MetricCard label="Brightness" sublabel="光強" value={m.brightness} delay={0} />
          <MetricCard label="Density" sublabel="密度" value={m.density} delay={70} />
          <MetricCard label="Guidance" value={m.guidance} max={6} delay={140} />
          <MetricCard label="Cold cluster" value={c.cold} accent="cold" delay={210} />
          <MetricCard label="Warm cluster" value={c.warm} accent="warm" delay={280} />
        </div>
      </section>

      <section className="channels-section">
        <Reveal>
          <p className="section-eyebrow">AS7341 · 11 channels</p>
          <h2 className="section-title">光譜通道讀數</h2>
        </Reveal>
        <div className="channels-grid">
          {snapshot?.channels
            ? Object.entries(snapshot.channels).map(([k, v], i) => {
                const pct = Math.max(0, Math.min(100, (Number(v) / CH_MAX) * 100));
                return (
                  <Reveal key={k} className="channel-cell" delay={i * 40}>
                    <div className="channel-name">{k}</div>
                    <div className="channel-value">
                      <AnimatedNumber value={Number(v)} decimals={1} duration={400} />
                    </div>
                    <div className="channel-bar">
                      <div className="channel-bar-fill" style={{ width: `${pct}%` }} />
                    </div>
                  </Reveal>
                );
              })
            : <p className="channels-empty">等待 /ws/params 連線…</p>}
        </div>
      </section>

      <footer className="footer">
        <span className="footer-text">Wild · Wave · NeurIPS 2026 Creative AI Track</span>
        <span className="footer-tag">Lyria RealTime</span>
      </footer>
    </div>
  );
}

function MetricCard({ label, sublabel, value, max = 1, accent, delay = 0 }) {
  const v = value == null ? 0 : Number(value);
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <Reveal className={`metric-card ${accent ? `metric-card--${accent}` : ""}`} delay={delay}>
      <div className="metric-label">
        {label}
        {sublabel ? ` · ${sublabel}` : ""}
      </div>
      <div className="metric-value">
        {value == null ? "—" : <AnimatedNumber value={v} decimals={3} duration={500} />}
      </div>
      <div className="metric-bar">
        <div className="metric-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </Reveal>
  );
}

function PlayIcon() {
  return (
    <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
      <path d="M2 1.5v9l8-4.5-8-4.5z" />
    </svg>
  );
}

function Equalizer() {
  return (
    <span className="eq" aria-hidden="true">
      <span />
      <span />
      <span />
      <span />
    </span>
  );
}
