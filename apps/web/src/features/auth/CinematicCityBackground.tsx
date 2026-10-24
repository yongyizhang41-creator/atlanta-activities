"use client";

import { useEffect, useRef, useState } from "react";
import { Pause, Play } from "lucide-react";

type Connection = EventTarget & { saveData?: boolean; effectiveType?: string };

function CityFilm({
  paused,
  onFailure,
}: {
  paused: boolean;
  onFailure: () => void;
}) {
  const ref = useRef<HTMLVideoElement>(null);
  const [ready, setReady] = useState(false);
  useEffect(() => {
    const video = ref.current;
    if (!video) return;
    let disposed = false;
    const sync = () => {
      if (paused || document.hidden) video.pause();
      else
        void video.play().catch(() => {
          if (!disposed) onFailure();
        });
    };
    sync();
    document.addEventListener("visibilitychange", sync);
    return () => {
      disposed = true;
      video.pause();
      document.removeEventListener("visibilitychange", sync);
    };
  }, [paused, onFailure]);
  // A stalled or unsupported resource must not leave an blank scene.
  useEffect(() => {
    if (ready) return;
    const timer = window.setTimeout(onFailure, 15000);
    return () => window.clearTimeout(timer);
  }, [ready, onFailure]);
  return (
    <div className="auth-video-frame">
      <video
        ref={ref}
        src="/videos/atlanta-night-film.mp4"
        poster="/videos/atlanta-night-film.jpg"
        autoPlay
        muted
        loop
        playsInline
        preload="auto"
        controls={false}
        disablePictureInPicture
        tabIndex={-1}
        data-ready={ready}
        onPlaying={() => setReady(true)}
        onError={onFailure}
      />
    </div>
  );
}

export default function CinematicCityBackground() {
  const [eligible, setEligible] = useState(false);
  const [failed, setFailed] = useState(false);
  const [paused, setPaused] = useState(false);
  const fail = useRef(() => setFailed(true)).current;
  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: no-preference)");
    const connection = (navigator as Navigator & { connection?: Connection })
      .connection;
    const cores = navigator.hardwareConcurrency;
    const update = () =>
      setEligible(
        media.matches &&
          !connection?.saveData &&
          !["slow-2g", "2g", "3g"].includes(connection?.effectiveType ?? "") &&
          (!cores || cores > 2),
      );
    update();
    media.addEventListener("change", update);
    connection?.addEventListener("change", update);
    return () => {
      media.removeEventListener("change", update);
      connection?.removeEventListener("change", update);
    };
  }, []);
  const active = eligible && !failed;
  return (
    <>
      <div
        className="auth-video-background"
        aria-hidden="true"
        data-mode={active ? "video" : "static"}
      >
        <div className="auth-video-poster" />
        {active && <CityFilm paused={paused} onFailure={fail} />}
        <div className="auth-video-wash" />
      </div>
      {active && (
        <button
          type="button"
          className="auth-motion-toggle"
          onClick={() => setPaused(!paused)}
          aria-pressed={paused}
        >
          {paused ? <Play size={13} /> : <Pause size={13} />}
          {paused ? "Play city scenes" : "Pause city scenes"}
        </button>
      )}
    </>
  );
}
