import { useEffect, useRef, useState } from "react";
import styled from "styled-components";

// ------- styled -------
const Wrap = styled.div`
  position: fixed;
  right: 12px;
  bottom: 84px; /* Footer 위로 살짝 띄움 */
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  pointer-events: none;
  z-index: 30;
`;

const BarWrap = styled.div`
  width: 10px;
  height: 140px;
  border-radius: 999px;
  background: #e8f5e9; /* 연한 초록 배경 */
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0,0,0,0.06);
`;

const Fill = styled.div`
  width: 100%;
  height: ${({ $h }) => `${$h}%`}; /* 0~100 */
  background: #21c35e;
  transition: height 60ms linear;
`;

const Dot = styled.div`
  width: 8px; height: 8px; border-radius: 50%;
  background: ${({ $on }) => ($on ? "#21c35e" : "#a5d6a7")};
  transition: background 120ms ease;
`;

// ------- logic -------
export default function MicLevel({ listening }) {
  const [level, setLevel] = useState(0);       // 0~1
  const [beat, setBeat]   = useState(false);   // 점멸
  const streamRef = useRef(null);
  const audioRef  = useRef(null);
  const analyserRef = useRef(null);
  const rafRef   = useRef(null);

  useEffect(() => {
    if (!listening) {
      stopAll();
      setLevel(0);
      return;
    }
    startAll();
    return stopAll;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [listening]);

  async function startAll() {
    try {
      // 별도 마이크 스트림 확보 (SpeechRecognition과 병행)
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioRef.current = ctx;

      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024; // 짧고 빠르게
      analyserRef.current = analyser;

      src.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);
      let lastPeak = 0;

      const tick = () => {
        analyser.getByteTimeDomainData(data);
        // 시간영역 RMS 계산
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128; // -1 ~ 1
          sum += v * v;
        }
        const rms = Math.sqrt(sum / data.length); // 0~1
        // 부드러운 감쇠 (peak hold)
        const now = performance.now();
        const decayMs = 30;
        // 기본 레벨
        let lv = rms;
        // 간단한 peak 감지 (박동 점멸)
        if (rms > 0.25 && now - lastPeak > 220) {
          setBeat((b) => !b);
          lastPeak = now;
        }
        // 가청 가중치(작은 소리 억제)
        lv = Math.max(0, (lv - 0.04) / 1.2); // 노이즈 컷

        // 0~1 clamp & 부드럽게
        setLevel((prev) => {
          const target = Math.max(0, Math.min(1, lv));
          // 약간의 스무딩
          return prev + (target - prev) * 0.35;
        });

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);

      // iOS AudioContext resume
      if (ctx.state === "suspended") {
        const resumeOnce = () => {
          ctx.resume();
          window.removeEventListener("touchend", resumeOnce);
          window.removeEventListener("click", resumeOnce);
        };
        window.addEventListener("touchend", resumeOnce);
        window.addEventListener("click", resumeOnce);
      }
    } catch (e) {
      console.error("MicLevel start error:", e);
    }
  }

  function stopAll() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (audioRef.current) {
      audioRef.current.close().catch(() => {});
      audioRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
  }

  const heightPct = Math.round(level * 100);

  return (
    <Wrap aria-hidden={!listening}>
      <BarWrap>
        <Fill $h={heightPct} />
      </BarWrap>
      {/* 작은 점 3개로 말 입력중 피드백 */}
      <div style={{ display:"flex", gap:6, marginTop:4 }}>
        <Dot $on={beat} />
        <Dot $on={!beat} />
        <Dot $on={beat} />
      </div>
    </Wrap>
  );
}
