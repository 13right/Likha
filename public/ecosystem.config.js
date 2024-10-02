module.exports = {
  apps: [{
    name: "server",
    script: "LIKHA DRAFTS/public/Server.js", // Adjust the path based on the actual location
    env: {
      NODE_ENV: "development",
      DB_USER: process.env.DB_USER,
      DB_PASSWORD: process.env.DB_PASSWORD,
      DB_SERVER: process.env.DB_SERVER,
      DB_DATABASE: process.env.DB_DATABASE,
      DB_ENCRYPT: process.env.DB_ENCRYPT,
    },
    env_production: {
      NODE_ENV: "production",
      // Add other production variables here if needed
    }
  }]
}