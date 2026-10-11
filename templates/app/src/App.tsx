import { useEffect, useState } from "react";
import { useAppConfig } from "@cirrobio/react-core";
import { useAuthenticator } from "@cirrobio/react-auth";
import type { Dataset, Project } from "@cirrobio/api-client";
import { can, roleIn } from "./capabilities";

const errorText = (e: unknown) => (e instanceof Error ? e.message : String(e));

export function App() {
  const { appConfig, dataService, authProvider } = useAppConfig();
  const { userInfo } = useAuthenticator();
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
          {appConfig?.tenantInfo?.name} · {userInfo?.name}{" "}
          <button onClick={() => authProvider.signOut()}>Sign out</button>
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
              </button>{" "}
              <small>{roleIn(userInfo, p.id).toLowerCase()}</small>
            </li>
          ))}
        </ul>
        {selected && <Datasets project={selected} />}
      </div>
    </main>
  );
}

function Datasets({ project }: { project: Project }) {
  const { dataService } = useAppConfig();
  const { userInfo } = useAuthenticator();
  const [datasets, setDatasets] = useState<Dataset[]>([]);
  const [nextToken, setNextToken] = useState<string | undefined>();
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const load = (token?: string) => {
    setLoading(true);
    dataService.datasets.getDatasets({ projectId: project.id, limit: 50, nextToken: token })
      .then((page) => {
        setDatasets((prev) => (token ? [...prev, ...page.data] : page.data));
        setNextToken(page.nextToken || undefined);
      })
      .catch((e) => setError(errorText(e)))
      .finally(() => setLoading(false));
  };

  useEffect(() => { setDatasets([]); setError(""); load(); }, [project.id]);

  return (
    <section>
      <h2>{project.name}</h2>
      <p>
        Project ID <code>{project.id}</code>
        {/* An example of gating a feature on the user's role; see src/capabilities.ts */}
        {can(userInfo, project.id, "createDatasets")
          ? " · You can add datasets here."
          : " · You can view this project but not add datasets."}
      </p>
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
