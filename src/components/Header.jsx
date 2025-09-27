import styled from "styled-components";
import { useNavigate } from "react-router-dom";


function Header() {

  const nav = useNavigate();
  return (
    <HeaderWrap>
      <Logo>
        <LogoIcon src="../../public/assets/Logo4.png" />
      </Logo>
      <IconButton aria-label="설정">
        <AlarmIcon onClick={() => nav("/reminder")} src="../../public/assets/alarmIcon.png" />
      </IconButton>
    </HeaderWrap>
  );
}

export default Header;


const HeaderWrap = styled.header`
  width: 100%;
  height: 64px;
  background: #2879BD;
  border-bottom: 1px solid #e5e5e5;
  display: flex;
  justify-content: space-between;
  align-items: center;
  padding: 0 16px;
`;

const AlarmIcon = styled.img`
  width:40px;
  height:40px;
  cursor: pointer;
`


const LogoIcon = styled.img`
  width: 100px;
  height: 90px;
  margin-top:6px;
`;

const Logo = styled.div`

`
const IconButton = styled.button`
  background: none;
  border: none;
  padding: 6px;
  border-radius: 8px;
  cursor: pointer;
  color: white;

`;

