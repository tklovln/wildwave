"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import Visualizer from "./Visualizer";
import { createAudioPlayer } from "./audioPlayer";

const WS_BASE = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";
const API_BASE = process.env.NEXT_PUBLIC_API_BASE || "http://localhost:8000";

export default function Page() {
  const paramsRef = useRef(null);
  const playerRef = useRef(null);
  const paramWsRef = useRef(null);
  const [playing, setPlaying] = useState(false);
  const [source, setSource] = useState("(未知)");
  const [audioStat, setAudioStat] = useState({ bytesReceived: 0, framesDecoded: 0, queuedFrames: 0 });
  const [snapshot, setSnapshot] = useState(null);

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
      ws.onmessage = (ev) => {
        try {
          const snap = JSON.parse(ev.data);
          paramsRef.current = snap;
          setSnapshot(snap);
        } catch (_) {}
      };
      ws.onclose = () => {
        if (!closed) setTimeout(connect, 1000);
      };
    }
    connect();
    return () => {
      closed = true;
      if (ws) try { ws.close(); } catch (_) {}
    };
  }, []);

  const toggle = useCallback(async () => {
    if (!playerRef.current) {
      playerRef.current = createAudioPlayer((s) => setAudioStat((prev) => ({ ...prev, ...s })));
    }
    if (playing) {
      playerRef.current.stop();
      setPlaying(false);
    } else {
      await playerRef.current.start();
      setPlaying(true);
    }
  }, [playing]);

  const m = snapshot?.music || {};
  const c = snapshot?.clusters || {};
  const isLive = source === "real_lyria";
  const kbReceived = (audioStat.bytesReceived / 1024).toFixed(0);

  return (
    <div className="page">
      <nav className="nav">
        <span className="nav-brand">Wild · Wave</span>
        <span className="nav-meta">NeurIPS 2026</span>
      </nav>

      <header className="hero">
        <p className="hero-eyebrow">Environment ↔ AI agency</p>
        <h1 className="hero-title">Turn light into sound.</h1>
        <p className="hero-sub">
          AS7341 十一通道光譜即時驅動 Lyria RealTime——環境光強與 AI 密度共同塑造聲音與形體。
        </p>
      </header>

      <section className="stats-row" aria-label="即時狀態">
        <div className="stat-card">
          <div className={`stat-value ${isLive ? "stat-value--live" : "stat-value--mock"}`}>
            {source === "(後端未啟動)" ? "—" : source}
          </div>
          <div className="stat-label">音訊來源</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{kbReceived}</div>
          <div className="stat-label">KB 已接收</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{audioStat.framesDecoded}</div>
          <div className="stat-label">Frames 解碼</div>
        </div>
        <div className="stat-card">
          <div className="stat-value">{audioStat.queuedFrames}</div>
          <div className="stat-label">佇列中</div>
        </div>
      </section>

      <div className="controls">
        <button
          type="button"
          onClick={toggle}
          className={`btn ${playing ? "btn-stop" : "btn-primary"}`}
        >
          {playing ? "Stop" : "Listen"}
        </button>
        <span className="control-hint">
          {playing ? "即時串流播放中" : "點擊開始聆聽 Lyria 輸出"}
        </span>
      </div>

      <section className="viz-section">
        <div className="viz-header">
          <div>
            <p className="section-eyebrow">Live visualization</p>
            <h2 className="section-title">光譜驅動的即時幾何體</h2>
          </div>
        </div>
        <div className="viz-frame">
          <Visualizer paramsRef={paramsRef} />
        </div>
      </section>

      <section className="metrics-section">
        <p className="section-eyebrow">Music parameters</p>
        <h2 className="section-title">環境與 AI 控制量</h2>
        <div className="metrics-grid">
          <MetricCard label="Brightness" sublabel="光強" value={m.brightness} />
          <MetricCard label="Density" sublabel="密度" value={m.density} />
          <MetricCard label="Guidance" value={m.guidance} max={6} />
          <MetricCard label="Cold cluster" value={c.cold} />
          <MetricCard label="Warm cluster" value={c.warm} />
        </div>
      </section>

      <section className="channels-section">
        <p className="section-eyebrow">AS7341 · 11 channels</p>
        <h2 className="section-title">光譜通道讀數</h2>
        <div className="channels-grid">
          {snapshot?.channels
            ? Object.entries(snapshot.channels).map(([k, v]) => (
                <div key={k} className="channel-cell">
                  <div className="channel-name">{k}</div>
                  <div className="channel-value">{Number(v).toFixed(1)}</div>
                </div>
              ))
            : <p className="channels-empty">等待 /ws/params 連線…</p>}
        </div>
      </section>

      <footer className="footer">
        <span className="footer-text">Wild · Wave · NeurIPS 2026</span>
        <span className="footer-tag">Lyria RealTime</span>
      </footer>
    </div>
  );
}

function MetricCard({ label, sublabel, value, max = 1 }) {
  const v = value == null ? 0 : Number(value);
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div className="metric-card">
      <div className="metric-label">
        {label}
        {sublabel ? ` · ${sublabel}` : ""}
      </div>
      <div className="metric-value">{value == null ? "—" : v.toFixed(3)}</div>
      <div className="metric-bar">
        <div className="metric-bar-fill" style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
