import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";

export default function ReservationsPage() {
  const [hospitals, setHospitals] = useState([]); // [{ name, count }]
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/reservations");
        // res.data는 { 병원이름: [..], ... } 구조
        const entries = Object.entries(res.data || {});
        const list = entries.map(([name, arr]) => ({
          name,
          count: Array.isArray(arr) ? arr.length : 0,
        }));
        if (!mounted) return;
        // 이름 기준 정렬(가나다)
        setHospitals(list.sort((a, b) => a.name.localeCompare(b.name, "ko-KR")));
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "불러오기에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    })();
    return () => { mounted = false; };
  }, []);

  if (loading) return <div style={{ padding: 20 }}>불러오는 중…</div>;
  if (err) return <div style={{ padding: 20, color: "crimson" }}>에러: {err}</div>;

  return (
    <div style={{ padding: 20 }}>
      <h2>병원 리스트</h2>
      <p style={{ color: "#666" }}>카드를 클릭하면 해당 병원의 예약 목록을 볼 수 있어요.</p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
        marginTop: 12
      }}>
        {hospitals.length === 0 && (
          <div style={{ color: "#6b7280" }}>아직 등록된 병원이 없습니다.</div>
        )}

        {hospitals.map((h) => (
          <button
            key={h.name}
            onClick={() => navigate(`/reservation/${encodeURIComponent(h.name)}`)}
            style={{
              textAlign: "left",
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 14,
              background: "white",
              cursor: "pointer",
              boxShadow: "0 1px 2px rgba(0,0,0,0.04)"
            }}
          >
            <div style={{ fontSize: 18, fontWeight: 700 }}>{h.name}</div>
            <div style={{ marginTop: 6, color: "#374151" }}>
              예약 건수: {h.count}건
            </div>
          </button>
        ))}
      </div>
    </div>
  );
}
