import React, { useState } from "react";
import styled from "styled-components";

const Container = styled.div`
  position: relative;
  display: inline-block;
  width: 240px;
  height: 270px;
  margin: 5px;
`;

interface Props {
  setUser: ({ name, room }: { name: string; room: string }) => any;
}

const Login = ({ setUser }: Props) => {
  const [name, setName] = useState("");
  const [room, setRoom] = useState("");
  return (
    <Container>
      <form>
        <input
          type="text"
          value={name}
          onChange={(e) => {
            setName(e.target.value);
          }}
        />
        <input
          type="text"
          value={room}
          onChange={(e) => {
            setRoom(e.target.value);
          }}
        />
        <button
          onClick={() => {
            setUser({ name, room });
          }}
        >
          Log in
        </button>
      </form>
    </Container>
  );
};

export default Login;
