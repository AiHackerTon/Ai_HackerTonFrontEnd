// src/pages/MainPage.jsx
import React, { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import DoubleCheckModal from "../modal/DoubleCheckModal";
import styled from "styled-components";

// ✅ 통일된 API 베이스 (끝 슬래시 제거)
const API_BASE =
  import.meta?.env?.VITE_API_BASE?.replace(/\/$/, "") || "http://192.168.0.19:5000";

export default function MainPage() {
  const navigate = useNavigate();

  const [hearing, setHearing] = useState(false);
  const [lastText, setLastText] = useState("");
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [classifying, setClassifying] = useState(false);
  const [level, setLevel] = useState(0); // 0~1 mic level

  // SpeechRecognition
  const recRef = useRef(null);

  // Mic level refs
  const streamRef = useRef(null);
  const audioCtxRef = useRef(null);
  const analyserRef = useRef(null);
  const rafRef = useRef(null);

  /* =================== STT 시작/중지 =================== */
  const startSTT = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      alert("이 브라우저는 음성 인식을 지원하지 않아요.");
      return;
    }

    const rec = new SR();
    rec.lang = "ko-KR";
    rec.interimResults = false;
    rec.maxAlternatives = 1;

    rec.onresult = (e) => {
      const text = e.results?.[0]?.[0]?.transcript || "";
      setLastText(text);
      setIsModalOpen(true);
      console.log("[STT] 인식:", text);
    };

    rec.onend = () => setHearing(false);
    rec.onerror = (err) => {
      console.error("[STT] 오류:", err);
      setHearing(false);
    };

    recRef.current = rec;
    setHearing(true);
    setLastText("");
    rec.start();
  };

  const stopSTT = () => {
    try {
      recRef.current?.stop();
    } catch {}
  };

  /* =========== Mic Level: hearing 토글 시 WebAudio 관리 =========== */
  useEffect(() => {
    if (!hearing) {
      cleanupMic();
      setLevel(0);
      return;
    }
    startMicLevel();
    return cleanupMic;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hearing]);

  async function startMicLevel() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const AudioCtx = window.AudioContext || window.webkitAudioContext;
      const ctx = new AudioCtx();
      audioCtxRef.current = ctx;

      const source = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 1024;
      analyserRef.current = analyser;
      source.connect(analyser);

      const data = new Uint8Array(analyser.fftSize);

      const tick = () => {
        analyser.getByteTimeDomainData(data);

        // RMS
        let sum = 0;
        for (let i = 0; i < data.length; i++) {
          const v = (data[i] - 128) / 128;
          sum += v * v;
        }
        const rmsRaw = Math.sqrt(sum / data.length);

        // 노이즈 컷 + 정규화
        let lv = Math.max(0, (rmsRaw - 0.04) / 0.6);
        lv = Math.max(0, Math.min(1, lv));

        // 스무딩
        setLevel((prev) => prev + (lv - prev) * 0.35);

        rafRef.current = requestAnimationFrame(tick);
      };

      rafRef.current = requestAnimationFrame(tick);

      // iOS resume
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
      console.error("Mic level start error:", e);
    }
  }

  function cleanupMic() {
    if (rafRef.current) cancelAnimationFrame(rafRef.current);
    rafRef.current = null;

    if (audioCtxRef.current) {
      audioCtxRef.current.close().catch(() => {});
      audioCtxRef.current = null;
    }

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }
    analyserRef.current = null;
  }

  /* =================== AI 분류 호출 =================== */
  async function classifyDepartmentByAI(text) {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 15000);

    try {
      const resp = await fetch(`${API_BASE}/predict/`, {
        method: "POST",
        headers: {
          accept: "application/json",
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ symptoms: text }),
        mode: "cors",
        signal: controller.signal,
      });

      if (!resp.ok) {
        const body = await resp.text().catch(() => "");
        throw new Error(`HTTP ${resp.status}: ${resp.statusText} ${body}`);
      }
      const json = await resp.json();
      return json?.recommended_department ?? null;
    } catch (e) {
      console.error("AI 분류 실패:", e);
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  /* =================== 모달 핸들러 =================== */
  const handleConfirm = async () => {
    if (!lastText || classifying) return;
    try {
      setClassifying(true);
      const dept = await classifyDepartmentByAI(lastText);

      navigate("/hospitals", {
        state: { text: lastText, dept },
        replace: false,
      });
    } catch (e) {
      console.error(e);
      alert("분류 중 오류가 발생했어요. 잠시 후 다시 시도해주세요.");
    } finally {
      setClassifying(false);
      setIsModalOpen(false);
    }
  };

  const handleCancel = () => setIsModalOpen(false);

  /* =================== 렌더 =================== */
  return (
    <Page>
      <Center>
        <HeaderTitle>{hearing ? "듣는중입니다" : "증상을 말씀해주세요"}</HeaderTitle>

        <MicButton
          $hearing={hearing}
          onClick={hearing ? stopSTT : startSTT}
          aria-pressed={hearing}
          aria-label={hearing ? "듣기 중지" : "듣기 시작"}
        >
          {hearing ? <StopIcon /> : <MicIcon src="/assets/Mic.png" alt="마이크" />}
        </MicButton>

        {lastText && (
          <Card>
            <Label>마지막 인식: </Label>
            <Bold>{lastText}</Bold>
          </Card>
        )}
      </Center>

      {/* 오른쪽 초록 볼륨 바 */}
      <MeterWrap aria-hidden={!hearing}>
        <MeterTrack>
          <MeterFill style={{ height: `${Math.round(level * 100)}%` }} />
        </MeterTrack>
        <Dots>
          <Dot $on={level > 0.2} />
          <Dot $on={level > 0.35} />
          <Dot $on={level > 0.5} />
        </Dots>
      </MeterWrap>

      {/* 확인 모달 */}
      {isModalOpen && (
        <DoubleCheckModal
          open={isModalOpen}
          text={lastText}
          onConfirm={handleConfirm}
          onCancel={handleCancel}
          onclose={handleCancel}
          loading={classifying}
        />
      )}
    </Page>
  );
}

