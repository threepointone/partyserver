import { Tldraw, track, useEditor } from "tldraw";

import "tldraw/tldraw.css";

import { useSyncStore } from "./useSyncStore";

export default function SyncExample() {
  const store = useSyncStore({
    roomId: "example",
    hostUrl: window.location.origin
  });

  return (
    <div className="tldraw__editor">
      <Tldraw
        // eslint-disable-next-line jsx-a11y/no-autofocus
        autoFocus
        store={store}
        components={{
          SharePanel: NameEditor
        }}
      />
    </div>
  );
}

const NameEditor = track(() => {
  const editor = useEditor();

  const { color, name } = editor.user.getUserPreferences();

  return (
    <div style={{ pointerEvents: "all", display: "flex" }}>
      <input
        type="color"
        value={color}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            color: e.currentTarget.value
          });
        }}
      />
      <input
        value={name}
        onChange={(e) => {
          editor.user.updateUserPreferences({
            name: e.currentTarget.value
          });
        }}
      />
    </div>
  );
});
