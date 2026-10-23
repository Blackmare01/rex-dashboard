const fs = require('node:fs');
const path = require('node:path');

// Node does not load Cloudflare's .dev.vars automatically. Load only missing
// process variables so regular environment variables remain authoritative.
const varsPath = path.join(__dirname, '.dev.vars');
if (fs.existsSync(varsPath)) {
  for (const line of fs.readFileSync(varsPath, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
    if (!match || match[1].startsWith('#') || process.env[match[1]] !== undefined) continue;
    let value = match[2];
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    process.env[match[1]] = value;
  }
}

module.exports = process.env;
