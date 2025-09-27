import { BrowserRouter, Routes, Route, useLocation, Link } from "react-router-dom";
import MainPage from "./pages/MainPage.jsx";
import HospitalPage from "./pages/HospitalPage.jsx";
import CameraPage from "./pages/CameraPage.jsx";
import Header from "./components/Header.jsx";
import FooterNav from "./components/FooterNav.jsx";
import ResultPage from "./pages/ResultPage.jsx";
import SeniorDetailPage from "./pages/SeniorDetailPage.jsx";
import SeniorPage from "./pages/SeniorPage.jsx";
import ReservationsPage from "./pages/ReservationPage.jsx";
import HospitalDetailPage from "./pages/HospitalDetailPage.jsx";
import MedicationReminderPage from "./pages/MedicationReminderPage.jsx";

// Router 안쪽에서만 useLocation 사용
function Shell() {
  const loc = useLocation();
  const showFooter = ["/", "/hospitals", "/camera"].includes(loc.pathname);

  return (
    <div className="app-wrap">
      <Header />
      <Routes>
        <Route path="/" element={<MainPage />} />
        <Route path="/hospitals" element={<HospitalPage />} />
        <Route path="/camera" element={<CameraPage />} />
        <Route path="/result" element={<ResultPage />} />
        <Route path="/seniors" element={<SeniorPage />} />
        <Route path="/seniors/:name" element={<SeniorDetailPage />} />
        <Route path="/reservation" element={<ReservationsPage />} />
        <Route path="/reminder" element={<MedicationReminderPage />} />
        <Route path="/reservation/:name" element={<HospitalDetailPage />} />
        <Route path="*" element={
          <div style={{ padding: 24 }}>
            <div>페이지를 찾을 수 없어요.</div>
            <Link to="/" style={{ color: "#0b5fff" }}>메인으로</Link>
          </div>
        } />
      </Routes>
      {showFooter && <FooterNav />}
    </div>
  );
}

export default function App() {
  return (
    <BrowserRouter>
      <Shell />
    </BrowserRouter>
  );
}
