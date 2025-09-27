import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/apiClient";

export default function SeniorPage() {
  const [caregivers, setCaregivers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");
  const navigate = useNavigate();

  useEffect(() => {
    let mounted = true;
    (async () => {
      try {
        const res = await api.get("/api/caregivers");
        if (!mounted) return;
        setCaregivers(res.data || []);
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
      <h2>현재 관리 중인 노인분 목록</h2>
      <p style={{ color: "#666" }}>카드를 클릭하면 병원기록/복용기록을 볼 수 있어요.</p>

      <div style={{
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))",
        gap: 12,
        marginTop: 12
      }}>
        {caregivers.map((c, idx) => (
          <button
            key={idx}
            onClick={() => {
              // 이름으로 상세 페이지 이동 (URL 인코딩 안전)
              const encoded = encodeURIComponent(c.이름);
              navigate(`/seniors/${encoded}`);
            }}
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
            <div style={{ fontSize: 18, fontWeight: 700 }}>{c.이름}</div>
            <div style={{ marginTop: 6, color: "#374151" }}>연락처: {c.연락처}</div>
            <div style={{ marginTop: 4, color: "#6b7280" }}>주소: {c.주소}</div>
          </button>
        ))}
      </div>
    </div>
  );
}
