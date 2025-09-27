import { useEffect, useState } from "react";

function loadKakaoOnce({ appkey, libraries = ["services","clusterer"] }) {
  // 중복 주입 방지
  if (window.__kakao_loader_promise) return window.__kakao_loader_promise;

  window.__kakao_loader_promise = new Promise((resolve, reject) => {
    if (window.kakao?.maps?.load) {
      window.kakao.maps.load(() => resolve("already"));
      return;
    }

    // 스크립트 생성
    const params = new URLSearchParams({
      appkey,
      autoload: "false",               
      libraries: libraries.join(","),
    });

    const src = `https://dapi.kakao.com/v2/maps/sdk.js?${params.toString()}`;
    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;

    s.onerror = (e) => {
      console.error("[KAKAO] script onerror:", e, "src:", src);
      reject(new Error("SDK script load error"));
    };

    s.onload = () => {
      if (!window.kakao?.maps?.load) {
        reject(new Error("kakao.maps.load missing"));
        return;
      }
      // 실제 SDK 초기화
      window.kakao.maps.load(() => {
        console.log("[KAKAO] loaded:", window.kakao?.maps?.VERSION);
        resolve("loaded");
      });
    };

    document.head.appendChild(s);
  });

  return window.__kakao_loader_promise;
}

export default function SafeKakaoProvider({ children }) {
  const [ready, setReady] = useState(false);
  const [err, setErr] = useState(null);

  useEffect(() => {
    const key = "cfd7264f6f0677bc208104d9cbc45701";  // JS키
    if (!key) {
      setErr(new Error("VITE_KAKAO_API_KEY missing"));
      return;
    }
    loadKakaoOnce({ appkey: key })
      .then(() => setReady(true))
      .catch((e) => setErr(e));
  }, []);

  if (err) {
    return (
      <div style={{ padding: 12, color: "crimson", whiteSpace: "pre-wrap" }}>
        Kakao SDK 로드 실패: {String(err)}{'\n'}
        - 키/도메인/네트워크 차단(AdBlock/방화벽) 확인{'\n'}
        - Network 탭에서 sdk.js 요청 상태코드 확인
      </div>
    );
  }
  if (!ready) return null; // 필요하면 스피너

  return children;
}
