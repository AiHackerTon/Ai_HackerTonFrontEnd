import styled from "styled-components";

export default function DoubleCheckModal({ onConfirm, onCancel, onclose, text }) {
  return (
    <Container>
      <Content>
        <Title>이렇게 말씀하셨나요?</Title>
        {text && <TextBox>{text}</TextBox>}

        <ButtonWrapper>
          <YesButton onClick={onConfirm}>확인</YesButton>
          <NoButton onClick={onCancel || onclose}>취소</NoButton>
        </ButtonWrapper>
      </Content>
    </Container>
  );
}

const Container = styled.div`
  position: fixed;
  inset: 0; /* 전체 화면 덮기 */
  background-color: rgba(0, 0, 0, 0.4); /* 반투명 배경 */
  display: flex;
  justify-content: center;
  align-items: center;
  z-index: 1000;
`;

const Content = styled.div`
  width: 400px;
  min-height: 400px;
  background-color: #fff;
  border-radius: 12px;
  padding: 24px;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
`;

const Title = styled.h2`
  font-size: 30px;
  margin-bottom: 16px;
  text-align: center;
  margin-bottom:40px;
`;

const TextBox = styled.div`
  padding: 12px;
  background: #f5f5f5;
  border-radius: 8px;
  min-height: 200px;
  margin-bottom: 24px;
  font-size: 30px;
`;

const ButtonWrapper = styled.div`
  display: flex;
  justify-content: space-around;
  margin-top: auto;
`;

const YesButton = styled.button`
  width: 150px;
  height: 60px;
  font-size: 30px;
  border: none;
  border-radius: 8px;
  background: #0b5fff;
  color: white;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #0044cc;
  }
`;

const NoButton = styled.button`
  width: 150px;
  height: 60px;
  font-size: 30px;
  border: none;
  border-radius: 8px;
  background: #e0e0e0;
  color: black;
  cursor: pointer;
  transition: background 0.2s;

  &:hover {
    background: #bdbdbd;
  }
`;
