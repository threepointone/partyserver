import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import { nanoid } from "nanoid";
import { usePartySocket } from "partysocket/react";

import type { ChatMessage } from "../src/chat-types";

const randomNames = [
  "Alice",
  "Bob",
  "Charlie",
  "David",
  "Eve",
  "Frank",
  "Grace",
  "Heidi",
  "Ivan",
  "Judy",
  "Mallory",
  "Oscar",
  "Peggy",
  "Trent",
  "Wendy"
];

const me =
  sessionStorage.getItem("me") ??
  randomNames[Math.floor(Math.random() * randomNames.length)];

function App() {
  const [messages, setMessages] = useState<Array<ChatMessage>>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const socket = usePartySocket({
    room: "abc",
    party: "chat",
    onOpen() {
      console.log("Connected to the party!");
    },
    onMessage(evt) {
      console.log("Received a message:", evt.data);
      const message = JSON.parse(evt.data as string) as ChatMessage;
      setMessages((prevMessages) => [...prevMessages, message]);
    }
  });
  return (
    <>
      <div>
        {messages.map((message) => (
          <div className="message" key={message.id}>
            <span className="user">{message.sender}:</span>
            {message.content}
          </div>
        ))}
      </div>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          if (inputRef.current) {
            socket.send(
              JSON.stringify({
                id: nanoid(),
                type: "chat-message",
                content: inputRef.current.value,
                sender: me
              } satisfies ChatMessage)
            );
            inputRef.current.value = "";
          }
        }}
      >
        <input type="text" ref={inputRef} />
      </form>
    </>
  );
}

const root = createRoot(document.getElementById("root")!);

root.render(<App />);
