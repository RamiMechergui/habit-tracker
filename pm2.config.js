// --- ENVIRONMENT & DB DIAGNOSTICS ---
console.log("=== DB Connection Resolution Debug ===");
console.log("Keys starting with MONGO in process.env:", Object.keys(process.env).filter(k => k.startsWith('MONGO')));
console.log("process.env.MONGO_URI:", process.env.MONGO_URI ? "DEFINED" : "UNDEFINED");
console.log("process.env.MONGO_URL:", process.env.MONGO_URL ? "DEFINED" : "UNDEFINED");
console.log("process.env.MONGODB_URL:", process.env.MONGODB_URL ? "DEFINED" : "UNDEFINED");
console.log("process.env.MONGOHOST:", process.env.MONGOHOST);
console.log("process.env.MONGOPORT:", process.env.MONGOPORT);
console.log("process.env.MONGOUSER:", process.env.MONGOUSER);

module.exports = {
  apps: [
    {
      name: 'habit-tracker-api',
      script: 'backend/server.js',
      env: {
        PORT: 5000,
        MONGO_URL: process.env.MONGO_URL,
        JWT_SECRET: process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod',
        ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
        NODE_ENV: 'production',
        CLIENT_URL: process.env.CLIENT_URL,
        KAFKA_BROKER: process.env.KAFKA_BROKER || '127.0.0.1:9092'
      }
    }
  ]
};
