import { useEffect, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import styled from "styled-components";

const API_BASE =
  import.meta?.env?.VITE_API_BASE?.replace(/\/$/, "") || "http://127.0.0.1:5000";

// JSON을 사람이 읽을 수 있는 텍스트로 변환 (text 필드가 없을 때 폴백)
function toReadableText(data) {
  try {
    if (!data || typeof data !== "object") return String(data ?? "");
    const lines = [];
    for (const [k, v] of Object.entries(data)) {
      if (Array.isArray(v)) {
        lines.push(`${k}: ${v.map(x => (typeof x === "object" ? JSON.stringify(x) : String(x))).join(", ")}`);
      } else if (v && typeof v === "object") {
        lines.push(`${k}: ${JSON.stringify(v, null, 2)}`);
      } else {
        lines.push(`${k}: ${v}`);
      }
    }
    return lines.join("\n");
  } catch {
    return JSON.stringify(data, null, 2);
  }
}

export default function CameraPage() {
  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const fileInputRef = useRef(null);

  const [busy, setBusy] = useState(false);
  // 0: 처방전 촬영/업로드, 1: 복용지침서 촬영/업로드
  const [step, setStep] = useState(0);

  // 읽기용 텍스트 결과: [처방전, 복용지침서]
  const [ocrResults, setOcrResults] = useState(["", ""]);
  // 원본 JSON 보관(선택): [처방전JSON, 복용지침서JSON]
  const [payloads, setPayloads] = useState([null, null]);

  const nav = useNavigate();

  // 카메라 켜기
  useEffect(() => {
    let stream;
    (async () => {
      try {
        console.log("[Camera] getUserMedia 호출");
        stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: "environment" }, audio: false,
        });
        if (videoRef.current) videoRef.current.srcObject = stream;
        console.log("[Camera] 스트림 연결 완료");
      } catch (e) {
        console.error("[Camera] 권한/장치 오류:", e);
        // 카메라 권한이 없어도 업로드로 진행 가능하므로 alert만 표시
        alert("카메라 권한을 확인해주세요. (우측 상단 '업로드'로도 진행 가능합니다)");
      }
    })();
    return () => stream && stream.getTracks().forEach((t) => t.stop());
  }, []);

  // 현재 프레임 캡처 → Blob(JPEG)
  const captureBlob = async () => {
    const video = videoRef.current;
    const canvas = canvasRef.current;
    if (!video || !canvas) throw new Error("카메라 또는 캔버스가 준비되지 않았습니다.");

    canvas.width = video.videoWidth || 1280;
    canvas.height = video.videoHeight || 720;

    const ctx = canvas.getContext("2d");
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const blob = await new Promise((res) => canvas.toBlob(res, "image/jpeg", 0.92));
    if (!blob) throw new Error("이미지 캡처에 실패했습니다.");
    return blob;
  };

  // 공통 OCR 호출
  const postOcr = async (fileOrBlob) => {
    const form = new FormData();
    // 백엔드 스펙: formData key는 image
    form.append("image", fileOrBlob, fileOrBlob.name || "capture.jpg");

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 20000);

    try {
      console.log("[OCR] 업로드 시작:", `${API_BASE}/ocr`);
      const resp = await fetch(`${API_BASE}/ocr`, {
        method: "POST",
        body: form,
        signal: controller.signal,
      });
      console.log("[OCR] 응답 상태:", resp.status);
      if (!resp.ok) {
        const text = await resp.text().catch(() => "");
        console.error("[OCR] 실패 본문:", text);
        throw new Error(`OCR 요청 실패(${resp.status})`);
      }
      const json = await resp.json();
      console.log("[OCR] 성공 JSON:", json);
      return json; // { text?: string, ... }
    } finally {
      clearTimeout(timer);
    }
  };

  // 공통: OCR 응답을 상태/다음 단계로 반영
  const consumeOcrJson = (json) => {
    const textValue =
      (typeof json?.text === "string" && json.text.trim().length > 0)
        ? json.text
        : toReadableText(json);

    const nextTexts = [...ocrResults];
    nextTexts[step] = textValue;

    const nextPayloads = [...payloads];
    nextPayloads[step] = json;

    console.log("[OCR] consume → nextTexts:", nextTexts);

    if (step === 0) {
      setOcrResults(nextTexts);
      setPayloads(nextPayloads);
      setStep(1); // 복용지침서 단계로 전환
      console.log("[Shoot/Upload] 다음 단계로 전환 → 1(복용지침서)");
    } else {
      // 두 장 완료 → 결과 페이지
      setOcrResults(nextTexts);
      setPayloads(nextPayloads);
      console.log("[Shoot/Upload] 두 장 완료, /result 이동 시도");
      setTimeout(() => {
        nav("/result", { state: { texts: nextTexts, payloads: nextPayloads } });
      }, 0);
    }
  };

  // 촬영 버튼: 비디오 캡처 → OCR
  const shootAndSend = async () => {
    if (busy) return;
    setBusy(true);
    console.log("[Shoot] 단계:", step);

    try {
      const blob = await captureBlob();
      const json = await postOcr(blob);
      consumeOcrJson(json);
    } catch (e) {
      console.error("[Shoot] 오류:", e);
      alert(
        e.name === "AbortError"
          ? "요청이 시간 초과되었습니다. 네트워크 상태를 확인해주세요."
          : `OCR 중 오류가 발생했어요.\n${e.message ?? ""}`
      );
    } finally {
      setBusy(false);
    }
  };

  // 업로드 버튼 클릭 → 숨김 input 트리거
  const onClickUpload = () => {
    if (busy) return;
    fileInputRef.current?.click();
  };

  // 파일 선택 처리 → OCR
  const onFileChange = async (e) => {
    const file = e.target.files?.[0];
    e.target.value = ""; // 같은 파일 재선택 가능하도록 리셋
    if (!file) return;

    // 기본 검증 (필요시 사이즈 제한)
    const maxMB = 20;
    if (file.size > maxMB * 1024 * 1024) {
      return alert(`파일이 너무 큽니다. ${maxMB}MB 이하로 업로드해주세요.`);
    }

    setBusy(true);
    console.log("[Upload] 단계:", step, "파일:", file.name, file.type, file.size);

    try {
      // 이미지 외에 PDF도 그대로 전송 (백엔드가 지원해야 함)
      // 미지원이면 백엔드에서 4xx/5xx 반환 → 위 postOcr에서 감지
      const json = await postOcr(file);
      consumeOcrJson(json);
    } catch (e) {
      console.error("[Upload] 오류:", e);
      alert(
        e.name === "AbortError"
          ? "요청이 시간 초과되었습니다. 네트워크 상태를 확인해주세요."
          : `업로드 OCR 중 오류가 발생했어요.\n${e.message ?? ""}`
      );
    } finally {
      setBusy(false);
    }
  };

  const instruction =
    step === 0 ? "① 처방전을 화면에 가득 차게 맞추고 촬영해주세요."
               : "② 복약안내문(복용지침서)을 화면에 가득차게 맞추고 촬영해주세요.";

  return (
    <div style={{ position: "relative", width: "100%", height: "80dvh", background: "black", overflow: "hidden" }}>
      {/* 상단 안내 배너 */}
      <TopGuide>{instruction}</TopGuide>

      {/* 우측 상단 업로드 버튼 + 숨김 파일 입력 */}
      <TopRightWrap>
        <UploadButton onClick={onClickUpload} disabled={busy} aria-label="파일 업로드">
          업로드
        </UploadButton>
        <HiddenFileInput
          ref={fileInputRef}
          type="file"
          // 사진 말고도 → 이미지 전반 + PDF 허용 (필요 시 더 확장 가능)
          accept="image/*,.pdf"
          onChange={onFileChange}
        />
      </TopRightWrap>

      <video
        ref={videoRef}
        autoPlay
        playsInline
        muted
        style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }}
      />
      <canvas ref={canvasRef} style={{ display: "none" }} />

      {/* 하단 중앙 촬영 버튼 */}
      <BottomCenter>
        <ShotButton onClick={shootAndSend} disabled={busy} aria-label="촬영">
          <CameraIcon src="/assets/Camera.png" alt="촬영" />
        </ShotButton>
        <StepHint>{step === 0 ? "처방전 단계" : "복용지침서 단계"} {busy ? "… 처리 중" : ""}</StepHint>
      </BottomCenter>

      {/* 촬영/업로드 중 오버레이 */}
      {busy && (
        <div style={{ position: "absolute", inset: 0, background: "rgba(0,0,0,0.35)", display: "grid", placeItems: "center", color: "white", fontWeight: 600, zIndex: 9 }}>
          분석 중…
        </div>
      )}
    </div>
  );
}

