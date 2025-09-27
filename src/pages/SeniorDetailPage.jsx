import { useEffect, useMemo, useState } from "react";
import { useParams, Link } from "react-router-dom";
import api from "../lib/apiClient";

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return ts;
  }
}

function SeniorDetailPage() {
  const { name: encodedName } = useParams();
  // 라우터 param은 인코딩되어 들어오므로 화면 표시용으로 디코딩
  const name = useMemo(() => decodeURIComponent(encodedName || ""), [encodedName]);

  const [hospital, setHospital] = useState([]);
  const [meds, setMeds] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!name) return;
    let mounted = true;
    setLoading(true);
    setErr("");

    (async () => {
      try {
        // 백엔드 호출 시에는 다시 안전하게 인코딩
        const safe = encodeURIComponent(name);
        const [hRes, mRes] = await Promise.all([
          api.get(`/api/seniors/${safe}/hospitalRecords`),
          api.get(`/api/seniors/${safe}/medicationRecords`),
        ]);
        if (!mounted) return;
        setHospital(hRes.data || []);
        setMeds(mRes.data || []);
      } catch (e) {
        if (!mounted) return;
        setErr(e?.response?.data?.message || e.message || "불러오기에 실패했습니다.");
      } finally {
        if (mounted) setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [name]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/seniors" style={{ textDecoration: "none", color: "#2563eb" }}>← 목록으로</Link>
        <h2 style={{ margin: 0 }}>{name} 님 기록</h2>
      </div>

      {loading && <div style={{ marginTop: 16 }}>불러오는 중…</div>}
      {err && <div style={{ marginTop: 16, color: "crimson" }}>에러: {err}</div>}

      {!loading && !err && (
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 16, marginTop: 16 }}>
          {/* 병원기록 */}
          <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "white" }}>
            <h3 style={{ marginTop: 0 }}>병원기록</h3>
            {hospital.length === 0 ? (
              <div style={{ color: "#6b7280" }}>등록된 병원기록이 없습니다.</div>
            ) : (
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {hospital.map((r, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    <div><b>증상:</b> {r.증상}</div>
                    <div><b>병원:</b> {r.병원이름}</div>
                    <div style={{ color: "#6b7280" }}>{fmt(r.timestamp)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>

          {/* 복용기록 */}
          <section style={{ border: "1px solid #e5e7eb", borderRadius: 12, padding: 14, background: "white" }}>
            <h3 style={{ marginTop: 0 }}>복용기록</h3>
            {meds.length === 0 ? (
              <div style={{ color: "#6b7280" }}>등록된 복용기록이 없습니다.</div>
            ) : (
              <ul style={{ paddingLeft: 16, margin: 0 }}>
                {meds.map((r, i) => (
                  <li key={i} style={{ marginBottom: 10 }}>
                    <div><b>약품명:</b> {r.약품명}</div>
                    {"용량" in r && r.용량 && <div><b>용량:</b> {r.용량}</div>}
                    <div style={{ color: "#6b7280" }}>{fmt(r.timestamp)}</div>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </div>
  );
}


export default SeniorDetailPage;