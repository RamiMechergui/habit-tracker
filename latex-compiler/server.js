const express = require('express');
const { exec } = require('child_process');
const { promisify } = require('util');
const fs = require('fs');
const path = require('path');
const os = require('os');
const crypto = require('crypto');

const execAsync = promisify(exec);
const app = express();
const PORT = process.env.PORT || 4000;

app.use(express.json({ limit: '10mb' }));

// Health check
app.get('/health', (_req, res) => res.json({ status: 'ok' }));

// Compile LaTeX to PDF
app.post('/compile', async (req, res) => {
  const id = crypto.randomBytes(8).toString('hex');
  const tmpDir = path.join(os.tmpdir(), `latex-${id}`);

  try {
    const { texContent } = req.body;
    if (!texContent) {
      return res.status(400).json({ error: 'texContent is required' });
    }

    fs.mkdirSync(tmpDir, { recursive: true });
    fs.writeFileSync(path.join(tmpDir, 'report.tex'), texContent, 'utf8');

    const execOpts = { cwd: tmpDir, timeout: 180000, maxBuffer: 10 * 1024 * 1024 };

    // Pass 1: generate .toc and .idx files (ignore non-zero exit from warnings)
    try {
      await execAsync(
        'pdflatex -interaction=nonstopmode report.tex',
        execOpts
      );
    } catch (_) {
      // pdflatex may exit non-zero due to warnings; continue if output exists
    }

    // Build indexes (best-effort)
    for (const idx of ['grammar', 'verbs', 'vocabulary', 'expressions']) {
      try {
        await execAsync(`makeindex ${idx}.idx`, { cwd: tmpDir, timeout: 30000 });
      } catch (_) {}
    }

    // Pass 2: resolve cross-references, TOC, and indexes
    try {
      await execAsync(
        'pdflatex -interaction=nonstopmode report.tex',
        execOpts
      );
    } catch (_) {}

    const pdfPath = path.join(tmpDir, 'report.pdf');
    if (!fs.existsSync(pdfPath)) {
      const logPath = path.join(tmpDir, 'report.log');
      const log = fs.existsSync(logPath) ? fs.readFileSync(logPath, 'utf8').slice(-3000) : '';
      return res.status(500).json({ error: 'Compilation failed', log });
    }

    const pdfBuffer = fs.readFileSync(pdfPath);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': 'attachment; filename="report.pdf"',
    });
    res.end(pdfBuffer);
  } catch (err) {
    console.error(`[${id}] Compilation error:`, err.message);

    // Try to get the log for debugging
    let log = '';
    try {
      const logPath = path.join(tmpDir, 'report.log');
      if (fs.existsSync(logPath)) {
        log = fs.readFileSync(logPath, 'utf8').slice(-3000);
      }
    } catch (_) {}

    res.status(500).json({
      error: err.message.includes('timeout')
        ? 'Compilation timed out (180s limit)'
        : 'Compilation failed',
      log,
    });
  } finally {
    try { fs.rmSync(tmpDir, { recursive: true, force: true }); } catch (_) {}
  }
});

app.listen(PORT, () => {
  console.log(`LaTeX compiler service listening on port ${PORT}`);
});
