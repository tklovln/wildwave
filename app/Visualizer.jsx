"use client";

import { useEffect, useRef } from "react";
import * as THREE from "three";

// 11 通道 (F1-F8 冷/暖光譜 + Clear/NIR/Flicker) 驅動一個可互動的 3D 幾何體。
//  互動:
//   - 拖曳 -> 環繞旋轉 (帶阻尼 + 放開慣性), 閒置時自動緩轉
//   - 懸停光譜柱 -> 該通道抬升發亮 + HUD 標籤顯示名稱與即時強度
//   - 點擊 -> 從核心射出擴散光環 (ripple) + 核心脈動
//   - 指標視差 -> 鏡頭隨滑鼠輕微偏移
//  資料映射:
//   - music.brightness -> 核心 emissive 亮度 + 粒子亮度
//   - music.density     -> 核心頂點形變量
//   - clusters.cold/warm -> 核心色相冷↔暖插值
//   - guidance          -> 自動旋轉基礎速度
// 提供 window.__vizState 供 headless smoke test 讀取幾何狀態。

const CH_ORDER = [
  "F1", "F2", "F3", "F4", "F5", "F6", "F7", "F8",
  "Clear", "NIR", "Flicker",
];
const CH_RANGE = 65535;
// 各通道中心波長 (nm)；Clear/NIR/Flicker 給代表色。
const CH_WAVELENGTH = {
  F1: 415, F2: 445, F3: 480, F4: 515,
  F5: 555, F6: 590, F7: 630, F8: 680,
};
const CH_LABEL = {
  F1: "F1 · 415nm", F2: "F2 · 445nm", F3: "F3 · 480nm", F4: "F4 · 515nm",
  F5: "F5 · 555nm", F6: "F6 · 590nm", F7: "F7 · 630nm", F8: "F8 · 680nm",
  Clear: "Clear · 全光", NIR: "NIR · 近紅外", Flicker: "Flicker · 閃爍",
};

// 可見光波長 (380-700nm) 近似轉 RGB。
function wavelengthToColor(wl) {
  let r = 0, g = 0, b = 0;
  if (wl >= 380 && wl < 440) { r = -(wl - 440) / 60; b = 1; }
  else if (wl < 490) { g = (wl - 440) / 50; b = 1; }
  else if (wl < 510) { g = 1; b = -(wl - 510) / 20; }
  else if (wl < 580) { r = (wl - 510) / 70; g = 1; }
  else if (wl < 645) { r = 1; g = -(wl - 645) / 65; }
  else if (wl <= 700) { r = 1; }
  else { r = 1; }
  return new THREE.Color(
    Math.max(0.05, r),
    Math.max(0.05, g),
    Math.max(0.05, b)
  );
}

function channelColor(ch) {
  if (CH_WAVELENGTH[ch]) return wavelengthToColor(CH_WAVELENGTH[ch]);
  if (ch === "Clear") return new THREE.Color(0.9, 0.94, 1.0);
  if (ch === "NIR") return new THREE.Color(0.55, 0.08, 0.08);
  return new THREE.Color(0.7, 0.55, 0.95); // Flicker
}

