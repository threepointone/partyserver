import { useEffect, useState } from "react";
import { createRoot } from "react-dom/client";
import { nanoid } from "nanoid";
import { usePartySocket } from "partysocket/react";

function App() {
  const [messages, setMessages] = useState<
    {
      topic: string;
      data: string;
    }[]
  >([]);

  const [id] = useState<string>(() => nanoid(8));

  const socket = usePartySocket({
    party: "pubsub",
    room: "default",
    id,
    onMessage: (evt) => {
      setMessages((messages) => [
        ...messages,
        JSON.parse(evt.data as string) as {
          topic: string;
          data: string;
        }
      ]);
    }
  });

  useEffect(() => {
    setInterval(() => {
      socket.send(
        JSON.stringify({
          topic: "example",
          data: `${socket.id} says hello!`
        })
      );
    }, 2000);
  }, [socket]);

  return (
    <div>
      Messages:
      {messages.map((message, i) => (
        <div key={i}>{JSON.stringify(message)}</div>
      ))}
    </div>
  );
}

createRoot(document.getElementById("root")!).render(<App />);
