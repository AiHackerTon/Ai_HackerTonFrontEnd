// ===================== HospitalPage.jsx =====================
import React, { useEffect, useLayoutEffect, useRef, useState } from "react";
import styled from "styled-components";
import { loadKakaoSDK } from "../lib/kakaoLoader";
import { useLocation } from "react-router-dom";

/* ---------- 예약 확인 Modal ---------- */
function ConfirmModal({ hospital, lastText, posting, onConfirm, onCancel }) {
  return (
    <ModalBackdrop>
      <ModalBox>
        <ReservationCheck><b>예약 확인</b></ReservationCheck>
        <Jung><b>증상:</b> {lastText}</Jung>
        <HospitalName><b>병원:</b> {hospital?.name}</HospitalName>
        <CheckConfirm>이 병원을 예약하시겠습니까?</CheckConfirm>

        <ButtonRow>
          <ConfirmButton onClick={onConfirm} disabled={posting}>
            {posting ? "예약 중..." : "확인"}
          </ConfirmButton>
          <CancelButton onClick={onCancel} disabled={posting}>취소</CancelButton>
        </ButtonRow>
      </ModalBox>
    </ModalBackdrop>
  );
}

export default function HospitalPage() {
  const mapElRef = useRef(null);
  const mapObjRef = useRef(null);
  const markersRef = useRef([]);     // 병원 마커들
  const overlaysRef = useRef([]);    // InfoWindow/CustomOverlay 등
  const polylineRef = useRef(null);  // 경로 Polyline

  const [pos, setPos] = useState(null);           // 현재 위치
  const [mapReady, setMapReady] = useState(false);
  const [selectedHospital, setSelectedHospital] = useState(null);
  const [modalOpen, setModalOpen] = useState(false);
  const [posting, setPosting] = useState(false);

  const location = useLocation();
  const lastText = location.state?.text ?? "증상 데이터 없음";
  const department = location.state?.dept ?? null; // 추천 진료과 (없으면 전체)

  const DUMMY_PATIENT = {
    name: "양희승",
    phone: "010-4669-2902",
  };
  const SENIOR_NAME = DUMMY_PATIENT.name;

  // ORS KEY
  const ORS_KEY = "5b3ce3597851110001cf62488354267d3265405b84bd4f9b67cb3a5a";

  async function fetchORSRoute(start, end) {
    const url = "https://api.openrouteservice.org/v2/directions/driving-car/geojson";
    const body = { coordinates: [[start.lng, start.lat], [end.lng, end.lat]] };

    try {
      const res = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: ORS_KEY,
          "Content-Type": "application/json",
        },
        body: JSON.stringify(body),
      });
      if (!res.ok) throw new Error("ORS API 호출 실패");
      return await res.json();
    } catch (e) {
      console.error("ORS 호출 에러:", e);
      return null;
    }
  }

  /* 1) Kakao SDK + 현재 위치 고정 */
  useEffect(() => {
    (async () => {
      const key = "cfd7264f6f0677bc208104d9cbc45701";
      await loadKakaoSDK(key);
      setPos({ lat: 35.177527, lng: 128.091015 }); // 진주 중앙시장 부근(예시)
    })();
  }, []);

  /* 2) 지도 생성 + “내 위치” 라벨 */
  useLayoutEffect(() => {
    if (!pos || !window.kakao?.maps) return;

    const center = new window.kakao.maps.LatLng(pos.lat, pos.lng);
    const map = new window.kakao.maps.Map(mapElRef.current, { center, level: 5 });
    mapObjRef.current = map;

    // 현재 위치 마커 + 라벨
    const meMarker = new window.kakao.maps.Marker({ map, position: center, zIndex: 900 });
    const meInfo = new window.kakao.maps.InfoWindow({
      content: `<div style="padding:6px 10px;font-size:14px;">내 위치</div>`,
    });
    meInfo.open(map, meMarker);

    setMapReady(true);
  }, [pos]);

  /* 3) 병원 마커 표시 */
  useEffect(() => {
    if (!mapReady || !mapObjRef.current) return;

    // 기존 마커/오버레이 정리
    markersRef.current.forEach((m) => m && typeof m.setMap === "function" && m.setMap(null));
    overlaysRef.current.forEach((ov) => {
      if (!ov) return;
      if (typeof ov.setMap === "function") ov.setMap(null);
      else if (typeof ov.close === "function") ov.close();
    });
    markersRef.current = [];
    overlaysRef.current = [];

    const map = mapObjRef.current;

    // 진료과 필터 (공백 안전 비교)
    const hospitalsToShow = department
      ? HOSPITALS.filter((h) =>
          h.subjects.some((s) => s.trim() === department.trim())
        )
      : HOSPITALS;

    hospitalsToShow.forEach((h) => {
      const position = new window.kakao.maps.LatLng(h.lat, h.lng);
      const marker = new window.kakao.maps.Marker({ map, position });

      // 이 마커가 어떤 병원인지 태깅 (확인 시 선택 마커만 남기기 위함)
      marker.__hospital = h;

      // 병원명은 클릭 시에만 표시
      const iw = new window.kakao.maps.InfoWindow({
        content: `<div style="padding:6px;font-size:12px;">${escapeHtml(h.name)}</div>`,
      });

      window.kakao.maps.event.addListener(marker, "click", () => {
        iw.open(map, marker);
        setSelectedHospital(h);
        setModalOpen(true);
      });

      markersRef.current.push(marker);
      overlaysRef.current.push(iw);
    });
  }, [mapReady, department]);

  /* 4) 예약 + (추가) 노인 병원기록 POST + 경로 표시 */
  const handleConfirm = async () => {
    if (!selectedHospital) return;

    try {
      setPosting(true);

      const hospitalName = selectedHospital.name;

      // 병원 예약 API payload
      const reservationPayload = {
        환자이름: DUMMY_PATIENT.name,
        환자연락처: DUMMY_PATIENT.phone,
        증상: lastText || "",
        시간: new Date().toISOString(), // 서버 자동 생성해도 OK
      };

      // 노인 병원기록 API payload
      const seniorRecordPayload = {
        증상: lastText || "",
        병원이름: hospitalName,
        // timestamp는 생략 시 서버에서 자동 생성
      };

      // 두 API를 동시에 호출
      const reservationUrl = `http://localhost:4000/api/reservations/${encodeURIComponent(hospitalName)}`;
      const seniorUrl = `http://localhost:4000/api/seniors/${encodeURIComponent(SENIOR_NAME)}/hospitalRecords`;

      const [resvRes, seniorRes] = await Promise.all([
        fetch(reservationUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify(reservationPayload),
        }),
        fetch(seniorUrl, {
          method: "POST",
          headers: { "Content-Type": "application/json", accept: "application/json" },
          body: JSON.stringify(seniorRecordPayload),
        }),
      ]);

      if (!resvRes.ok) {
        const t = await resvRes.text().catch(() => "");
        throw new Error(`예약 실패: ${resvRes.status} ${t}`);
      }
      if (!seniorRes.ok) {
        const t = await seniorRes.text().catch(() => "");
        throw new Error(`병원기록 등록 실패: ${seniorRes.status} ${t}`);
      }

      setModalOpen(false);

      // === 아래부터 경로 표시(기존 로직) ===
      if (!pos || !mapObjRef.current) return;
      const map = mapObjRef.current;

      // 선택 병원 제외 모든 마커/오버레이 제거
      markersRef.current.forEach((m) => {
        const h = m.__hospital;
        const isSelected =
          h &&
          h.name === selectedHospital.name &&
          h.lat === selectedHospital.lat &&
          h.lng === selectedHospital.lng;
        if (!isSelected) m.setMap(null);
      });
      overlaysRef.current.forEach((ov) => {
        if (!ov) return;
        if (typeof ov.setMap === "function") ov.setMap(null);
        else if (typeof ov.close === "function") ov.close();
      });
      overlaysRef.current = [];

      if (polylineRef.current) {
        polylineRef.current.setMap(null);
        polylineRef.current = null;
      }

      const route = await fetchORSRoute(pos, { lat: selectedHospital.lat, lng: selectedHospital.lng });
      if (!route) return;

      const coords = route.features[0].geometry.coordinates.map(
        ([lng, lat]) => new window.kakao.maps.LatLng(lat, lng)
      );

      const polyline = new window.kakao.maps.Polyline({
        path: coords,
        strokeWeight: 5,
        strokeColor: "#0B5FFF",
        strokeOpacity: 0.85,
        strokeStyle: "solid",
      });
      polyline.setMap(map);
      polylineRef.current = polyline;

      const bounds = new window.kakao.maps.LatLngBounds();
      coords.forEach((c) => bounds.extend(c));
      map.setBounds(bounds);
    } catch (err) {
      console.error(err);
      alert(err.message || "예약/기록 등록 중 문제가 발생했습니다.");
    } finally {
      setPosting(false);
    }
  };

  return (
    <Wrap>
      <TopBar>
        <Title>{department ? `추천 과목: ${department}` : "근처 병원"}</Title>
      </TopBar>
      <MapBox ref={mapElRef} />

      {modalOpen && (
        <ConfirmModal
          hospital={selectedHospital}
          lastText={lastText}
          posting={posting}
          onConfirm={handleConfirm}
          onCancel={() => setModalOpen(false)}
        />
      )}
    </Wrap>
  );
}

