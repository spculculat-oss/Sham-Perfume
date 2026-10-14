import path from 'node:path';
import { fileURLToPath } from 'node:url';
import app from './server/app';

const directory = path.dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PORT || 3000);
if (!Number.isInteger(PORT) || PORT < 0 || PORT > 65535) {
  throw new Error('PORT must be an integer between 0 and 65535.');
}

async function startServer() {
  if (process.env.NODE_ENV === 'production') {
    const { default: express } = await import('express');
    app.use(express.static(path.join(directory, 'dist')));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(directory, 'dist', 'index.html'));
    });
  } else {
    const { createServer } = await import('vite');
    const vite = await createServer({ server: { middlewareMode: true }, appType: 'spa' });
    app.use(vite.middlewares);
  }
  const server = app.listen(PORT, '0.0.0.0', () => {
    const address = server.address();
    const boundPort = typeof address === 'object' && address ? address.port : PORT;
    console.log(`Server started on http://0.0.0.0:${boundPort}`);
  });
}

startServer().catch((error) => {
  console.error('Unable to start the server:', error);
  process.exitCode = 1;
});
