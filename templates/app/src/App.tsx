import { useEffect, useRef, useState } from "react";
import type { DataService } from "@cirrobio/sdk";
import type { Dataset, Project } from "@cirrobio/api-client";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

type AppProps = {
  dataService: DataService;
  tenantName: string;
  username: string;
  onSignOut: () => void;
};

export function App({ dataService, tenantName, username, onSignOut }: AppProps) {
  const [projects, setProjects] = useState<Project[] | null>(null);
  const [selected, setSelected] = useState<Project | null>(null);
  const [error, setError] = useState("");

  useEffect(() => {
    dataService.projects.getProjects()
      .then(setProjects)
      .catch((e) => setError(errorText(e)));
  }, [dataService]);

  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif" }}>
      <header style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline" }}>
        <h1>Cirro app</h1>
        <span>
          {/* Always show which tenant the user is signed in to */}
          {tenantName} · {username}{" "}
          <button onClick={onSignOut}>Sign out</button>
        </span>
      </header>

      {error && <p role="alert">Could not load projects: {error}</p>}
      {!projects && !error && <p>Loading projects…</p>}
      {projects?.length === 0 && <p>You aren't a member of any projects in this tenant yet.</p>}

      <div style={{ display: "grid", gridTemplateColumns: "280px 1fr", gap: 24 }}>
        <ul style={{ listStyle: "none", padding: 0 }}>
          {projects?.map((p) => (
            <li key={p.id}>
              <button onClick={() => setSelected(p)} aria-current={p.id === selected?.id}>
                {p.name}
              </button>
            </li>
          ))}
        </ul>
        {selected && <Datasets key={selected.id} dataService={dataService} project={selected} />}
      </div>
    </main>
  );
}

function Datasets({ dataService, project }: { dataService: DataService; project: Project }) {
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  // Cleared on unmount so a response that arrives late can't update a list that's gone.
  const active = useRef(true);

  const load = (token?: string) => {
    setLoading(true);
    dataService.datasets.getDatasets({ projectId: project.id, limit: 50, nextToken: token })
      .then((page) => {
        if (!active.current) return;
        setDatasets((prev) => (token ? [...prev, ...page.data] : page.data));
        setNextToken(page.nextToken || undefined);
      })
      .catch((e) => active.current && setError(errorText(e)))
      .finally(() => active.current && setLoading(false));
  };

  // App keys this component by project, so a new project gets a fresh instance and state.
  useEffect(() => {
    active.current = true;
    load();
    return () => { active.current = false; };
  }, []);

  return (
    <section>
      <h2>{project.name}</h2>
      <p>Project ID <code>{project.id}</code></p>
      {error && <p role="alert">Could not load datasets: {error}</p>}
      <table>
        <thead><tr><th align="left">Dataset</th><th align="left">ID</th><th align="left">Created</th></tr></thead>
        <tbody>
          {datasets.map((d) => (
            <tr key={d.id}>
              <td>{d.name}</td>
              <td><code>{d.id}</code></td>
              <td>{new Date(d.createdAt).toLocaleDateString()}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {!loading && !error && datasets.length === 0 && <p>No datasets in this project.</p>}
      {loading && <p>Loading datasets…</p>}
      {nextToken && !loading && <button onClick={() => load(nextToken)}>Load more</button>}
    </section>
  );
}
