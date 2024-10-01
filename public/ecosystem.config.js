module.exports = {
    apps: [{
      name: 'Server',
      script: './Server.js',
      env: {
        NODE_ENV: 'production',
        DB_USER: 'SA',
        DB_PASSWORD: '2harmaine!',
        DB_SERVER: 'localhost',
        DB_NAME: 'Capstone'
      }
    }]
  };