/* ================== styled ================== */
const Page = styled.div`
  min-height: 100dvh;
  display: grid;
  place-items: center;
  padding: 24px;
  position: relative;
`;

const HeaderTitle = styled.div`
  display: flex;
  justify-content: center;
  align-items: center;
  margin-bottom: 70px;
  font-weight: 600;
  font-size: 30px;
`;

const Center = styled.div`
  width: 100%;
  max-width: 520px;
  text-align: center;
`;

const MicIcon = styled.img`
  width: 70px;
  height: 70px;
`;

const StopIcon = styled.div`
  width: 70px;
  height: 70px;
  border-radius: 15px;
  background-color: white;
`;

const MicButton = styled.button`
  width: 300px;
  height: 300px;
  border-radius: 50%;
  border: none;
  color: #fff;
  font-size: 18px;
  cursor: pointer;
  transition: transform 0.15s ease, background 0.2s ease;
  background: ${({ $hearing }) => ($hearing ? "#ff4d4f" : "#5a93c8")};
  margin-bottom: 250px;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  margin-left: 20px;

  &:active {
    transform: scale(0.98);
  }
`;

const Card = styled.div`
  margin-top: 16px;
  padding: 12px;
  border: 1px solid #eee;
  border-radius: 12px;
  background: #fff;
  text-align: left;
`;

const Label = styled.span`
  opacity: 0.85;
`;

const Bold = styled.b`
  word-break: break-all;
`;

/* ---- 오른쪽 볼륨 미터 ---- */
const MeterWrap = styled.div`
  position: fixed;
  right: 12px;
  bottom: 130px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 6px;
  z-index: 30;
  pointer-events: none;
`;

const MeterTrack = styled.div`
  width: 30px;
  height: 200px;
  border-radius: 999px;
  background: #e8f5e9;
  overflow: hidden;
  box-shadow: inset 0 0 0 1px rgba(0, 0, 0, 0.06);
`;

const MeterFill = styled.div`
  width: 100%;
  height: 0%;
  background: #21c35e;
  transition: height 60ms linear;
`;

const Dots = styled.div`
  display: flex;
  gap: 6px;
  margin-top: 4px;
`;

const Dot = styled.div`
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: ${({ $on }) => ($on ? "#21c35e" : "#a5d6a7")};
  transition: background 120ms ease;
`;

/* ---- 우상단 알람(리마인더) 버튼 ---- */
const AlarmFab = styled.button`
  position: fixed;
  top: 16px;
  right: 16px;
  width: 56px;
  height: 56px;
  border-radius: 50%;
  border: none;
  background: #111827;
  display: grid;
  place-items: center;
  cursor: pointer;
  box-shadow: 0 10px 24px rgba(0,0,0,0.2);
  z-index: 50;

  &:hover { opacity: .9; }
  &:active { transform: scale(.98); }
`;

const AlarmIcon = styled.img`
  width: 26px;
  height: 26px;
  filter: invert(1);
`;
