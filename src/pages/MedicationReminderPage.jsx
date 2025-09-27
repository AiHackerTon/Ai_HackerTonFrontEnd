import { useEffect, useMemo, useState, useCallback } from "react";
import styled from "styled-components";

const MED_API_BASE =
  import.meta?.env?.VITE_MED_API_BASE?.replace(/\/$/, "") || "http://localhost:4000";


const DEFAULT_TIMES = { morning: "08:00", noon: "12:30", evening: "19:30" };


const TAKEN_BEFORE_MIN = 60;  
const TAKEN_AFTER_MIN  = 180;  

const keyTimes = (name) => `medTimes:${name}`;
const keyRegimen = (name) => `medRegimen:${name}`;

const pad = (n) => (n < 10 ? `0${n}` : `${n}`);
const todayStr = (d = new Date()) =>
  `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const toMinutes = (hhmm) => {
  const [h, m] = (hhmm || "00:00").split(":").map((x) => parseInt(x, 10));
  return (isNaN(h) ? 0 : h) * 60 + (isNaN(m) ? 0 : m);
};


async function fetchMedicationRecords(seniorName) {
  const url = `${MED_API_BASE}/api/seniors/${encodeURIComponent(seniorName)}/medicationRecords`;
  const resp = await fetch(url, { headers: { accept: "application/json" } });
  if (!resp.ok) throw new Error(`기록 조회 실패(${resp.status})`);
  return resp.json(); // [{약품명, 용량, timestamp}, ...]
}


function notify(title, body) {
  if ("Notification" in window) {
    if (Notification.permission === "granted") {
      new Notification(title, { body });
      return;
    }
  }

  alert(`${title}\n${body}`);
}

export default function MedicationReminderPage() {
  const [seniorName] = useState("양희승");

  const [times, setTimes] = useState(() => {
    try {
      const saved = localStorage.getItem(keyTimes(seniorName));
      return saved ? JSON.parse(saved) : DEFAULT_TIMES;
    } catch {
      return DEFAULT_TIMES;
    }
  });
  useEffect(() => {
    localStorage.setItem(keyTimes(seniorName), JSON.stringify(times));
  }, [times, seniorName]);

  const [regimen] = useState(() => {
    try {
      const s = localStorage.getItem(keyRegimen(seniorName));
      return s ? JSON.parse(s) : null;
    } catch {
      return null;
    }
  });

  // 3) 복용기록 로드
  const [records, setRecords] = useState([]);
  const [loading, setLoading] = useState(false);
  const loadRecords = useCallback(async () => {
    try {
      setLoading(true);
      const data = await fetchMedicationRecords(seniorName);
      setRecords(Array.isArray(data) ? data : []);
    } catch (e) {
      console.error(e);
    } finally {
      setLoading(false);
    }
  }, [seniorName]);
  useEffect(() => {
    loadRecords();
  }, [loadRecords]);

  // 오늘 기록만 모으고, 각 기록을 '분 단위'로 변환
  const recordsTodayByNameMins = useMemo(() => {
    const today = todayStr();
    const map = new Map(); // name -> [mins...]
    for (const r of records) {
      if (!r?.약품명 || !r?.timestamp) continue;
      const d = new Date(r.timestamp);
      if (todayStr(d) !== today) continue;
      const mins = d.getHours() * 60 + d.getMinutes();
      const key = r.약품명.trim();
      if (!map.has(key)) map.set(key, []);
      map.get(key).push(mins);
    }
    return map;
  }, [records]);

  const hasTakenInSlot = useCallback(
    (name, slotMin) => {
      const arr = recordsTodayByNameMins.get((name || "").trim());
      if (!arr || !arr.length) return false;
      const minStart = slotMin - TAKEN_BEFORE_MIN;
      const minEnd   = slotMin + TAKEN_AFTER_MIN;
      return arr.some((m) => m >= minStart && m <= minEnd);
    },
    [recordsTodayByNameMins]
  );

  // 활성 복용기간 필터링
  const activeByTime = useMemo(() => {
    if (!regimen?.scheduleByTime) return { morning: [], noon: [], evening: [] };

    const startBase = regimen.startDateISO || todayStr();
    const today = todayStr();
    const pickActive = (name) => {
      const it = (regimen.items || []).find((x) => (x.name || "").trim() === name);
      if (!it) return false;
      const numDays =
        typeof it.days === "number"
          ? it.days
          : parseInt(String(it.days || "").replace(/[^\d]/g, ""), 10) || 0;
      if (!numDays) return true; 
      const startISO = it.startDateISO || startBase;
      const d = Math.floor((new Date(today + "T00:00:00") - new Date(startISO + "T00:00:00")) / (1000 * 60 * 60 * 24));
      return d >= 0 && d <= numDays - 1;
    };

    return {
      morning: (regimen.scheduleByTime.morning || []).filter(pickActive),
      noon: (regimen.scheduleByTime.noon || []).filter(pickActive),
      evening: (regimen.scheduleByTime.evening || []).filter(pickActive),
    };
  }, [regimen]);

const sendMorningNow = useCallback(async () => {
  if (typeof window === "undefined" || !("Notification" in window)) {
    alert("이 브라우저는 웹 알림을 지원하지 않습니다.");
    return;
  }


  let perm = Notification.permission;
  if (perm !== "granted") {
    try {
      perm = await Notification.requestPermission();
    } catch {
      perm = Notification.permission;
    }
  }
  if (perm !== "granted") {
    alert("알림 권한이 허용되어 있지 않습니다.\n브라우저 사이트 설정에서 알림을 허용해주세요.");
    return;
  }

  const morningList = activeByTime.morning || [];
  const slotMin = toMinutes(times.morning);
  const untaken = morningList.filter((name) => !hasTakenInSlot(name, slotMin));

  const title = "약 드실 시간입니다 (아침)";
  let body = "";

  if (untaken.length > 0) {
    body = untaken.join(", ");
  } else if (morningList.length > 0) {
    const itemMap = new Map(
      (regimen?.items || []).map((it) => [String(it.name || "").trim(), it])
    );
    body = morningList
      .map((n) => {
        const it = itemMap.get(String(n).trim());
        const dose = it?.dosage ? ` — ${it.dosage}` : "";
        return `${n}${dose}`;
      })
      .join(", ");
  } else {
    body = "등록된 아침 약이 없습니다.";
  }

  notify(title, body);
}, [activeByTime, times, hasTakenInSlot, regimen]);


  return (
    <Wrap>
      <Header>
        <div>
          <Title>약복용 알림</Title>
          <Small>대상: {seniorName}</Small>
        </div>
        <RightArea>
          <ActionBtn onClick={sendMorningNow}>아침 복용알림</ActionBtn>
        </RightArea>
      </Header>

      {/* 알림 시간 설정 */}
      <Card>
        <H3>알림 시간 설정</H3>
        <Row>
          <Label>아침</Label>
          <TimeInput
            type="time"
            value={times.morning}
            onChange={(e) => setTimes({ ...times, morning: e.target.value })}
          />
        </Row>
        <Row>
          <Label>점심</Label>
          <TimeInput
            type="time"
            value={times.noon}
            onChange={(e) => setTimes({ ...times, noon: e.target.value })}
          />
        </Row>
        <Row>
          <Label>저녁</Label>
          <TimeInput
            type="time"
            value={times.evening}
            onChange={(e) => setTimes({ ...times, evening: e.target.value })}
          />
        </Row>
      </Card>

      {/* 오늘 복용기록 */}
      <Card>
        <H3>오늘 복용기록</H3>
        <Row>
          <Small>
            총 {
              records.filter(r => todayStr(new Date(r.timestamp)) === todayStr()).length
            }건
          </Small>
          <RefreshBtn onClick={loadRecords} disabled={loading}>
            {loading ? "불러오는 중..." : "새로고침"}
          </RefreshBtn>
        </Row>
        <LogList>
          {records.length === 0 ? (
            <Empty>기록이 없습니다.</Empty>
          ) : (
            records
              .slice()
              .reverse()
              .map((r, idx) => (
                <LogItem key={idx}>
                  <strong>{r.약품명}</strong>
                  <div>{new Date(r.timestamp).toLocaleString()}</div>
                </LogItem>
              ))
          )}
        </LogList>
      </Card>
    </Wrap>
  );
}

const Wrap = styled.div`
  min-height: 100dvh;
  padding: 16px;
  background: #f6f7fb;
  display: flex;
  flex-direction: column;
  gap: 12px;
