import React, { useCallback, useEffect, useRef } from "react";
import { io, Socket } from "socket.io-client";
import { DefaultEventsMap } from "socket.io/dist/typed-events";
import { WebRTCUser } from "../@types";
import { SOCKET_SERVER_URL } from "../App";
import Video from "./Video";

const peerConnectionConfig: RTCConfiguration = {
  iceServers: [
    {
      urls: "stun:stun.l.google.com:19302",
    },
  ],
};
function Room({
  users,
  setUsers,
  name,
  room,
  socketRef,
}: {
  users: WebRTCUser[];
  setUsers: React.Dispatch<React.SetStateAction<WebRTCUser[]>>;
  name: string;
  room: string;
  socketRef: React.MutableRefObject<
    Socket<DefaultEventsMap, DefaultEventsMap> | undefined
  >;
}) {
  const myVideo = useRef<HTMLVideoElement>(null);
  const myStream = useRef<MediaStream>();

  const peerConnectionsRef = useRef<{
    [socketId: string]: RTCPeerConnection;
  }>({});

  const streamVideo = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: false,
        video: {
          height: 240,
          width: 240,
        },
      });
      myStream.current = stream;
      if (myVideo.current) myVideo.current.srcObject = myStream.current;
      if (!socketRef.current) return;
      socketRef.current.emit("joinRoom", { name, room });
    } catch (error) {
      console.error("Error accessing media devices.", error);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const createPeerConnection = useCallback(
    ({ socketId, name }: { socketId: string; name: string }) => {
      try {
        const peerConnection = new RTCPeerConnection(peerConnectionConfig);
        peerConnection.addEventListener("icecandidate", ({ candidate }) => {
          if (!socketRef.current || !candidate) return;
          socketRef.current.emit("candidate", {
            candidate,
            senderId: socketRef.current.id,
            receiverId: socketId,
          });
        });

        peerConnection.addEventListener("track", ({ streams }) => {
          setUsers((prevState: WebRTCUser[]): WebRTCUser[] => {
            return prevState
              .filter((user) => user.id !== socketId)
              .concat({
                id: socketId,
                name,
                stream: streams[0],
              });
          });
        });

        if (myStream.current) {
          myStream.current.getTracks().forEach((track) => {
            if (!myStream.current) return;
            peerConnection.addTrack(track, myStream.current);
          });
        } else {
          console.log("no local stream");
        }

        return peerConnection;
      } catch (err) {
        console.error(err);
        return undefined;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    []
  );

  useEffect(() => {
    socketRef.current = io(SOCKET_SERVER_URL, { extraHeaders: {} });
    streamVideo();

    socketRef.current.on<"myCandidate">(
      "myCandidate",
      async ({
        candidate,
        senderId,
      }: {
        candidate: RTCIceCandidateInit;
        senderId: string;
      }) => {
        const peerConnection: RTCPeerConnection =
          peerConnectionsRef.current[senderId];
        if (!peerConnection) return;
        await peerConnection.addIceCandidate(new RTCIceCandidate(candidate));
      }
    );

    socketRef.current.on<"users">(
      "users",
      async (users: { name: string; id: string }[]) => {
        users.forEach(async (user) => {
          const peerConnection = createPeerConnection({
            socketId: user.id,
            name: user.name,
          });
          if (!peerConnection || !socketRef.current) return;
          peerConnectionsRef.current = {
            ...peerConnectionsRef.current,
            [user.id]: peerConnection,
          };
          try {
            const sessionDescription = await peerConnection.createOffer({
              offerToReceiveAudio: true,
              offerToReceiveVideo: true,
            });
            await peerConnection.setLocalDescription(
              new RTCSessionDescription(sessionDescription)
            );
            socketRef.current.emit("offer", {
              sessionDescription,
              senderId: socketRef.current.id,
              senderName: user.name,
              receiverId: user.id,
            });
          } catch (e) {
            console.error(e);
          }
        });
      }
    );

    socketRef.current.on<"myOffer">(
      "myOffer",
      async ({
        sessionDescription,
        senderId,
        senderName,
      }: {
        sessionDescription: RTCSessionDescriptionInit;
        senderId: string;
        senderName: string;
      }) => {
        if (!myStream.current) return;
        const peerConnection = createPeerConnection({
          socketId: senderId,
          name: senderName,
        });
        if (!peerConnection || !socketRef.current) return;
        peerConnectionsRef.current = {
          ...peerConnectionsRef.current,
          [senderId]: peerConnection,
        };
        try {
          await peerConnection.setRemoteDescription(
            new RTCSessionDescription(sessionDescription)
          );
          const localDescription = await peerConnection.createAnswer({
            offerToReceiveVideo: true,
            offerToReceiveAudio: true,
          });
          await peerConnection.setLocalDescription(
            new RTCSessionDescription(localDescription)
          );
          socketRef.current.emit("answer", {
            sessionDescription: localDescription,
            senderId: socketRef.current.id,
            receiverId: senderId,
          });
        } catch (e) {
          console.error(e);
        }
      }
    );

    socketRef.current.on<"myAnswer">(
      "myAnswer",
      ({
        sessionDescription,
        senderId,
      }: {
        sessionDescription: RTCSessionDescription;
        senderId: string;
      }) => {
        const peerConnection: RTCPeerConnection =
          peerConnectionsRef.current[senderId];
        if (!peerConnection) return;
        peerConnection.setRemoteDescription(
          new RTCSessionDescription(sessionDescription)
        );
      }
    );
    socketRef.current.on("exit", ({ id }: { id: string }) => {
      if (!peerConnectionsRef.current[id]) return;
      peerConnectionsRef.current[id].close();
      delete peerConnectionsRef.current[id];
      setUsers((oldUsers) => oldUsers.filter((user) => user.id !== id));
    });

    return () => {
      if (socketRef.current) {
        socketRef.current.close();
      }
      users.forEach((user) => {
        if (!peerConnectionsRef.current[user.id]) return;
        peerConnectionsRef.current[user.id].close();
        delete peerConnectionsRef.current[user.id];
      });
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [createPeerConnection, streamVideo]);
  return (
    <>
      <p>
        {name}, room: {room}
      </p>
      <video
        id="localVideo"
        autoPlay
        playsInline
        controls={false}
        ref={myVideo}
      />
      {users.map(({ name, stream }, index) => {
        return <Video key={index} name={name} stream={stream} />;
      })}
    </>
  );
}

export default Room;