export default function Visualizer({ paramsRef }) {
  const mountRef = useRef(null);
  const labelRef = useRef(null);

  useEffect(() => {
    const mount = mountRef.current;
    if (!mount) return;

    const width = mount.clientWidth || 800;
    const height = mount.clientHeight || 500;

    // 背景跟隨頁面主題 (讀 --c-bg)；深/淺切換時即時更新。
    const readVar = (name, fallback) => {
      if (typeof window === "undefined") return fallback;
      const v = getComputedStyle(document.body).getPropertyValue(name).trim();
      return v || fallback;
    };
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(readVar("--c-bg", "#fdfdfc"));
    scene.fog = new THREE.FogExp2(new THREE.Color(readVar("--c-bg", "#fdfdfc")).getHex(), 0.045);

    const camera = new THREE.PerspectiveCamera(55, width / height, 0.1, 100);

    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: false });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setSize(width, height);
    mount.appendChild(renderer.domElement);
    renderer.domElement.style.touchAction = "none";
    renderer.domElement.style.cursor = "grab";

    scene.add(new THREE.AmbientLight(0xb8c0cc, 0.85));
    const key = new THREE.PointLight(0xffffff, 1.1);
    key.position.set(4, 6, 5);
    scene.add(key);
    const rim = new THREE.PointLight(0x4fd1c5, 0.45);
    rim.position.set(-5, -2, -4);
    scene.add(rim);

    // ---- 中央主幾何 ----
    const coreGeo = new THREE.IcosahedronGeometry(1.4, 6);
    const basePos = coreGeo.attributes.position.array.slice();
    const coreMat = new THREE.MeshStandardMaterial({
      color: 0x3a7bd5,
      emissive: 0x101820,
      metalness: 0.3,
      roughness: 0.35,
    });
    const core = new THREE.Mesh(coreGeo, coreMat);
    scene.add(core);

    // 半透明線框外殼，增加科技感
    const wireMat = new THREE.MeshBasicMaterial({
      color: 0x4fd1c5,
      wireframe: true,
      transparent: true,
      opacity: 0.08,
    });
    const wire = new THREE.Mesh(new THREE.IcosahedronGeometry(1.75, 2), wireMat);
    scene.add(wire);

    // ---- 環繞 11 根光譜柱 ----
    const bars = [];
    const barBaseColors = [];
    const N = CH_ORDER.length;
    const R = 3.1;
    for (let i = 0; i < N; i++) {
      const geo = new THREE.BoxGeometry(0.24, 1, 0.24);
      const col = channelColor(CH_ORDER[i]);
      barBaseColors.push(col);
      const mat = new THREE.MeshStandardMaterial({
        color: col.clone(),
        emissive: col.clone().multiplyScalar(0.25),
        metalness: 0.2,
        roughness: 0.45,
      });
      const bar = new THREE.Mesh(geo, mat);
      const ang = (i / N) * Math.PI * 2;
      bar.position.set(Math.cos(ang) * R, 0, Math.sin(ang) * R);
      bar.userData.index = i;
      scene.add(bar);
      bars.push(bar);
    }

    // ---- 粒子場 (brightness 驅動) ----
    const PCOUNT = 320;
    const pGeo = new THREE.BufferGeometry();
    const pArr = new Float32Array(PCOUNT * 3);
    for (let i = 0; i < PCOUNT; i++) {
      const rr = 5 + Math.random() * 5;
      const th = Math.random() * Math.PI * 2;
      const ph = Math.acos(2 * Math.random() - 1);
      pArr[i * 3] = rr * Math.sin(ph) * Math.cos(th);
      pArr[i * 3 + 1] = rr * Math.cos(ph) * 0.6;
      pArr[i * 3 + 2] = rr * Math.sin(ph) * Math.sin(th);
    }
    pGeo.setAttribute("position", new THREE.BufferAttribute(pArr, 3));
    const pMat = new THREE.PointsMaterial({
      color: 0x5b86a8,
      size: 0.05,
      transparent: true,
      opacity: 0.35,
      depthWrite: false,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // 主題切換時同步 3D 背景 / 霧 / 粒子色
    function applyTheme() {
      const bg = new THREE.Color(readVar("--c-bg", "#fdfdfc"));
      scene.background = bg;
      scene.fog.color.copy(bg);
      pMat.color = new THREE.Color(readVar("--c-blu", "#5b86a8"));
    }
    applyTheme();
    const themeObs = new MutationObserver(applyTheme);
    themeObs.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ["data-theme"],
    });

    // ---- 點擊漣漪 ----
    const ripples = [];
    function spawnRipple(hue) {
      const geo = new THREE.RingGeometry(0.1, 0.16, 64);
      const mat = new THREE.MeshBasicMaterial({
        color: new THREE.Color().setHSL(hue, 0.7, 0.6),
        transparent: true,
        opacity: 0.8,
        side: THREE.DoubleSide,
      });
      const ring = new THREE.Mesh(geo, mat);
      ring.rotation.x = Math.PI / 2;
      scene.add(ring);
      ripples.push({ mesh: ring, life: 0 });
    }

    // ---- 互動狀態 ----
    let az = 0.6, azTarget = 0.6, azVel = 0;
    let pol = 1.05, polTarget = 1.05;
    const radius = 7.4;
    let dragging = false;
    let lastX = 0, lastY = 0;
    let parallaxX = 0, parallaxY = 0;
    let pointerNdc = null; // {x,y} for raycasting hover
    let pointerClient = { x: 0, y: 0 };
    let hovered = -1;
    let corePulse = 0;

    const raycaster = new THREE.Raycaster();

    function getRect() { return renderer.domElement.getBoundingClientRect(); }

    function onPointerDown(e) {
      dragging = true;
      lastX = e.clientX; lastY = e.clientY;
      renderer.domElement.style.cursor = "grabbing";
      renderer.domElement.setPointerCapture?.(e.pointerId);
    }
    function onPointerMove(e) {
      const rect = getRect();
      pointerClient = { x: e.clientX - rect.left, y: e.clientY - rect.top };
      pointerNdc = {
        x: (pointerClient.x / rect.width) * 2 - 1,
        y: -(pointerClient.y / rect.height) * 2 + 1,
      };
      // 視差 (歸一化 -1..1)
      parallaxX = pointerNdc.x;
      parallaxY = pointerNdc.y;
      if (dragging) {
        const dx = e.clientX - lastX;
        const dy = e.clientY - lastY;
        lastX = e.clientX; lastY = e.clientY;
        azVel = -dx * 0.005;
        azTarget += azVel;
        polTarget = Math.min(1.45, Math.max(0.4, polTarget - dy * 0.005));
      }
    }
    function onPointerUp(e) {
      dragging = false;
      renderer.domElement.style.cursor = "grab";
      renderer.domElement.releasePointerCapture?.(e.pointerId);
    }
    function onLeave() { pointerNdc = null; parallaxX = 0; parallaxY = 0; }
    function onClick() {
      // 只有非拖曳的點擊才迸發 (拖曳位移大時忽略)
      const hue = coreMat.color.getHSL({}).h;
      spawnRipple(hue);
      corePulse = 1;
    }

    const el = renderer.domElement;
    el.addEventListener("pointerdown", onPointerDown);
    el.addEventListener("pointermove", onPointerMove);
    el.addEventListener("pointerup", onPointerUp);
    el.addEventListener("pointerleave", onLeave);
    el.addEventListener("click", onClick);

    if (typeof window !== "undefined") {
      window.__vizState = {
        frames: 0, coreScale: 1, emissiveIntensity: 0,
        hue: 0, deform: 0, barHeights: new Array(N).fill(0),
      };
    }

    let raf = 0;
    const t0 = performance.now();
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

      // 閒置自動旋轉 (速度隨 guidance)；拖曳時暫停自轉
      if (!dragging) {
        azTarget += (0.04 + (guidance / 6) * 0.12) * 0.016;
        azVel *= 0.92; // 慣性衰減
      }
      az += (azTarget - az) * 0.12;
      pol += (polTarget - pol) * 0.12;

      // 相機 (球座標 + 視差)
      const px = parallaxX * 0.6;
      const py = parallaxY * 0.4;
      camera.position.set(
        radius * Math.sin(pol) * Math.sin(az) + px,
        radius * Math.cos(pol) + py,
        radius * Math.sin(pol) * Math.cos(az)
      );
      camera.lookAt(0, 0, 0);

      // 核心亮度 / 色相
      const pulseBoost = corePulse * 0.4;
      coreMat.emissiveIntensity = 0.15 + brightness * 1.4 + pulseBoost;
      const warmFrac = warm / Math.max(1e-6, cold + warm);
      const hue = 0.55 - warmFrac * 0.5;
      coreMat.color.setHSL(hue, 0.7, 0.5);
      coreMat.emissive.setHSL(hue, 0.8, 0.12 + brightness * 0.12);
      wireMat.color.setHSL(hue, 0.6, 0.6);
      wireMat.opacity = 0.06 + brightness * 0.1;

      // 頂點形變
      const deform = 0.05 + density * 0.6 + corePulse * 0.25;
      const posAttr = coreGeo.attributes.position;
      for (let i = 0; i < posAttr.count; i++) {
        const bx = basePos[i * 3], by = basePos[i * 3 + 1], bz = basePos[i * 3 + 2];
        tmp.set(bx, by, bz);
        const n = Math.sin(bx * 3 + t * 2) * Math.cos(by * 3 + t * 1.7) * Math.sin(bz * 3 + t);
        const len = 1 + deform * n;
        posAttr.setXYZ(i, bx * len, by * len, bz * len);
      }
      posAttr.needsUpdate = true;
      coreGeo.computeVertexNormals();
      corePulse *= 0.92;

      const scalePulse = 1 + corePulse * 0.12;
      core.scale.setScalar(scalePulse);
      wire.rotation.y -= 0.0015;
      wire.rotation.x += 0.0008;

      // 粒子隨 brightness 明滅 + 緩轉
      particles.rotation.y += 0.0006;
      pMat.opacity = 0.25 + brightness * 0.5;

      // ---- Hover raycasting ----
      let newHover = -1;
      if (pointerNdc && !dragging) {
        raycaster.setFromCamera(pointerNdc, camera);
        const hits = raycaster.intersectObjects(bars, false);
        if (hits.length) newHover = hits[0].object.userData.index;
      }
      hovered = newHover;
      el.style.cursor = dragging ? "grabbing" : hovered >= 0 ? "pointer" : "grab";

      // ---- Bars ----
      const heights = [];
      for (let i = 0; i < N; i++) {
        const ch = CH_ORDER[i];
        let v = 0.1;
        if (channels && channels[ch] != null) {
          v = Math.max(0, Math.min(1, channels[ch] / CH_RANGE));
        }
        const isHov = i === hovered;
        const h = 0.2 + v * 3.2 + (isHov ? 0.6 : 0);
        // 平滑抵達
        bars[i].scale.y += (h - bars[i].scale.y) * 0.25;
        bars[i].position.y = bars[i].scale.y / 2 - 0.5;
        const base = barBaseColors[i];
        bars[i].material.emissiveIntensity = 0.25 + v + (isHov ? 1.2 : 0);
        bars[i].material.emissive.copy(base).multiplyScalar(isHov ? 0.9 : 0.3 + v * 0.4);
        const targetScaleXZ = isHov ? 1.4 : 1;
        bars[i].scale.x += (targetScaleXZ - bars[i].scale.x) * 0.25;
        bars[i].scale.z += (targetScaleXZ - bars[i].scale.z) * 0.25;
        heights.push(Number(v.toFixed(4)));
      }

      // ---- HUD 標籤 ----
      const label = labelRef.current;
      if (label) {
        if (hovered >= 0) {
          const ch = CH_ORDER[hovered];
          const v = heights[hovered];
          label.style.opacity = "1";
          label.style.transform = `translate(${pointerClient.x + 14}px, ${pointerClient.y + 14}px)`;
          label.innerHTML =
            `<span class="viz-hud-name">${CH_LABEL[ch]}</span>` +
            `<span class="viz-hud-val">${(v * 100).toFixed(0)}%</span>`;
          const c = barBaseColors[hovered];
          label.style.borderColor = `rgb(${(c.r * 255) | 0},${(c.g * 255) | 0},${(c.b * 255) | 0})`;
        } else {
          label.style.opacity = "0";
        }
      }

      // ---- Ripples ----
      for (let i = ripples.length - 1; i >= 0; i--) {
        const rp = ripples[i];
        rp.life += 0.02;
        const s = 1 + rp.life * 10;
        rp.mesh.scale.set(s, s, s);
        rp.mesh.material.opacity = Math.max(0, 0.8 * (1 - rp.life));
        if (rp.life >= 1) {
          scene.remove(rp.mesh);
          rp.mesh.geometry.dispose();
          rp.mesh.material.dispose();
          ripples.splice(i, 1);
        }
      }

      if (window.__vizState) {
        window.__vizState.frames++;
        window.__vizState.coreScale = Number((1 + deform).toFixed(4));
        window.__vizState.emissiveIntensity = Number(coreMat.emissiveIntensity.toFixed(4));
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
      themeObs.disconnect();
      window.removeEventListener("resize", onResize);
      el.removeEventListener("pointerdown", onPointerDown);
      el.removeEventListener("pointermove", onPointerMove);
      el.removeEventListener("pointerup", onPointerUp);
      el.removeEventListener("pointerleave", onLeave);
      el.removeEventListener("click", onClick);
      renderer.dispose();
      coreGeo.dispose();
      coreMat.dispose();
      wire.geometry.dispose();
      wireMat.dispose();
      pGeo.dispose();
      pMat.dispose();
      ripples.forEach((rp) => { rp.mesh.geometry.dispose(); rp.mesh.material.dispose(); });
      bars.forEach((b) => { b.geometry.dispose(); b.material.dispose(); });
      if (mount.contains(renderer.domElement)) mount.removeChild(renderer.domElement);
    };
  }, [paramsRef]);

  return (
    <div className="viz-wrap">
      <div ref={mountRef} className="viz-canvas" />
      <div ref={labelRef} className="viz-hud" />
      <div className="viz-hint">
        <span>拖曳環繞</span>
        <span>懸停查看通道</span>
        <span>點擊迸發</span>
      </div>
    </div>
  );
}
