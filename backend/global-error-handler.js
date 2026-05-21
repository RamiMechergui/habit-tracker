// global-error-handler.js
// This script is preloaded into all microservices via node_args to prevent crashes
// from unhandled promise rejections (e.g. database timeouts or connection failures).

process.on('unhandledRejection', (reason, promise) => {
  console.error('⚠️ [Global Error Handler] Unhandled Promise Rejection:', reason);
  // Intercept the rejection and prevent the Node.js process from exiting/crashing.
  // This prevents PM2 from entering an aggressive infinite restart loop.
});

process.on('uncaughtException', (error) => {
  console.error('💥 [Global Error Handler] Uncaught Exception:', error);
  // Intercept uncaught exceptions to keep the service port open if possible.
});

console.log('🛡️ Global Error Handler preloaded successfully.');
