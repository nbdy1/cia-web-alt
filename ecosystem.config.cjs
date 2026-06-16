module.exports = {
  apps: [
    {
      name: "cia-web-alt",
      script: ".next/standalone/server.js",
      cwd: __dirname,
      env: {
        NODE_ENV: "production",
        HOSTNAME: "127.0.0.1",
        PORT: process.env.PORT || 3000,
      },
    },
  ],
};
