module.exports = {
  apps: [
    {
      name: 'klompjes-dashboard',
      script: '/home/statistieken/public_html/node_modules/.bin/next',
      args: 'start',
      cwd: '/home/statistieken/public_html',
      node_args: '--max-old-space-size=192',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
        NEXT_TELEMETRY_DISABLED: '1',
      },
    },
  ],
}