/* ---------- 더미 병원 데이터 ---------- */
const HOSPITALS = [
  {
    name: "진주 세란병원",
    lat: 35.174654,
    lng: 128.092966,
    subjects: [
      "정형외과","신경과","신경외과","안과","내과","외과",
      "비뇨의학과","산부인과","영상의학과","마취통증의학과",
      "핵의학과","진단검사의학과","응급의학과",
    ],
  },
  {
    name: "진주고려병원",
    lat: 35.178703,
    lng: 128.092119,
    subjects: [
      "내과","신경외과","정형외과","외과","산부인과",
      "비뇨기과","성형외과","심장혈관내과","호흡기내과","신경과",
    ],
  },
  {
    name: "경상국립대학교 병원",
    lat: 35.176645,
    lng: 128.095678,
    subjects: [
      "내과(호흡기·알레르기, 핵의학과, 혈액종양내과 등 세부 분야 포함)",
      "외과","신경외과","정형외과","피부과","치과",
    ],
  },
  {
    name: "진주강남병원 정형 신경내과",
    lat: 35.180209,
    lng: 128.103136,
    subjects: ["정형외과","신경외과","내과","척추클리닉","관절클리닉","통증클리닉"],
  },
  {
    name: "진주 바른병원",
    lat: 35.179938,
    lng: 128.091542,
    subjects: [
      "내과","신경과","외과","정형외과","신경외과","흉부외과",
      "성형외과","마취통증의학과","소아청소년과","이비인후과",
    ],
  },
  {
    name: "의료법인목화의료재단 목화노인병원",
    lat: 35.179769,
    lng: 128.081709,
    subjects: ["내과","일반외과","가정의학과","한방과","재활의학과","물리치료과"],
  },
  {
    name: "의료법인자혜의료제단 진주복음병원",
    lat: 35.186234,
    lng: 128.068851,
    subjects: [
      "내과","신경과","외과","정형외과","신경외과",
      "마취통증의학과","비뇨의학과","영상의학과","가정의학과","물리치료과"
    ],
  },
];

