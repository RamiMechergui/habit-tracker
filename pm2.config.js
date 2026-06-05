// --- ENVIRONMENT & DB DIAGNOSTICS ---
console.log("=== DB Connection Resolution Debug ===");
console.log("Keys starting with MONGO in process.env:", Object.keys(process.env).filter(k => k.startsWith('MONGO')));
console.log("process.env.MONGO_URI:", process.env.MONGO_URI ? "DEFINED" : "UNDEFINED");
console.log("process.env.MONGO_URL:", process.env.MONGO_URL ? "DEFINED" : "UNDEFINED");
console.log("process.env.MONGODB_URL:", process.env.MONGODB_URL ? "DEFINED" : "UNDEFINED");
console.log("process.env.MONGOHOST:", process.env.MONGOHOST);
console.log("process.env.MONGOPORT:", process.env.MONGOPORT);
console.log("process.env.MONGOUSER:", process.env.MONGOUSER);

const isRailway = Object.keys(process.env).some(key => key.startsWith('RAILWAY_'));

function isDockerComposeMongoUri(uri) {
  return /^mongodb(?:\+srv)?:\/\/(?:[^@]+@)?mongo(?::|\/|$)/i.test(uri || '');
}

function isUnresolvedRailwayReference(value) {
  return /\$\{\{[^}]+\}\}/.test(value || '');
}

// Resolve the base connection URI. On Railway, ignore the Docker Compose
// placeholder from .env.example if Railway also supplied a real Mongo URL.
const mongoCandidates = [
  { key: 'MONGO_URI', value: process.env.MONGO_URI },
  { key: 'MONGO_URL', value: process.env.MONGO_URL },
  { key: 'MONGODB_URL', value: process.env.MONGODB_URL },
  { key: 'MONGO_PUBLIC_URL', value: process.env.MONGO_PUBLIC_URL }
].filter(candidate => candidate.value);

let baseMongoUri = mongoCandidates.find(candidate => {
  if (isUnresolvedRailwayReference(candidate.value)) {
    console.warn(`Ignoring unresolved Railway variable reference in ${candidate.key}.`);
    return false;
  }
  if (isRailway && candidate.key === 'MONGO_URI' && isDockerComposeMongoUri(candidate.value)) {
    console.warn('Ignoring Docker Compose MONGO_URI on Railway so Railway Mongo variables can be used.');
    return false;
  }
  return true;
})?.value;

if (!baseMongoUri && process.env.MONGOHOST) {
  const host = process.env.MONGOHOST;
  const port = process.env.MONGOPORT || '27017';
  const user = process.env.MONGOUSER;
  const pass = process.env.MONGOPASSWORD;
  const dbName = process.env.MONGODATABASE || 'habit-db';
  
  if (user && pass) {
    baseMongoUri = `mongodb://${user}:${pass}@${host}:${port}/${dbName}?authSource=admin`;
  } else {
    baseMongoUri = `mongodb://${host}:${port}/${dbName}`;
  }
}

console.log("Base Resolved MONGO_URI:", baseMongoUri ? baseMongoUri.replace(/\/\/([^:]+):([^@]+)@/, '//xxxx:xxxx@') : "UNDEFINED");

// Helper function to rewrite the database name in the connection string
function getServiceMongoUri(baseUri, serviceDbName) {
  if (!baseUri) return undefined;
  try {
    const parsed = new URL(baseUri);
    parsed.pathname = '/' + serviceDbName;
    
    // Add critical connection options
    // 1. authSource=admin: Railway's credentials are created on the 'admin' database.
    //    When we specify a custom serviceDbName (like identity_db), we must tell MongoDB to
    //    authenticate against 'admin' instead of the service-specific DB.
    if (parsed.username && parsed.password) {
      parsed.searchParams.set('authSource', 'admin');
    }
    
    // 2. serverSelectionTimeoutMS & connectTimeoutMS: fail fast (5 seconds) instead of
    //    hanging indefinitely, so connection failures are logged immediately.
    parsed.searchParams.set('serverSelectionTimeoutMS', '5000');
    parsed.searchParams.set('connectTimeoutMS', '5000');
    
    return parsed.toString();
  } catch (e) {
    console.error(`Failed to parse base URI for database rewriting: ${e.message}`);
    // Fallback safe string builder if standard URL parsing fails (e.g. unresolved variables)
    const hasQuery = baseUri.includes('?');
    const baseWithoutQuery = hasQuery ? baseUri.split('?')[0] : baseUri;
    const existingQuery = hasQuery ? baseUri.split('?')[1] : '';
    
    let newUri = baseWithoutQuery;
    if (newUri.endsWith('/')) {
      newUri += serviceDbName;
    } else {
      newUri += '/' + serviceDbName;
    }
    
    const params = new URLSearchParams(existingQuery);
    if (baseUri.includes('@')) {
      params.set('authSource', 'admin');
    }
    params.set('serverSelectionTimeoutMS', '5000');
    params.set('connectTimeoutMS', '5000');
    
    return `${newUri}?${params.toString()}`;
  }
}

const commonEnv = {
  JWT_SECRET: process.env.JWT_SECRET || 'supersecretjwtkey_change_me_in_prod',
  ADMIN_PASSWORD: process.env.ADMIN_PASSWORD || 'admin123',
  NODE_ENV: 'production',
  CLIENT_URL: process.env.CLIENT_URL
};

