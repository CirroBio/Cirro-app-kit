// Sample data for ?cirro-app=mock (CONTRACT.md section 9). Never point fixtures at real data.
export default {
  appName: 'My App',
  projects: [
    {
      id: 'p1',
      name: 'Example project',
      datasets: [
        { id: 'd1', name: 'Example dataset', files: [{ path: 'data/hello.txt', size: 6, url: './dev/hello.txt' }] },
      ],
    },
  ],
};
