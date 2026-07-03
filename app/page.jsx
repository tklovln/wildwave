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

  // 讀 /api/config 顯示來源 (mock / real_lyria)。
  useEffect(() => {
    fetch(`${API_BASE}/api/config`)
      .then((r) => r.json())
      .then((c) => setSource(c.source))
      .catch(() => setSource("(後端未啟動)"));
  }, []);

  // 參數 WS: 持續接收 11 通道快照驅動視覺。
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

  return (
    <main style={{ maxWidth: 1080, margin: "0 auto", padding: "24px 20px" }}>
      <header style={{ display: "flex", alignItems: "baseline", gap: 12, flexWrap: "wrap" }}>
        <h1 style={{ fontSize: 22, margin: 0 }}>NeurIPS2026 · Lyria 即時串流</h1>
        <span style={{ opacity: 0.7, fontSize: 13 }}>
          Environment ↔ AI agency · AS7341 11 通道 → Lyria RealTime
        </span>
      </header>

      <div style={{ display: "flex", gap: 12, margin: "16px 0", alignItems: "center", flexWrap: "wrap" }}>
        <button
          onClick={toggle}
          style={{
            background: playing ? "#e05252" : "#3a7bd5",
            color: "#fff",
            border: "none",
            padding: "10px 22px",
            borderRadius: 8,
            fontSize: 15,
            cursor: "pointer",
          }}
        >
          {playing ? "⏹ Stop" : "▶ Listen"}
        </button>
        <span style={{ fontSize: 13, opacity: 0.85 }}>
          來源: <b style={{ color: source === "real_lyria" ? "#4fd1c5" : "#f0b45a" }}>{source}</b>
        </span>
        <span style={{ fontSize: 13, opacity: 0.7 }}>
          收到 {(audioStat.bytesReceived / 1024).toFixed(0)} KB · 解碼 {audioStat.framesDecoded} frames · 佇列 {audioStat.queuedFrames}
        </span>
      </div>

      <Visualizer paramsRef={paramsRef} />

      <section style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(160px,1fr))", gap: 10, marginTop: 16 }}>
        <Card label="Brightness (光強)" value={m.brightness} />
        <Card label="Density (密度)" value={m.density} />
        <Card label="Guidance" value={m.guidance} max={6} />
        <Card label="Cold cluster" value={c.cold} />
        <Card label="Warm cluster" value={c.warm} />
      </section>

      <section style={{ marginTop: 16 }}>
        <h3 style={{ fontSize: 15, margin: "0 0 8px" }}>11 通道 (AS7341)</h3>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit,minmax(120px,1fr))", gap: 6 }}>
          {snapshot?.channels
            ? Object.entries(snapshot.channels).map(([k, v]) => (
                <div key={k} style={{ fontSize: 12, background: "#0d1018", padding: "6px 10px", borderRadius: 6 }}>
                  <div style={{ opacity: 0.6 }}>{k}</div>
                  <div style={{ fontFamily: "monospace" }}>{Number(v).toFixed(1)}</div>
                </div>
              ))
            : <span style={{ opacity: 0.5 }}>等待 /ws/params…</span>}
        </div>
      </section>
    </main>
  );
}

function Card({ label, value, max = 1 }) {
  const v = value == null ? 0 : Number(value);
  const pct = Math.max(0, Math.min(100, (v / max) * 100));
  return (
    <div style={{ background: "#0d1018", padding: 12, borderRadius: 8 }}>
      <div style={{ fontSize: 12, opacity: 0.65 }}>{label}</div>
      <div style={{ fontSize: 18, fontFamily: "monospace" }}>{value == null ? "—" : v.toFixed(3)}</div>
      <div style={{ height: 4, background: "#1c2230", borderRadius: 3, marginTop: 6 }}>
        <div style={{ width: `${pct}%`, height: "100%", background: "#4fd1c5", borderRadius: 3 }} />
      </div>
    </div>
  );
}
