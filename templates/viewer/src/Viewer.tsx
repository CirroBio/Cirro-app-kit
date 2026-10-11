import { useEffect, useState } from "react";
import { useViewerServices, useViewerState } from "@cirrobio/react-tool";
import type { FileSystemObject } from "@cirrobio/sdk";

type ToolState = { selectedPath?: string };

export function Viewer() {
  const { dataset, files, selectedFile, toolState, sendStateUpdate } = useViewerState();
  const { fileService } = useViewerServices();
  const restored: ToolState = toolState ? JSON.parse(toolState) : {};
  const [current, setCurrent] = useState<FileSystemObject | undefined>(undefined);
  const [preview, setPreview] = useState<string>("");

  // Pick the initial file: saved state, then the file the viewer was opened on, then the first file
  useEffect(() => {
    if (!files) return;
    const saved = files.find((f) => f.path === restored.selectedPath);
    const opened = files.find((f) => f.url === selectedFile?.url);
    setCurrent(saved ?? opened ?? files[0]);
  }, [files]);

  // Load the file whenever the selection changes; signed at the moment of use
  useEffect(() => {
    if (!current) return;
    sendStateUpdate(JSON.stringify({ selectedPath: current.path } satisfies ToolState));
    fileService.getProjectFile(current)
      .then((r) => r.text())
      .then((t) => setPreview(t.slice(0, 5000)))   // replace with real rendering
      .catch((e) => setPreview(`Could not load file: ${e.message}`));
  }, [current]);

  if (!files) return <p>Loading dataset…</p>;
  return (
    <main style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 16, padding: 16 }}>
      <aside>
        <h2>{dataset?.name}</h2>
        <ul>
          {files.map((f) => (
            <li key={f.id}>
              <button onClick={() => setCurrent(f)} aria-current={f.id === current?.id}>
                {f.name}
              </button>
            </li>
          ))}
        </ul>
      </aside>
      <section>
        <h3>{current?.name}</h3>
        <pre style={{ whiteSpace: "pre-wrap" }}>{preview}</pre>
      </section>
    </main>
  );
}
