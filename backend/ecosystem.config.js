module.exports = {
  apps: [
    {
      name: 'ubnd-backend',
      script: 'server.js',
      cwd: __dirname,
      exec_mode: 'fork',
      instances: 1,
      autorestart: true,
      watch: false,
      max_memory_restart: '200M',
      env: {
        NODE_ENV: 'development',
        PORT: 5000
      },
      env_production: {
        NODE_ENV: 'production',
        PORT: 5000,
        ALLOW_LOCALHOST: 'true'
      }
    }
    ,
    {
      name: 'prune-sessions',
      script: 'node',
      args: 'scripts/prune_sessions.js',
      cwd: __dirname,
      exec_mode: 'fork',
      autorestart: false,
      watch: false,
      // Note: pm2 supports cron_restart to restart a process on schedule. This entry provides a reference
      // but using the pm2 CLI with --cron is recommended: `pm2 start scripts/prune_sessions.js --name prune-sessions --cron "0 3 * * *"`
      cron_restart: '0 3 * * *',
      env: {
        NODE_ENV: 'production'
      }
    }
  ]
};