`;
const Header = styled.header`
  display: flex; align-items: center; justify-content: space-between; gap: 8px;
`;
const RightArea = styled.div`
  display: flex; align-items: center; gap: 8px;
`;
const Title = styled.h1`
  margin: 0; font-size: 30px; font-weight: 800;
`;
const Small = styled.div`
  font-size: 20px; color: #6b7280;
`;
const Card = styled.div`
  background: #fff; border: 1px solid #e5e7eb; border-radius: 14px; font-size:20px;
  padding: 12px; box-shadow: 0 8px 16px rgba(0,0,0,0.03);

`;
const H3 = styled.h3` margin: 0 0 10px 0; `;
const Row = styled.div` display: flex; align-items: center; gap: 8px; margin: 8px 0; `;
const Label = styled.div` width: 60px; `;
const TimeInput = styled.input`
  padding: 8px 10px; border: 1px solid #e5e7eb; border-radius: 8px;
`;
const Hint = styled.div` color: #6b7280; font-size: 12px; margin-top: 8px; `;
const Empty = styled.div` color: #6b7280; `;
const RefreshBtn = styled.button`
  margin-left: auto; padding: 8px 12px; border-radius: 10px;
  background: #111827; color: #fff; border: none; cursor: pointer;
`;
const ActionBtn = styled.button`
  padding: 10px 14px; border-radius: 10px;
  background: #111827; color: #fff; border: none; cursor: pointer;
  font-weight: 700;
`;
const LogList = styled.div`
  max-height: 40vh; overflow: auto; margin-top: 8px; display: grid; gap: 6px;
`;
const LogItem = styled.div`
  border: 1px solid #e5e7eb; border-radius: 10px; padding: 8px; background: #fff;
  display: flex; align-items: center; justify-content: space-between;
`;
