export function ConfigError({ problems }: { problems: string[] }) {
  return (
    <main style={{ padding: 24, fontFamily: "system-ui, sans-serif", maxWidth: 640 }}>
      <h1>App not configured</h1>
      <p>Fix these in <code>.env</code>, then restart <code>npm run dev</code>:</p>
      <ul>{problems.map((p) => <li key={p}>{p}</li>)}</ul>
    </main>
  );
}
