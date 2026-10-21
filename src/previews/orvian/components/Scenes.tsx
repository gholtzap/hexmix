"use client";

import Script from "next/script";
import { useEffect, useRef } from "react";

interface Scene { destroy(): void }
declare global {
  interface Window {
    UnicornStudio?: {
      addScene(options: { elementId: string; filePath: string; dpi: number; scale: number; fps: number; lazyLoad: boolean; altText: string }): Promise<Scene>;
    };
  }
}

export default function Scenes() {
  const scenes = useRef<Scene[]>([]);
  const started = useRef(false);
  useEffect(() => () => { scenes.current.forEach(scene => scene.destroy()); }, []);

  async function start() {
    if (started.current || !window.UnicornStudio) return;
    started.current = true;
    await Promise.all(Array.from(document.querySelectorAll<HTMLElement>("[data-scene]")).map(async element => {
      try {
        const scene = await window.UnicornStudio!.addScene({ elementId: element.id, filePath: `/scenes/${element.dataset.scene}.json`, dpi: 1.5, scale: 1, fps: 60, lazyLoad: true, altText: "Scene" });
        scenes.current.push(scene);
        element.dataset.sceneReady = "true";
      } catch (error) {
        element.dataset.sceneError = "true";
        console.error("Could not load the scene", error);
      }
    }));
  }

  return <Script src="/vendor/unicornStudio.umd.js" strategy="afterInteractive" onReady={() => { void start(); }} />;
}
