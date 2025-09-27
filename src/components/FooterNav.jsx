// FooterNav.jsx
import { useNavigate, useLocation } from "react-router-dom";
import styled from "styled-components";

// ⬇️ 아이콘 경로는 프로젝트 구조에 맞게 수정하세요
import MainIcon from "../../public/assets/House.png";
import HospitalIcon from "../../public/assets/Hospital.png";
import CameraIcon from "../../public/assets/Camera.png";

export default function FooterNav() {
  const nav = useNavigate();
  const { pathname } = useLocation();

  const items = [
    { to: "/", label: "메인", icon: MainIcon },
    { to: "/hospitals", label: "병원", icon: HospitalIcon },
    { to: "/camera", label: "카메라", icon: CameraIcon },
  ];

  return (
    <Footer role="navigation" aria-label="하단 내비게이션">
      {items.map(({ to, label, icon }) => {
        const active =
          pathname === to || (to !== "/" && pathname.startsWith(to));
        return (
          <FooterButton
            key={to}
            onClick={() => nav(to)}
            className={active ? "active" : ""}
            aria-current={active ? "page" : undefined}
          >
            <Icon src={icon} alt={`${label} 아이콘`} />
            <Label>{label}</Label>
          </FooterButton>
        );
      })}
    </Footer>
  );
}

/* ========== styled-components ========== */

const Footer = styled.footer`
  position: fixed;
  left: 0;
  right: 0;
  bottom: 0;
  /* iOS safe-area 대응 */
  padding-bottom: env(safe-area-inset-bottom);
  height: 100px;
  display: flex;
  align-items: center;
  justify-content: space-around;
  background: #ffffff;
  border-top: 1px solid #e5e7eb;
  box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.04);
  z-index: 50;
`;

const FooterButton = styled.button`
  /* 버튼 기본 레이아웃: 아이콘 + 텍스트 가로 배치 */
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border: 0;
  background: transparent;
  border-radius: 10px;
  height:80px;

  font-size: 30px;
  font-weight: 600;
  color: #6b7280; /* gray-500 */
  cursor: pointer;

  transition: color 160ms ease, background-color 160ms ease, transform 80ms ease;

  &:hover {
    background-color: #f3f4f6; /* gray-100 */
    color: #374151; /* gray-700 */
  }

  &:active {
    transform: translateY(1px);
  }

  &.active {
    color: #111827; /* gray-900 */
    background-color: #a3b7fbff; /* indigo-50 느낌 */
    /* 필요하면 강조색 바꾸기 */
    /* outline: 2px solid #4f46e5; */
  }
`;

const Icon = styled.img`
  width: 30px;
  height: px;
  display: block;
  object-fit: contain;
`;

const Label = styled.span`
  line-height: 1;
  user-select: none;
`;
