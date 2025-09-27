import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import api from "../lib/apiClient";

function fmt(ts) {
  try {
    return new Date(ts).toLocaleString("ko-KR", { timeZone: "Asia/Seoul" });
  } catch {
    return ts;
  }
}

export default function HospitalDetailPage() {
  const { name: encodedName } = useParams();
  const name = useMemo(() => decodeURIComponent(encodedName || ""), [encodedName]);

  const [reservations, setReservations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [err, setErr] = useState("");

  useEffect(() => {
    if (!name) return;
    let mounted = true;

    (async () => {
      try {
        const safe = encodeURIComponent(name);
        const res = await api.get(`/api/reservations/${safe}`);
        if (!mounted) return;
        setReservations(Array.isArray(res.data) ? res.data : []);
      } catch (e) {
        setErr(e?.response?.data?.message || e.message || "불러오기에 실패했습니다.");
      } finally {
        setLoading(false);
      }
    })();

    return () => { mounted = false; };
  }, [name]);

  return (
    <div style={{ padding: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
        <Link to="/reservation" style={{ textDecoration: "none", color: "#2563eb" }}>← 목록으로</Link>
        <h2 style={{ margin: 0 }}>{name} 예약 목록</h2>
      </div>

      {loading && <div style={{ marginTop: 16 }}>불러오는 중…</div>}
      {err && <div style={{ marginTop: 16, color: "crimson" }}>에러: {err}</div>}

      {!loading && !err && (
        <>
          {reservations.length === 0 ? (
            <div style={{ marginTop: 12, color: "#6b7280" }}>
              등록된 예약이 없습니다.
            </div>
          ) : (
            <ul style={{ paddingLeft: 16, marginTop: 12 }}>
              {reservations.map((r, i) => (
                <li key={i} style={{ marginBottom: 12 }}>
                  <div><b>환자이름:</b> {r.환자이름}</div>
                  <div><b>연락처:</b> {r.환자연락처}</div>
                  <div><b>증상:</b> {r.증상}</div>
                  <div style={{ color: "#6b7280" }}>{fmt(r.시간)}</div>
                </li>
              ))}
            </ul>
          )}
        </>
      )}
    </div>
  );
}
