module.exports = {
  apps: [
    {
      name: `order-back-app`,
      cwd: __dirname,
      script: "./back/app.js",
      env: {
        PORT: 3030,
      },
      max_memory_restart: "300M",
      node_args: [],
      exec_mode: "fork",
      out_file: "logs-back.log",
      error_file: "/dev/null",
    },
    {
      name: `order-front-app`,
      cwd: __dirname,
      env: {
        FASTBOOT_DISABLED: true,
      },
      script: "./node_modules/.bin/ember serve",
      max_memory_restart: "500M",
      exec_mode: "fork",  
      out_file: "logs-front.log",
      error_file: "/dev/null",
    },
  ],
};