module.exports = {
  apps: [
    // --- CORE SERVICES ---
    { name: 'login', port: 5101, path: 'backend/User/Identity/login' },
    { name: 'register', port: 5102, path: 'backend/User/Identity/register' },
    { name: 'logout', port: 5103, path: 'backend/User/Identity/logout' },
    { name: 'verify', port: 5104, path: 'backend/User/Identity/verify' },
    { name: 'daily', port: 5105, path: 'backend/User/Aggregator/daily' },
    { name: 'currentbook', port: 5107, path: 'backend/Admin/Management/currentbook' },
    { name: 'archives', port: 5108, path: 'backend/Admin/Management/archives' },

    // --- PROFILE SERVICES ---
    { name: 'settings', port: 5109, path: 'backend/User/Profile/settings' },
    { name: 'categories', port: 5110, path: 'backend/Admin/Management/categories' },
    { name: 'avatar', port: 5111, path: 'backend/User/Profile/avatar' },
    { name: 'profile', port: 5112, path: 'backend/User/Profile/profile' },

    // --- HABIT SERVICES ---
    { name: 'morning-habits', port: 5118, path: 'backend/User/Habits/morning-habits' },
    { name: 'bad-habits', port: 5119, path: 'backend/User/Habits/bad-habits' },
    { name: 'night-habits', port: 5120, path: 'backend/User/Habits/night-habits' },
    { name: 'weekend-duties', port: 5121, path: 'backend/User/Habits/weekend-duties' },
    { name: 'side-hustle', port: 5122, path: 'backend/User/Habits/side-hustle' },
    { name: 'video-editing', port: 5123, path: 'backend/User/Habits/video-editing' },
    { name: 'book-reading', port: 5124, path: 'backend/User/Habits/book-reading' },
    { name: 'system-check', port: 5125, path: 'backend/User/Habits/system-check' },
    { name: 'notes-service', port: 5132, path: 'backend/User/Habits/notes-service' },
    { name: 'tasks-service', port: 5131, path: 'backend/User/Habits/tasks-service' },

    // --- FINANCES & ANALYTICS ---
    { name: 'expenses', port: 5126, path: 'backend/User/Finances/expenses' },
    { name: 'scoring', port: 5106, path: 'backend/Admin/Analytics/scoring' },
    { name: 'analytics', port: 5113, path: 'backend/Admin/Analytics/analytics' },

    // --- ESSENTIALS MICROSERVICES ---
    { name: 'essentials',    port: 5127, path: 'backend/User/Essentials/item-service' },
    { name: 'notifications', port: 5128, path: 'backend/User/Essentials/notification-service' },
    { name: 'delivery-service', port: 5129, path: 'backend/User/Essentials/delivery-service' },
    { name: 'user-prefs',    port: 5130, path: 'backend/User/Essentials/user-prefs-service' }
  ].map(service => {
    // Dynamically resolve service-specific database names to preserve isolation
    let serviceDbName = service.name + '_db';
    if (service.name === 'login' || service.name === 'register') {
      serviceDbName = 'identity_db';
    } else if (service.name === 'side-hustle') {
      serviceDbName = 'hustle_db';
    } else if (service.name === 'video-editing') {
      serviceDbName = 'video_db';
    } else if (service.name === 'system-check') {
      serviceDbName = 'system_db';
    } else if (service.name === 'morning-habits') {
      serviceDbName = 'morning_db';
    } else if (service.name === 'bad-habits') {
      serviceDbName = 'bad_db';
    } else if (service.name === 'night-habits') {
      serviceDbName = 'night_db';
    } else if (service.name === 'weekend-duties') {
      serviceDbName = 'weekend_db';
    } else if (service.name === 'book-reading') {
      serviceDbName = 'book_reading_db';
    } else if (service.name === 'notes-service') {
      serviceDbName = 'notes_db';
    } else if (service.name === 'tasks-service') {
      serviceDbName = 'tasks_db';
    } else if (service.name === 'delivery-service') {
      serviceDbName = 'delivery_db';
    } else if (service.name === 'user-prefs') {
      serviceDbName = 'user_prefs_db';
    }

    const serviceMongoUri = getServiceMongoUri(baseMongoUri, serviceDbName);

    return {
      name: service.name,
      script: 'server.js',
      cwd: service.path,
      node_args: '--require /app/backend/global-error-handler.js --max-old-space-size=96',
      env: {
        ...commonEnv,
        MONGO_URI: serviceMongoUri,
        PORT: service.port,
        MORNING_SERVICE_URL: 'http://127.0.0.1:5118',
        BAD_SERVICE_URL: 'http://127.0.0.1:5119',
        NIGHT_SERVICE_URL: 'http://127.0.0.1:5120',
        WEEKEND_SERVICE_URL: 'http://127.0.0.1:5121',
        HUSTLE_SERVICE_URL: 'http://127.0.0.1:5122',
        VIDEO_SERVICE_URL: 'http://127.0.0.1:5123',
        BOOK_LOG_SERVICE_URL: 'http://127.0.0.1:5124',
        SYSTEM_SERVICE_URL: 'http://127.0.0.1:5125',
        EXPENSES_SERVICE_URL: 'http://127.0.0.1:5126',
        ANALYTICS_SERVICE_URL: 'http://127.0.0.1:5113',
        TASKS_SERVICE_URL: 'http://127.0.0.1:5131',
        KAFKA_BROKER: process.env.KAFKA_BROKER || '127.0.0.1:9092'
      }
    };
  })
};
