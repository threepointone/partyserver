// import { useRef, useState } from "react";
import { createRoot } from "react-dom/client";
import Collaboration from "@tiptap/extension-collaboration";
import CollaborationCursor from "@tiptap/extension-collaboration-cursor";
// import { nanoid } from "nanoid";

// src/Tiptap.jsx
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";

import useYProvider from "./react";

// 5 bright colors
const colours = ["#FF0000", "#00FF00", "#0000FF", "#FFFF00", "#00FFFF"];

// Pick a random color from the list
// This is just for demonstration purposes
const MY_COLOR = colours[Math.floor(Math.random() * colours.length)];

function Tiptap() {
  const provider = useYProvider({
    party: "document",
    room: "y-partyserver-text-editor-example" // replace with your own document name
  });

  const editor = useEditor({
    extensions: [
      StarterKit.configure({
        // The Collaboration extension comes with its own history handling
        history: false
      }),
      Collaboration.configure({
        document: provider.doc
      }),
      // Register the collaboration cursor extension
      CollaborationCursor.configure({
        provider: provider,
        user: {
          name: provider.id,
          color: MY_COLOR
        }
      })
    ]
  });

  return <EditorContent style={{ border: "solid" }} editor={editor} />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<Tiptap />);