/* ---------- utils ---------- */
function escapeHtml(str) {
  return String(str || "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

/* ---------- styled ---------- */
const Wrap = styled.div`padding:12px;`;
const MapBox = styled.div`
  width:100%;
  height:71vh;
  border:2px solid #0b5fff;
  border-radius:12px;
  background:#f9fbff;
`;
const TopBar = styled.div`margin-bottom:8px;`;
const Title = styled.div`font-weight:700;font-size:30px;`;

const ModalBackdrop = styled.div`
  position: fixed;
  inset: 0;
  background: rgba(0,0,0,0.4);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 9999;
`;
const ModalBox = styled.div`
  background:white;
  padding:20px;
  border-radius:8px;
  max-width:420px;
  width:100%;
`;
const ReservationCheck = styled.div`
  font-size:26px;
  margin-bottom:16px;
`;
const Jung = styled.div`
  font-size:16px;
  margin:10px 0;
`;
const HospitalName = styled.div`
  font-size:16px;
  margin-bottom:12px;
`;
const CheckConfirm = styled.div`
  font-size:15px;
  margin-bottom:12px;
`;
const ButtonRow = styled.div`display:flex;justify-content:space-between;gap:12px;margin-top:12px;`;
const ConfirmButton = styled.button`
  flex:1; padding:10px 16px; background:#0b5fff; color:white; border:none; border-radius:6px; font-size:16px;
  &:disabled { opacity:.6; cursor:not-allowed; }
`;
const CancelButton = styled.button`
  flex:1; padding:10px 16px; background:#ccc; border:none; border-radius:6px; font-size:16px;
  &:disabled { opacity:.6; cursor:not-allowed; }
`;
