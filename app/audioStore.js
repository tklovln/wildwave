"use client";

// 模組級單例：播放狀態與 audio player 存在模組作用域，
// 前端路由切換 (/, /paper, /member) 時不會被銷毀，
// 因此跨頁維持同一份播放狀態，避免切回主頁時 UI 重置成 "Listen"。

import { createAudioPlayer } from "./audioPlayer";

let player = null;
let playing = false;
let stats = { bytesReceived: 0, framesDecoded: 0, queuedFrames: 0 };
let snapshot = { playing, stats };

const listeners = new Set();

function rebuild() {
  snapshot = { playing, stats };
}
function emit() {
  rebuild();
  listeners.forEach((l) => l());
}

function onStat(s) {
  stats = { ...stats, ...s };
  emit();
}

export function subscribe(cb) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function getSnapshot() {
  return snapshot;
}

export async function toggleAudio() {
  if (!player) {
    player = createAudioPlayer(onStat);
  }
  if (playing) {
    player.stop();
    playing = false;
    emit();
  } else {
    playing = true;
    emit(); // 立即回饋 UI 進入播放狀態
    try {
      await player.start();
    } catch (_) {
      playing = false;
      emit();
    }
  }
}
