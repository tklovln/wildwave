"use client";

// 把後端 /ws/audio 的 s16le 48kHz stereo PCM 二進位串流，經 AudioWorklet 播放。
// 回傳 { start, stop, ready, stats } 供 UI 控制。

const API_WS = process.env.NEXT_PUBLIC_WS_BASE || "ws://localhost:8000";

export function createAudioPlayer(onStat) {
  let audioCtx = null;
  let node = null;
  let ws = null;
  let running = false;
  let bytesReceived = 0;
  let framesDecoded = 0;
  let startedAt = 0;

  async function start() {
    if (running) return;
    running = true;
    bytesReceived = 0;
    framesDecoded = 0;

    // 後端固定 48kHz；AudioContext 以相同 sampleRate 建立，避免重採樣失真。
    audioCtx = new (window.AudioContext || window.webkitAudioContext)({
      sampleRate: 48000,
    });
    await audioCtx.audioWorklet.addModule("/pcm-worklet.js");
    node = new AudioWorkletNode(audioCtx, "pcm-player", {
      outputChannelCount: [2],
    });
    node.port.onmessage = (e) => {
      if (e.data && e.data.type === "stat" && onStat) {
        onStat({ queuedFrames: e.data.queuedFrames, bytesReceived, framesDecoded });
      }
    };
    node.connect(audioCtx.destination);
    if (audioCtx.state === "suspended") await audioCtx.resume();

    ws = new WebSocket(`${API_WS}/ws/audio`);
    ws.binaryType = "arraybuffer";
    startedAt = performance.now();
    ws.onmessage = (ev) => {
      if (typeof ev.data === "string") {
        // header JSON — 記錄格式即可
        return;
      }
      const buf = ev.data; // ArrayBuffer, s16le interleaved stereo
      bytesReceived += buf.byteLength;
      const view = new DataView(buf);
      const nFrames = Math.floor(buf.byteLength / 4); // 2ch * 2byte
      const left = new Float32Array(nFrames);
      const right = new Float32Array(nFrames);
      for (let i = 0; i < nFrames; i++) {
        const l = view.getInt16(i * 4, true);
        const r = view.getInt16(i * 4 + 2, true);
        left[i] = l / 32768;
        right[i] = r / 32768;
      }
      framesDecoded += nFrames;
      node.port.postMessage({ type: "pcm", left, right }, [left.buffer, right.buffer]);
    };
    ws.onclose = () => {
      running = false;
    };
    ws.onerror = () => {
      running = false;
    };
  }

  function stop() {
    running = false;
    if (ws) {
      try { ws.close(); } catch (_) {}
      ws = null;
    }
    if (node) {
      node.port.postMessage({ type: "reset" });
      try { node.disconnect(); } catch (_) {}
      node = null;
    }
    if (audioCtx) {
      try { audioCtx.close(); } catch (_) {}
      audioCtx = null;
    }
  }

  return {
    start,
    stop,
    isRunning: () => running,
    getStats: () => ({
      bytesReceived,
      framesDecoded,
      elapsedS: (performance.now() - startedAt) / 1000,
    }),
  };
}
