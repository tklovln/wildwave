"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// 11 通道 (F1-F8 冷/暖光譜 + Clear/NIR/Flicker) 驅動一個 3D 幾何體:
//  - F1-F8 -> 環繞的 11 根光譜柱 (含 Clear/NIR/Flicker)，高度=通道歸一化值。
//  - music.brightness -> 主幾何 emissive 亮度 (Environment 光強)。
//  - music.density     -> 幾何體形變 (icosahedron 頂點位移量，AI agency 密度)。
//  - clusters.cold/warm -> 色相在冷(藍青)↔暖(橙紅)間插值 (Environment↔AI agency 轉移)。
//  - guidance          -> 旋轉速度。
// 提供 window.__vizState 供 headless smoke test 讀取當前幾何參數 (AC3-4 數值 log)。

const CH_ORDER = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "Clear", "NIR", "Flicker",
];
const CH_RANGE = {
  Clear: 65535, NIR: 65535, Flicker: 65535,
  F1: 65535, F2: 65535, F3: 65535, F4: 65535,
  F5: 65535, F6: 65535, F7: 65535, F8: 65535,
};

export default function Visualizer({ paramsRef }) {
  const mountRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 500;

    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x05060a);
    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);
    camera.position.set(0, 2.2, 7);
    camera.lookAt(0, 0, 0);

    const renderer = new THREE.WebGLRenderer({ antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);

    scene.add(new THREE.AmbientLight(0x334466, 0.6));
    const key = new THREE.PointLight(0xffffff, 1.1);
    key.position.set(4, 6, 5);
    scene.add(key);

    // 中央主幾何: 高分段 icosahedron，density 驅動頂點形變。
    const coreGeo = new THREE.IcosahedronGeometry(1.4, 6);
    const basePos = coreGeo.attributes.position.array.slice();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x3a7bd5,
      emissive: 0x101820,
      metalness: 0.3,
      roughness: 0.35,
      flatShading: false,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // 環繞 11 根柱狀 bar，代表各通道能量。
    const bars = [];
    const N = CH_ORDER.length;
    for (let i = 0; i < N; i++) {
      const geo = new THREE.BoxGeometry(0.22, 1, 0.22);
      const mat = new THREE.MeshStandardMaterial({ color: 0x4fd1c5, emissive: 0x061a17 });
      const bar = new THREE.Mesh(geo, mat);
      const ang = (i / N) * Math.PI * 2;
      const R = 3.1;
      bar.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      scene.add(bar);
      bars.push(bar);
    }

    // headless smoke test 觀測用: 暴露當前幾何狀態快照。
    if (typeof window !== "undefined") {
      window.__vizState = {
        frames: 0,
        coreScale: 1,
        emissiveIntensity: 0,
        hue: 0,
        deform: 0,
        barHeights: new Array(N).fill(0),
      };
    }

    let raf = 0;
    let t0 = performance.now();
    const tmp = new THREE.Vector3();

    function animate() {
      raf = requestAnimationFrame(animate);
      const p = paramsRef.current;
      const t = (performance.now() - t0) / 1000;

      let brightness = 0.4, density = 0.4, guidance = 3.0, cold = 0.5, warm = 0.5;
      let channels = null;
      if (p) {
        brightness = p.music?.brightness ?? brightness;
        density = p.music?.density ?? density;
        guidance = p.music?.guidance ?? guidance;
        cold = p.clusters?.cold ?? cold;
        warm = p.clusters?.warm ?? warm;
        channels = p.channels || null;
      }

      // core emissive 隨 brightness (Environment 光強)
      const emis = 0.15 + brightness * 1.4;
      coreMat.emissiveIntensity = emis;
      // 色相: cold(青藍 ~0.55) ↔ warm(橙紅 ~0.05)，依權重插值
      const warmFrac = warm / Math.max(1e-6, cold + warm);
      const hue = 0.55 - warmFrac * 0.5; // 0.55->0.05
      coreMat.color.setHSL(hue, 0.7, 0.5);
      coreMat.emissive.setHSL(hue, 0.8, 0.12 + brightness * 0.12);

      // density -> 頂點形變 (AI agency 密度)
      const deform = 0.05 + density * 0.6;
      const pos = coreGeo.attributes.position;
      for (let i = 0; i < pos.count; i++) {
        const bx = basePos[i * 3], by = basePos[i * 3 + 1], bz = basePos[i * 3 + 2];
        tmp.set(bx, by, bz);
        const n = Math.sin(bx * 3 + t * 2) * Math.cos(by * 3 + t * 1.7) * Math.sin(bz * 3 + t);
        const len = 1 + deform * n;
        pos.setXYZ(i, bx * len, by * len, bz * len);
      }
      pos.needsUpdate = true;
      coreGeo.computeVertexNormals();

      // guidance -> 旋轉速度
      const spin = 0.05 + (guidance / 6) * 0.4;
      core.rotation.y += spin * 0.02;
      core.rotation.x += spin * 0.008;

      // bars 高度 = 通道歸一化
      const heights = [];
      for (let i = 0; i < N; i++) {
        const ch = CH_ORDER[i];
        let v = 0.1;
        if (channels && channels[ch] != null) {
          v = Math.max(0, Math.min(1, channels[ch] / CH_RANGE[ch]));
        }
        const h = 0.2 + v * 3.2;
        bars[i].scale.y = h;
        bars[i].position.y = h / 2 - 0.5;
        bars[i].material.emissiveIntensity = 0.3 + v;
        bars[i].material.color.setHSL(hue, 0.6, 0.35 + v * 0.3);
        heights.push(Number(v.toFixed(4)));
      }

      if (window.__vizState) {
        window.__vizState.frames++;
        window.__vizState.coreScale = Number((1 + deform).toFixed(4));
        window.__vizState.emissiveIntensity = Number(emis.toFixed(4));
        window.__vizState.hue = Number(hue.toFixed(4));
        window.__vizState.deform = Number(deform.toFixed(4));
        window.__vizState.barHeights = heights;
      }

      renderer.render(scene, camera);
    }
    animate();

    function onResize() {
      const w = mount.clientWidth || 800;
      const h = mount.clientHeight || 500;
      camera.aspect = w / h;
      camera.updateProjectionMatrix();
      renderer.setSize(w, h);
    }
    window.addEventListener("resize", onResize);

    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      bars.forEach((b) => { b.geometry.dispose(); b.material.dispose(); });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [paramsRef]);

  return <div ref={mountRef} className="viz-canvas" />;
}
