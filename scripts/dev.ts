const processes = [
  Bun.spawn(['bun', 'run', 'frontend:dev'], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  }),
  Bun.spawn(['bun', 'run', 'backend:dev'], {
    stdout: 'inherit',
    stderr: 'inherit',
    stdin: 'inherit',
  }),
];

const shutdown = () => {
  for (const process of processes) {
    process.kill();
  }
};

process.on('SIGINT', shutdown);
process.on('SIGTERM', shutdown);

const exitCode = await Promise.race(processes.map(process => process.exited));
shutdown();
process.exit(exitCode);
