module.exports = {
  apps: [
    {
      name: 'klompjes-dashboard',
      script: '/home/statistieken/public_html/node_modules/.bin/next',
      args: 'start',
      cwd: '/home/statistieken/public_html',
      node_args: '--max-old-space-size=256',
      instances: 1,
      exec_mode: 'fork',
      autorestart: true,
      watch: false,
      max_memory_restart: '512M',
      env: {
        NODE_ENV: 'production',
        PORT: 3000,
      },
    },
  ],
}
