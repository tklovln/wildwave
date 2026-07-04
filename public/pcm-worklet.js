// PCM 播放 AudioWorklet processor。
// 主執行緒把已從 s16le 解碼、分軌的 {left, right} Float32 送進來排入 ring queue；
// process() 依 render quantum 逐一取出播放。
//
// jitter buffer 策略 (避免破音):
//   - 啟動時先蓄積 PREBUFFER_FRAMES 才開始播放，吸收網路/主執行緒抖動。
//   - 佇列見底 (underrun) 時，重新進入蓄積狀態並輸出靜音，等回補到
//     REBUFFER_FRAMES 再續播，避免逐樣本斷續產生連續爆音。
const SAMPLE_RATE = 48000;
const PREBUFFER_FRAMES = Math.round(SAMPLE_RATE * 0.2); // 首次啟動蓄積 ~200ms
const REBUFFER_FRAMES = Math.round(SAMPLE_RATE * 0.12); // underrun 後回補 ~120ms

class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    this._queue = [];
    this._cur = null;
    this._pos = 0;
    this._queuedFrames = 0;
    this._priming = true; // 蓄積中 (輸出靜音，不消耗佇列)
    this._threshold = PREBUFFER_FRAMES;
    this.port.onmessage = (e) => {
      const d = e.data;
      if (d && d.type === "pcm") {
        this._queue.push({ left: d.left, right: d.right });
        this._queuedFrames += d.left.length;
      } else if (d && d.type === "reset") {
        this._queue = [];
        this._cur = null;
        this._pos = 0;
        this._queuedFrames = 0;
        this._priming = true;
        this._threshold = PREBUFFER_FRAMES;
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const chL = out[0];
    const chR = out.length > 1 ? out[1] : out[0];

    // 蓄積中：未達門檻則整個 quantum 輸出靜音，不消耗佇列。
    if (this._priming) {
      if (this._queuedFrames >= this._threshold) {
        this._priming = false;
      } else {
        chL.fill(0);
        if (chR !== chL) chR.fill(0);
        this._maybeReport();
        return true;
      }
    }

    for (let i = 0; i < chL.length; i++) {
      if (!this._cur || this._pos >= this._cur.left.length) {
        this._cur = this._queue.shift() || null;
        this._pos = 0;
      }
      if (this._cur) {
        chL[i] = this._cur.left[this._pos];
        chR[i] = this._cur.right[this._pos];
        this._pos++;
        this._queuedFrames = Math.max(0, this._queuedFrames - 1);
      } else {
        chL[i] = 0;
        chR[i] = 0;
      }
    }

    // 佇列見底 → 重新蓄積 (回補門檻較低，降低可聞停頓)。
    if (this._queuedFrames === 0 && !this._cur) {
      this._priming = true;
      this._threshold = REBUFFER_FRAMES;
    }

    this._maybeReport();
    return true;
  }

  _maybeReport() {
    if ((currentFrame & 8191) === 0) {
      this.port.postMessage({
        type: "stat",
        queuedFrames: this._queuedFrames,
        priming: this._priming,
      });
    }
  }
}

registerProcessor("pcm-player", PCMPlayerProcessor);
