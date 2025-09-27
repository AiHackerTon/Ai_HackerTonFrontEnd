import { useLocation, useNavigate } from "react-router-dom";
import { useEffect, useMemo, useRef, useState } from "react";
import { speak } from "../utils/tts";

/* -------------------- 유틸 -------------------- */
const isObj = (v) => v && typeof v === "object" && !Array.isArray(v);

// 텍스트에서 { ... } 객체들 뽑아내기 (처방전의 약목록용)
function extractJsonObjectsFromText(raw, keyCandidates = ["약목록", "약 목록"]) {
  if (!raw) return [];
  const startIdx =
    keyCandidates
      .map((k) => raw.indexOf(k))
      .filter((i) => i >= 0)
      .sort((a, b) => a - b)[0] ?? 0;
  const sliced = raw.slice(startIdx);
  const matches = sliced.match(/\{[^}]*\}/g) || [];
  const objs = [];
  for (const m of matches) {
    try {
      const fixed = m
        .replace(/([{,]\s*)([가-힣A-Za-z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      const parsed = JSON.parse(fixed);
      objs.push(parsed);
    } catch {}
  }
  return objs;
}

// 텍스트에서 { ... } 객체들 뽑아내기 (복약안내문 약효목록용)
function extractGuideObjectsFromText(raw) {
  if (!raw) return [];
  const matches = raw.match(/\{[^}]*\}/g) || [];
  const objs = [];
  for (const m of matches) {
    try {
      const fixed = m
        .replace(/([{,]\s*)([가-힣A-Za-z0-9_]+)\s*:/g, '$1"$2":')
        .replace(/:\s*'([^']*)'/g, ': "$1"');
      const parsed = JSON.parse(fixed);
      objs.push(parsed);
    } catch {}
  }
  return objs;
}

// 용법에서 시간대 추출
function parseTimesFromDosage(dosage) {
  const t = (dosage || "").replace(/\s+/g, "");
  return {
    morning: /아침/.test(t),
    noon: /점심/.test(t),
    evening: /저녁|밤/.test(t),
  };
}

function parsePrescription({ text, payload }) {
  const list = [];
  if (isObj(payload) && Array.isArray(payload.약목록)) {
    for (const it of payload.약목록) {
      list.push({
        name: it.약이름 ?? it.약품명 ?? "",
        dosage: it.용법 ?? it.복용법 ?? "", // 화면/읽기용: 용법 문자열
        days: it.투약일수 ?? it.투약기간 ?? "", // "28일" 같은 문자열
      });
    }
  } else {
    const objs = extractJsonObjectsFromText(text);
    for (const it of objs) {
      list.push({
        name: it.약이름 ?? it.약품명 ?? "",
        dosage: it.용법 ?? it.복용법 ?? "",
        days: it.투약일수 ?? it.투약기간 ?? "",
      });
    }
  }
  return list
    .map((x) => ({
      name: (x.name || "").trim(),
      dosage: (x.dosage || "").trim(),
      days: (x.days || "").toString().trim(),
    }))
    .filter((x) => x.name || x.dosage);
}

function parseGuide({ text, payload }) {
  const list = [];
  if (isObj(payload) && Array.isArray(payload.약효목록)) {
    for (const it of payload.약효목록) {
      list.push({
        요약: typeof it.요약 === "string" ? it.요약 : "",
        효능: typeof it.효능 === "string" ? it.효능 : "",
      });
    }
  } else {
    const objs = extractGuideObjectsFromText(text);
    for (const it of objs) {
      list.push({
        요약: typeof it.요약 === "string" ? it.요약 : "",
        효능: typeof it.효능 === "string" ? it.효능 : "",
      });
    }
  }
  return list.filter((x) => x.요약 || x.효능);
}

function groupByTime(items) {
  const grouped = { morning: [], noon: [], evening: [] };
  for (const it of items) {
    const { morning, noon, evening } = parseTimesFromDosage(it.dosage);
    if (morning) grouped.morning.push(it);
    if (noon) grouped.noon.push(it);
    if (evening) grouped.evening.push(it);
    if (!morning && !noon && !evening) grouped.morning.push(it); // 기본값
  }
  return grouped;
}

function buildPrescriptionTTS(items) {
  if (!items?.length) return "";
  // 요청: "약 이름 + 복용법"만 읽어주기
  return items
    .map((x) => `${(x.name || "").trim()}, ${(x.dosage || "").trim()}`)
    .join(". ");
}

function buildGuideTTS(items) {
  if (!items?.length) return "";
  // 요청: 약효목록 그대로 읽기 (요약 + 효능)
  return items
    .map((x) =>
      [x.요약?.trim(), x.효능 ? `효능: ${x.효능.trim()}` : ""]
        .filter(Boolean)
        .join(". ")
    )
    .join(". ");
}

/* -------------------- 복용기록 API -------------------- */
const MED_API_BASE =
  import.meta?.env?.VITE_MED_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";

async function postMedicationRecord({ seniorName, 약품명, 용량 = "1정" }) {
  const url = `${MED_API_BASE}/api/seniors/${encodeURIComponent(
    seniorName
  )}/medicationRecords`;
  const resp = await fetch(url, {
    method: "POST",
    headers: { "Content-Type": "application/json", accept: "application/json" },
    body: JSON.stringify({ 약품명, 용량 }),
  });
  if (!resp.ok) {
    const text = await resp.text().catch(() => "");
    throw new Error(`복용기록 전송 실패(${resp.status}) ${text}`);
  }
  return resp.json();
}

/* -------------------- ResultPage -------------------- */
function ResultPage() {
  const { state } = useLocation();
  const nav = useNavigate();

  // CameraPage에서 넘어온 데이터
  const initialTexts = useMemo(() => {
    if (Array.isArray(state?.texts) && state.texts.length) {
      return [state.texts[0] ?? "", state.texts[1] ?? ""];
    }
    if (typeof state?.text === "string") return [state.text, ""];
    return ["", ""];
  }, [state]);

  const payloads = useMemo(() => {
    if (Array.isArray(state?.payloads) && state.payloads.length) {
      return [state.payloads[0] ?? null, state.payloads[1] ?? null];
    }
    return [null, null];
  }, [state]);

  // 성명 결정: 기존 저장값 > payload 성명 > 기본값
  const seniorName = useMemo(() => {
    const fromPayload = "양희승";
    return (fromPayload || "양희승").toString().trim();
  }, [payloads]);

  const [active, setActive] = useState(0); // 0: 처방전, 1: 복약안내문
  const [texts, setTexts] = useState(initialTexts);

  const prescriptionItems = useMemo(
    () => parsePrescription({ text: texts[0], payload: payloads[0] }),
    [texts, payloads]
  );
  const scheduleByTime = useMemo(
    () => groupByTime(prescriptionItems),
    [prescriptionItems]
  );

  const guideItems = useMemo(
    () => parseGuide({ text: texts[1], payload: payloads[1] }),
    [texts, payloads]
  );

  // 보호: 완전 빈 경우 카메라로 되돌림
  useEffect(() => {
    if (!texts[0] && !texts[1] && !payloads[0] && !payloads[1]) {
      nav("/camera", { replace: true });
    }
  }, [texts, payloads, nav]);

  /* ---------- (1) 복용기록 자동 전송: 마운트 후 1회 ---------- */
  const postedOnceRef = useRef(false);
  const postedKeys = useRef(new Set()); // 중복 방지(약 이름 기준)

  useEffect(() => {
    if (postedOnceRef.current) return;
    postedOnceRef.current = true;

    // 약 이름 기준으로 중복 제거 후 전송
    const uniqueByName = new Map();
    for (const it of prescriptionItems) {
      const key = (it.name || "").trim();
      if (!key) continue;
      if (!uniqueByName.has(key)) uniqueByName.set(key, it);
    }

    (async () => {
      for (const [name] of uniqueByName.entries()) {
        if (postedKeys.current.has(name)) continue;
        try {
          await postMedicationRecord({ seniorName, 약품명: name, 용량: "1정" });
          postedKeys.current.add(name);
          console.log("[복용기록] 전송 완료:", name);
        } catch (e) {
          console.error("[복용기록] 전송 실패:", name, e);
        }
      }
    })();
  }, [prescriptionItems, seniorName]);

  /* ---------- (2) 알림페이지용 regimen 자동 저장 ---------- */
  useEffect(() => {
    try {
      if (!prescriptionItems.length) return;

      // items 정규화: days → 숫자, usage 보존, dosage(실제 정수 용량)는 "1정" 기본
      const normItems = prescriptionItems
        .map((it) => {
          const daysNum =
            parseInt(String(it.days || "").replace(/[^\d]/g, ""), 10) || 0;
          return {
            name: (it.name || "").trim(),
            usage: (it.dosage || "").trim(), // 용법
            days: daysNum, // 없으면 0
            dosage: "1정",
          };
        })
        .filter((x) => x.name);

      // 시간대별 → 이름 배열(알림 페이지가 기대하는 포맷)
      const toNames = (arr) =>
        (arr || [])
          .map((x) => (x && x.name ? x.name.trim() : ""))
          .filter(Boolean);

      const persist = {
        startDateISO: new Date().toISOString().slice(0, 10),
        items: normItems,
        scheduleByTime: {
          morning: toNames(scheduleByTime.morning),
          noon: toNames(scheduleByTime.noon),
          evening: toNames(scheduleByTime.evening),
        },
      };

      localStorage.setItem(`medRegimen:${seniorName}`, JSON.stringify(persist));
      localStorage.setItem("activeSenior", seniorName);

      console.log("[ResultPage] regimen 저장 완료", {
        key: `medRegimen:${seniorName}`,
        persist,
      });
    } catch (e) {
      console.error("[ResultPage] regimen 저장 실패:", e);
    }
  }, [prescriptionItems, scheduleByTime, seniorName]);

  // TTS
  const onReadPrescription = () => {
    const t = buildPrescriptionTTS(prescriptionItems);
    if (!t) return alert("읽을 처방 정보가 없어요.");
    speak(t);
  };
  const onReadGuide = () => {
    const t = buildGuideTTS(guideItems);
    if (!t) return alert("읽을 복약안내 정보가 없어요.");
    speak(t);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        gap: 16,
        padding: 16,
        background: "#f6f7fb",
      }}
    >
      <header style={{ display: "flex", alignItems: "center", gap: 8 }}>
        <button onClick={() => nav(-1)} style={backBtnStyle}>
          ←
        </button>
        <h1 style={{ margin: 0, fontSize: 30, fontWeight: 700 }}>OCR 결과</h1>
        <span style={{ marginLeft: "auto", color: "#6b7280" }}>
          대상: {seniorName}
        </span>
      </header>

      {/* 탭 */}
      <div style={tabsWrapStyle}>
        <button
          onClick={() => setActive(0)}
          style={{ ...tabBtnStyle, ...(active === 0 ? tabBtnActiveStyle : {}) }}
        >
          처방전
        </button>
        <button
          onClick={() => setActive(1)}
          style={{ ...tabBtnStyle, ...(active === 1 ? tabBtnActiveStyle : {}) }}
        >
          복약안내문
        </button>
      </div>

      {/* 상단 TTS 버튼 */}
      <div style={{ display: "grid", placeItems: "center", gap: 8 }}>
        {active === 0 ? (
          <button onClick={onReadPrescription} style={readBtnStyle}>
            처방전 읽기
          </button>
        ) : (
          <button onClick={onReadGuide} style={readBtnStyle}>
            복약안내문 읽기
          </button>
        )}
      </div>

      {/* 본문 */}
      {active === 0 ? (
        <>
          {/* 시간대별 복용 스케줄 */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>시간대별 복용 스케줄</h3>
            {["morning", "noon", "evening"].map((tKey) => {
              const title =
                tKey === "morning" ? "아침" : tKey === "noon" ? "점심" : "저녁";
              const arr = scheduleByTime[tKey] || [];
              return (
                <div key={tKey} style={{ marginBottom: 12 }}>
                  <div style={{ fontWeight: 700, marginBottom: 6 }}>{title}</div>
                  {arr.length === 0 ? (
                    <div style={{ color: "#6b7280" }}>- 해당 없음</div>
                  ) : (
                    <ul style={{ margin: 0, paddingLeft: 18 }}>
                      {arr.map((d, i) => (
                        <li key={`${tKey}-${i}`}>
                          {d.name} — {d.dosage}
                        </li>
                      ))}
                    </ul>
                  )}
                </div>
              );
            })}
          </div>
        </>
      ) : (
        <>
          {/* 약효목록 전체 출력 */}
          <div style={cardStyle}>
            <h3 style={{ marginTop: 0 }}>복약안내 요약</h3>
            {guideItems.length === 0 ? (
              <div style={{ color: "#6b7280" }}>표시할 내용이 없습니다.</div>
            ) : (
              <ul style={{ margin: 0, paddingLeft: 18 }}>
                {guideItems.map((g, idx) => (
                  <li key={idx} style={{ marginBottom: 8 }}>
                    {g.요약 && (
                      <div style={{ whiteSpace: "pre-wrap" }}>{g.요약}</div>
                    )}
                    {g.효능 && (
                      <div style={{ color: "#374151" }}>효능: {g.효능}</div>
                    )}
                  </li>
                ))}
              </ul>
            )}
          </div>
        </>
      )}
    </div>
  );
}

/* -------------------- 스타일 -------------------- */
const backBtnStyle = {
  width: 50,
  height: 50,
  borderRadius: 10,
  border: "2px solid black",
  background: "#fff",
  cursor: "pointer",
};
const tabsWrapStyle = { display: "flex", gap: 8, background: "transparent" };
const tabBtnStyle = {
  flex: 1,
  padding: "10px 12px",
  borderRadius: 10,
  width: "100px",
  height: "70px",
  fontSize: 24,
  border: "1px solid #e5e7eb",
  background: "#fff",
  cursor: "pointer",
  fontWeight: 700,
};
const tabBtnActiveStyle = {
  background: "#111827",
  color: "#fff",
  borderColor: "#111827",
};
const readBtnStyle = {
  padding: "12px 18px",
  borderRadius: 9999,
  border: "none",
  width: "300px",
  height: "70px",
  background: "#111827",
  color: "#fff",
  fontWeight: 700,
  fontSize: 30,
  boxShadow: "0 10px 24px rgba(0,0,0,0.18)",
  cursor: "pointer",
};
const cardStyle = {
  background: "#fff",
  border: "1px solid #e5e7eb",
  borderRadius: 14,
  padding: 12,
  boxShadow: "0 8px 16px rgba(0,0,0,0.03)",
  marginBottom: 8,
  fontSize: 20,
};

export default ResultPage;
