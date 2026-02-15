const express = require('express');
const fs = require('fs');
const crypto = require('crypto');
const Rcon = require('minecraft-bedrock-rcon');

const app = express();
app.use(express.json());

const BAD_CODES_FILE = './badCodes.txt';
let usedCodes = new Set();

// Load already used codes
if (fs.existsSync(BAD_CODES_FILE)) {
    fs.readFileSync(BAD_CODES_FILE, 'utf-8')
      .split('\n')
      .filter(Boolean)
      .forEach(c => usedCodes.add(c));
}

// Active codes in memory
let activeCodes = new Set();

// RCON setup
const rconOptions = {
    host: 'localhost',
    port: 19132,
    password: 'YOUR_RCON_PASSWORD'
};

// Generate a 15-char alphanumeric code
function generateCode() {
    let code;
    do {
        const bytes = crypto.randomBytes(15);
        code = Array.from(bytes).map(b => (b % 36).toString(36)).join('');
    } while (usedCodes.has(code) || activeCodes.has(code));
    activeCodes.add(code);
    return code;
}

// Push code to Bedrock WDP
async function pushCodeToWDP(code) {
    const rcon = new Rcon(rconOptions);
    await rcon.connect();
    await rcon.sendCommand(`world set dynamic_property code_${code} true`);
    await rcon.close();
}

// Redeem code (delete from WDP & mark as used)
async function redeemCode(code) {
    const rcon = new Rcon(rconOptions);
    await rcon.connect();
    await rcon.sendCommand(`world remove dynamic_property code_${code}`);
    await rcon.close();

    activeCodes.delete(code);
    usedCodes.add(code);
    fs.appendFileSync(BAD_CODES_FILE, code + '\n');
}

// Endpoint for frontend to get a new code
app.post('/generate-code', async (req, res) => {
    const { item } = req.body;
    if (!item) return res.json({ success: false });

    try {
        const code = generateCode();
        await pushCodeToWDP(code);
        res.json({ success: true, code });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

// Example endpoint to redeem code
app.post('/redeem-code', async (req, res) => {
    const { code } = req.body;
    if (!code || !activeCodes.has(code)) return res.json({ success: false, message: 'Invalid or already used code' });

    try {
        await redeemCode(code);
        res.json({ success: true });
    } catch (err) {
        console.error(err);
        res.json({ success: false });
    }
});

app.listen(3000, () => console.log('Server running on port 3000'));
