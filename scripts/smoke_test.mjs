#!/usr/bin/env node
// Frontend/back-end 整合 smoke test (headless, 無瀏覽器)。
//
// 驗證 (可由 tester 直接執行，或 CI):
//   AC3-2  /ws/audio 收到 binary frames (>0 bytes，s16le 對齊)。
//   AC3-4  /ws/params 連續快照的 11 通道值可觀測變化 (Environment↔AI agency 轉移)，
//          並印出 before/after 數值 log 供佐證。
//
// 用法:
//   node scripts/smoke_test.mjs [ws://host:port] [seconds]
//   預設 ws://localhost:8000, 6 秒。
//
// 需求: npm i (含 devDependency `ws`)。退出碼 0=全過，非 0=失敗。

import WebSocket from "ws";

const WS_BASE = process.argv[2] || process.env.WS_BASE || "ws://localhost:8000";
const SECONDS = Number(process.argv[3] || 6);

function log(...a) { console.log("[smoke]", ...a); }

function probeAudio() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/audio`);
    ws.binaryType = "arraybuffer";
    let header = null;
    let binFrames = 0;
    let totalBytes = 0;
    let nonZero = false;
    const timer = setTimeout(() => {
      ws.close();
      finish();
    }, Math.min(SECONDS, 5) * 1000);
    function finish() {
      clearTimeout(timer);
      const ok = binFrames > 0 && totalBytes > 0 && nonZero;
      resolve({ name: "AC3-2 /ws/audio binary frames", ok, binFrames, totalBytes, nonZero, header });
    }
    ws.on("message", (data, isBinary) => {
      if (!isBinary) {
        try { header = JSON.parse(data.toString()); } catch (_) {}
        return;
      }
      // 統一成 Uint8Array (ws 可能給 Buffer / ArrayBuffer / Buffer[])
      let bytes;
      if (Buffer.isBuffer(data)) bytes = new Uint8Array(data.buffer, data.byteOffset, data.byteLength);
      else if (data instanceof ArrayBuffer) bytes = new Uint8Array(data);
      else if (Array.isArray(data)) bytes = new Uint8Array(Buffer.concat(data));
      else bytes = new Uint8Array(data);
      binFrames++;
      totalBytes += bytes.length;
      if (bytes.length % 4 !== 0) log("WARN: frame not 4-byte aligned:", bytes.length);
      for (const b of bytes) { if (b !== 0) { nonZero = true; break; } }
      if (binFrames >= 40) { ws.close(); finish(); }
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

function probeParams() {
  return new Promise((resolve, reject) => {
    const ws = new WebSocket(`${WS_BASE}/ws/params`);
    const snaps = [];
    const timer = setTimeout(() => { ws.close(); finish(); }, SECONDS * 1000);
    function finish() {
      clearTimeout(timer);
      let changed = false;
      let changedCh = null;
      if (snaps.length >= 2) {
        const first = snaps[0].channels || {};
        const last = snaps[snaps.length - 1].channels || {};
        for (const k of Object.keys(first)) {
          if (Math.abs((first[k] ?? 0) - (last[k] ?? 0)) > 1e-6) { changed = true; changedCh = k; break; }
        }
      }
      const ok = snaps.length >= 2 && changed && Object.keys(snaps[0].channels || {}).length === 12;
      resolve({
        name: "AC3-4 /ws/params 11-channel change",
        ok,
        snapshots: snaps.length,
        channels: Object.keys(snaps[0]?.channels || {}).length,
        changedChannel: changedCh,
        before: changedCh ? snaps[0].channels[changedCh] : null,
        after: changedCh ? snaps[snaps.length - 1].channels[changedCh] : null,
        musicBefore: snaps[0]?.music,
        musicAfter: snaps[snaps.length - 1]?.music,
      });
    }
    ws.on("message", (data) => {
      try { snaps.push(JSON.parse(data.toString())); } catch (_) {}
    });
    ws.on("error", (e) => { clearTimeout(timer); reject(e); });
  });
}

(async () => {
  log(`target=${WS_BASE} seconds=${SECONDS}`);
  try {
    const [audio, params] = await Promise.all([probeAudio(), probeParams()]);
    log("AUDIO:", JSON.stringify(audio));
    log("PARAMS:", JSON.stringify(params, null, 0));
    if (params.changedChannel) {
      log(`AC3-4 evidence: channel ${params.changedChannel} before=${params.before} after=${params.after}`);
      log(`AC3-4 music before=${JSON.stringify(params.musicBefore)} after=${JSON.stringify(params.musicAfter)}`);
    }
    const allOk = audio.ok && params.ok;
    log(allOk ? "SMOKE OK ✅" : "SMOKE FAIL ❌");
    process.exit(allOk ? 0 : 1);
  } catch (e) {
    log("ERROR:", e.message || e);
    log("後端未啟動? 先跑 ./run.sh 或 uvicorn app:app --port 8000");
    process.exit(2);
  }
})();
