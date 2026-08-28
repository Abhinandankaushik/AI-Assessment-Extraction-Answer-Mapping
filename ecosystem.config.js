// pm2 process definition for a self-hosted deploy (EC2 or any Linux box).
//   pm2 start ecosystem.config.js && pm2 save && pm2 startup
//
// The Gemini key is deliberately NOT here — this file is committed. Put it in
// .env.local beside package.json, which Next reads in production too.
module.exports = {
  apps: [
    {
      name: "veda",
      script: "npm",
      args: "start",
      // One instance. Nothing in the app holds server-side state, so cluster
      // mode is safe in principle, but a run is long and memory-hungry rather
      // than request-heavy, and a second worker on a 2GB box costs more than
      // it returns.
      instances: 1,
      autorestart: true,
      // A single upload can carry a 10MB file as base64, and a long paper is
      // marked in one pass. Restarting below that turns a slow run into a
      // failed one.
      max_memory_restart: "1G",
      env: {
        NODE_ENV: "production",
        PORT: 3000,
      },
      time: true,
    },
  ],
};
