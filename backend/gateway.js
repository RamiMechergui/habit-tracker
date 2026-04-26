const express = require('express');
const path = require('path');
const http = require('http');

const app = express();
const PORT = process.env.PORT || 10000;

// Simple, dependency-free proxy helper
const createProxy = (targetPort) => (req, res) => {
    const options = {
        hostname: '127.0.0.1',
        port: targetPort,
        path: req.originalUrl,
        method: req.method,
        headers: {
            ...req.headers,
            host: '127.0.0.1:' + targetPort
        }
    };

    const proxyReq = http.request(options, (proxyRes) => {
        res.writeHead(proxyRes.statusCode, proxyRes.headers);
        proxyRes.pipe(res, { end: true });
    });

    req.pipe(proxyReq, { end: true });
    
    proxyReq.on('error', (err) => {
        console.error(`[Gateway] Proxy Error (Port ${targetPort} / ${req.originalUrl}):`, err.message);
        res.status(502).json({ error: 'Microservice Unreachable', details: err.message });
    });
};

// --- Proxy Routes mapping to Microservices ---
app.use('/api/login', createProxy(5101));
app.use('/api/register', createProxy(5102));
app.use('/api/logout', createProxy(5103));
app.use('/api/verify', createProxy(5104));
app.use('/api/daily', createProxy(5105));
app.use('/api/scoring', createProxy(5106));
app.use('/api/currentbook', createProxy(5107));
app.use('/api/archives', createProxy(5108));
app.use('/api/settings', createProxy(5109));
app.use('/api/categories', createProxy(5110));
app.use('/api/avatar', createProxy(5111));
app.use('/api/profile', createProxy(5112));
app.use('/api/analytics', createProxy(5113));

// --- Serve Static Frontend Files ---
const frontendDistPath = path.join(__dirname, '../frontend/dist');
app.use(express.static(frontendDistPath));

// --- SPA Fallback ---
app.get('*', (req, res) => {
    res.sendFile(path.join(frontendDistPath, 'index.html'));
});

// Bind explicitly to 0.0.0.0 for external access
app.listen(PORT, '0.0.0.0', () => {
    console.log(`🚀 Node.js Gateway running successfully on 0.0.0.0:${PORT}`);
});
