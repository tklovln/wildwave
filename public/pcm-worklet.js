// PCM 播放 AudioWorklet processor。
// 主執行緒把 Float32 樣本 (已從 s16le 解碼、去交錯為單聲道混音或雙聲道) 經 port
// 送進來排入 ring queue；process() 依 render quantum 逐一取出播放。
// 佇列空時輸出靜音 (避免爆音)，不丟 underrun 例外。
class PCMPlayerProcessor extends AudioWorkletProcessor {
  constructor() {
    super();
    // 佇列: 一連串 Float32Array (每段為 interleaved L,R 或已分軌)。
    // 為簡化，主執行緒送來的是「已分軌」的物件 {left: Float32Array, right: Float32Array}。
    this._queue = [];
    this._cur = null;
    this._pos = 0;
    this._queuedFrames = 0;
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
      }
    };
  }

  process(inputs, outputs) {
    const out = outputs[0];
    const chL = out[0];
    const chR = out.length > 1 ? out[1] : out[0];
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
    // 週期回報佇列深度，供主執行緒監看 (可選)。
    if ((currentFrame & 8191) === 0) {
      this.port.postMessage({ type: "stat", queuedFrames: this._queuedFrames });
    }
    return true;
  }
}

registerProcessor("pcm-player", PCMPlayerProcessor);
