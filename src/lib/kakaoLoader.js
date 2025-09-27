// src/lib/kakaoLoader.js
let kakaoLoadPromise = null;

export function loadKakaoSDK(
  appkey,
  { libraries = ["services", "clusterer"], url = "https://dapi.kakao.com/v2/maps/sdk.js" } = {}
) {
  const mask = (k) => (k ? k.slice(0, 6) + "***" : k);

  // 이미 준비된 경우
  if (window.kakao?.maps?.Map && window.kakao?.maps?.LatLng) {
    console.log("[KAKAO] already ready:", window.kakao.maps.VERSION);
    return Promise.resolve();
  }
  // maps.load만 있는 경우
  if (window.kakao?.maps?.load) {
    console.log("[KAKAO] maps.load present, calling now");
    return new Promise((resolve) => window.kakao.maps.load(() => resolve()));
  }
  // 진행 중이면 재사용
  if (kakaoLoadPromise) {
    console.log("[KAKAO] reuse loader promise");
    return kakaoLoadPromise;
  }

  kakaoLoadPromise = new Promise((resolve, reject) => {
    if (!appkey) {
      reject(new Error("VITE_KAKAO_API_KEY missing"));
      return;
    }

    const params = new URLSearchParams({
      appkey,
      autoload: "false", // SPA 안전
      libraries: libraries.join(","),
    });
    const src = `${url}?${params.toString()}`;
    console.log("[KAKAO] inject:", src.replace(appkey, mask(appkey)));

    const s = document.createElement("script");
    s.src = src;
    s.async = true;
    s.defer = true;

    let settled = false;
    const settleOk = () => {
      if (!settled) {
        settled = true;
        console.log("[KAKAO] ready ✅");
        resolve();
      }
    };
    const settleErr = (why) => {
      if (!settled) {
        settled = true;
        kakaoLoadPromise = null;
        console.error("[KAKAO] fail ❌", why);
        reject(why instanceof Error ? why : new Error(String(why)));
      }
    };

    // 폴링: kakao.maps 핵심 클래스가 생기면 성공 처리
    const startPolling = () => {
      const start = Date.now();
      const id = setInterval(() => {
        const ok = !!(window.kakao?.maps?.Map && window.kakao?.maps?.LatLng);
        if (ok) {
          clearInterval(id);
          console.warn("[KAKAO] fallback polling success");
          settleOk();
        } else if (Date.now() - start > 7000) { // 7초 타임아웃
          clearInterval(id);
          settleErr("kakao.maps not ready (timeout)");
        }
      }, 120);
    };

    s.onerror = (e) => {
      settleErr(new Error("SDK script load error"));
    };

    s.onload = () => {
      console.log("[KAKAO] sdk onload");
      try {
        if (window.kakao?.maps?.load) {
          // load 콜백 호출 + 폴링 병행 (환경별 지연 대비)
          let loaded = false;
          window.kakao.maps.load(() => {
            loaded = true;
            console.log("[KAKAO] maps.load callback, version:", window.kakao?.maps?.VERSION);
            settleOk();
          });
          // 혹시 load 콜백이 영영 안 올 때 대비
          setTimeout(() => {
            if (!loaded) startPolling();
          }, 400); // 아주 짧게 기다렸다가 폴링 시작
        } else {
          // load 함수가 없다면 바로 폴링
          startPolling();
        }
      } catch (err) {
        settleErr(err);
      }
    };

    document.head.appendChild(s);
  });

  return kakaoLoadPromise;
}
