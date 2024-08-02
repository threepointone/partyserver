import { createRoot } from "react-dom/client";
import useYProvider from "y-partyserver/react";

import "@blocknote/core/fonts/inter.css";

import { BlockNoteView } from "@blocknote/mantine";
import { useCreateBlockNote } from "@blocknote/react";

import "@blocknote/mantine/style.css";

import { getRandomUser } from "./randomUser";

function Editor() {
  const provider = useYProvider({
    room: "my-document-id",
    party: "document"
  });

  const editor = useCreateBlockNote({
    collaboration: {
      // The Yjs Provider responsible for transporting updates:
      provider,
      // Where to store BlockNote data in the Y.Doc:
      fragment: provider.doc.getXmlFragment("document-store"),
      // Information (name and color) for this user:
      user: getRandomUser()
    }
  });
  return <BlockNoteView editor={editor} />;
}

const root = createRoot(document.getElementById("root")!);
root.render(<Editor />);
