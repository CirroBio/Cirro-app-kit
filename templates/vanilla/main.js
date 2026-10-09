// A Cirro app in its smallest form: when the portal hosts it, connect, then list the user's
// datasets. Open index.html?cirro-app=mock to run it on the sample data in dev/fixtures.js.
import { hostedMode } from './vendor/cirro-app-mode.js';

const APP_ID = 'myapp';
const APP_VERSION = '0.1.0';
const status = document.getElementById('status');
const list = document.getElementById('datasets');

async function main() {
  if (!hostedMode()) {
    status.textContent = 'Not opened from Cirro. Add ?cirro-app=mock to the URL to try it with sample data.';
    return;
  }
  // Loaded only when hosted, so the page opened on its own never downloads the kit.
  const { connectToCirro } = await import('./vendor/cirro-app-kit.js');
  const session = await connectToCirro({
    appId: APP_ID,
    appVersion: APP_VERSION,
    mock: () => import('./dev/fixtures.js').then((module) => module.default),
  });
  status.textContent = `Signed in to ${session.tenant.name} as ${session.user.name ?? session.user.id}.`;
  for (const project of await session.api.projects.getProjects()) {
    const { data } = await session.api.datasets.getDatasets({ projectId: project.id });
    for (const dataset of data) {
      const item = document.createElement('li');
      item.textContent = `${project.name} / ${dataset.name}`;
      list.append(item);
    }
  }
}

main().catch((error) => {
  status.textContent = `Could not reach Cirro: ${error.message}`;
});