/* styled-components */
const ShotButton = styled.button`
  width: 100px; height: 100px; border-radius: 50%;
  border: 6px solid rgba(255,255,255,0.6); background: #fff;
  box-shadow: 0 8px 24px rgba(0,0,0,0.35); cursor: pointer;
  &:disabled { background: rgba(255,255,255,0.6); cursor: not-allowed; }
`;
const CameraIcon = styled.img` width: 50px; height: 50px; `;

const TopGuide = styled.div`
  position: absolute; top: env(safe-area-inset-top); left: 0; right: 0; z-index: 10;
  background: rgba(0,0,0,0.45); color: #fff; padding: 10px 14px; font-weight: 600;
  text-align: center; backdrop-filter: blur(2px);
`;

// 우측 상단 업로드 박스
const TopRightWrap = styled.div`
  position: absolute;
  top: calc(env(safe-area-inset-top) + 10px);
  right: 12px;
  z-index: 11;
  display: flex;
  align-items: center;
  gap: 8px;
`;

const UploadButton = styled.button`
  padding: 8px 12px;
  border-radius: 10px;
  border: 1px solid rgba(255,255,255,0.7);
  background: rgba(0,0,0,0.45);
  color: #fff;
  font-weight: 700;
  cursor: pointer;
  backdrop-filter: blur(2px);
  &:disabled {
    opacity: 0.6;
    cursor: not-allowed;
  }
`;

const HiddenFileInput = styled.input`
  display: none;
`;

const BottomCenter = styled.div`
  position: absolute;
  left: 50%;
  transform: translateX(-50%);
  bottom: calc(env(safe-area-inset-bottom) + 24px);
  z-index: 10;
  text-align: center;
`;

const StepHint = styled.div`
  margin-top: 8px; text-align: center; color: #fff; font-weight: 600;
  text-shadow: 0 1px 2px rgba(0,0,0,0.6);
`;
