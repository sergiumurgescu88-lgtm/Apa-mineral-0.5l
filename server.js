
/**
 * Helios Backend - PVsystCLI Automation & Digital Twin Server
 * 
 * Instructions:
 * 1. Install dependencies: `npm install express cors body-parser`
 * 2. Run server: `node server.js`
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

app.use(cors());
app.use(bodyParser.json());

// Default configuration
let config = {
  cliPath: 'C:\\Program Files\\PVsyst7.2\\PVsystCLI.exe',
  workspace: 'C:\\Users\\Public\\PVsyst7.0_Data',
};

// --- Helper: Command Executor ---
const runCommand = (cmd, args) => {
  return new Promise((resolve, reject) => {
    console.log(`[Executing] ${cmd} ${args.join(' ')}`);
    const process = spawn(cmd, args, { shell: true });
    let stdout = '';
    let stderr = '';
    process.stdout.on('data', (data) => { stdout += data.toString(); });
    process.stderr.on('data', (data) => { stderr += data.toString(); });
    process.on('close', (code) => {
      if (code !== 0) reject({ code, stderr, stdout }); 
      else resolve({ stdout, stderr });
    });
  });
};

// --- SIMULATION ENGINE STATE ---
const gridState = {
    mode: 'GRID_TIED', // GRID_TIED | ISLANDING
    batteryLevel: 85, // %
    frequency: 50.0
};

const robotFleet = {
    drones: { available: 5, active: 0 },
    rovers: { available: 3, active: 0 }
};

// --- CORE PVSYST ENDPOINTS (1-4) ---
app.post('/api/config', (req, res) => {
  const { cliPath, workspace } = req.body;
  if (cliPath) config.cliPath = cliPath;
  if (workspace) config.workspace = workspace;
  res.json({ message: 'Configuration updated', config });
});

app.get('/api/pvsyst/license', async (req, res) => {
  try {
    const { stdout } = await runCommand(config.cliPath, ['lic-info']);
    res.json({ status: 'success', output: stdout });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.stderr || error.stdout || error.message });
  }
});

app.post('/api/pvsyst/license/activate', async (req, res) => {
  const { key } = req.body;
  try {
    const { stdout } = await runCommand(config.cliPath, ['lic-activate', `--key="${key}"`]);
    res.json({ status: 'success', output: stdout });
  } catch (error) {
    res.status(500).json({ status: 'error', error: error.message });
  }
});

app.post('/api/pvsyst/convert-meteo', async (req, res) => {
  const { inputCsv, inputSit, outputMet } = req.body;
  const args = ['convert-meteo', `--input-csv-file="${inputCsv}"`, `--input-sit-file="${inputSit}"`, `--output-met-file="${outputMet}"`];
  try {
    const { stdout } = await runCommand(config.cliPath, args);
    res.json({ status: 'success', output: stdout });
  } catch (error) {
    res.status(500).json({ status: 'error', details: error });
  }
});

app.post('/api/pvsyst/simulate', async (req, res) => {
  const { project, variant, outputCsv } = req.body;
  const args = ['run-simulation', `--workspace="${config.workspace}"`, `--project="${project}"`, `--variant="${variant}"`, `--output-csv-file="${outputCsv || 'results.csv'}"`];
  try {
    const { stdout } = await runCommand(config.cliPath, args);
    res.json({ status: 'success', output: stdout, results: { raw: stdout } });
  } catch (error) {
    res.status(500).json({ status: 'error', details: error });
  }
});

// --- TOOL: READ URL (5) ---
app.post('/api/tools/read-url', async (req, res) => {
    const { url } = req.body;
    try {
        const response = await fetch(url);
        const text = await response.text();
        const cleanText = text.replace(/<[^>]+>/g, "\n").replace(/\s+/g, " ").trim().substring(0, 50000);
        res.json({ status: 'success', content: cleanText });
    } catch (error) {
        res.status(500).json({ status: 'error', error: error.message });
    }
});

// =========================================================================
// === NEW SMART HELIOS FEATURES (17-27) IMPLEMENTATION ===
// =========================================================================

// 17. FIRE RISK & 25. SMART CLEANING (Using Open-Meteo Free API)
// Combined endpoint because they both need Weather Data
app.get('/api/risk/analysis', async (req, res) => {
    const { lat, lng } = req.query;
    if (!lat || !lng) return res.status(400).json({ error: "Lat/Lng required" });

    try {
        // Fetch real weather data from Open-Meteo (Free)
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lng}&daily=temperature_2m_max,precipitation_sum,windspeed_10m_max&current_weather=true&timezone=auto`;
        const weatherRes = await fetch(weatherUrl);
        const weatherData = await weatherRes.json();

        // --- FIRE RISK LOGIC (Feature 17) ---
        const temp = weatherData.current_weather.temperature;
        const wind = weatherData.current_weather.windspeed;
        let fireRisk = 'LOW';
        if (temp > 30 && wind > 15) fireRisk = 'MODERATE';
        if (temp > 35 && wind > 20) fireRisk = 'HIGH';
        if (temp > 38 && wind > 25) fireRisk = 'EXTREME';

        // --- CLEANING SCHEDULE LOGIC (Feature 25) ---
        // Sum of next 3 days rain
        const rainNext3Days = (weatherData.daily?.precipitation_sum || []).slice(0, 3).reduce((a, b) => a + b, 0);
        let cleaningAction = 'CLEAN_NOW';
        let cleaningReason = 'Dry weather ahead.';
        
        if (rainNext3Days > 5.0) {
            cleaningAction = 'WAIT_FOR_RAIN';
            cleaningReason = `Heavy rain forecast (${rainNext3Days.toFixed(1)}mm) will clean panels naturally.`;
        }

        res.json({
            status: 'success',
            fireRisk: {
                level: fireRisk,
                details: `Temp: ${temp}°C, Wind: ${wind} km/h`,
                autoSuppressionStatus: fireRisk === 'EXTREME' ? 'ARMED' : 'STANDBY'
            },
            cleaning: {
                action: cleaningAction,
                reason: cleaningReason,
                rainForecast3Days: rainNext3Days,
                costSaved: cleaningAction === 'WAIT_FOR_RAIN' ? 8500 : 0
            }
        });

    } catch (error) {
        console.error("Weather API Error:", error);
        res.status(500).json({ error: "Failed to fetch environmental data" });
    }
});

// 18. FLOOD & EXTREME WEATHER (Using Open-Meteo Elevation)
app.get('/api/risk/flood', async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const elevRes = await fetch(`https://api.open-meteo.com/v1/elevation?latitude=${lat}&longitude=${lng}`);
        const elevData = await elevRes.json();
        const elevation = elevData.elevation?.[0] || 0;

        // Simple heuristic: Lower elevation = higher flood risk (mock logic)
        const floodRisk = elevation < 50 ? 'HIGH' : elevation < 100 ? 'MODERATE' : 'LOW';

        res.json({
            status: 'success',
            elevation: elevation,
            floodRisk: floodRisk,
            recommendation: floodRisk === 'HIGH' ? 'Check drainage systems immediately.' : 'Standard monitoring.'
        });
    } catch (error) {
        res.json({ status: 'mock', floodRisk: 'LOW', elevation: 85 });
    }
});

// 19. ROBOTIC DISPATCHER (Simulation)
app.post('/api/robots/dispatch', (req, res) => {
    const { type, target } = req.body;
    
    if (type === 'drone') {
        if (robotFleet.drones.available > 0) {
            robotFleet.drones.available--;
            robotFleet.drones.active++;
            return res.json({ 
                status: 'success', 
                missionId: `MSN-${Date.now()}`, 
                vehicle: 'DJI Matrice 300 RTK',
                eta: '4 mins' 
            });
        }
        return res.status(409).json({ error: "No drones available" });
    }
    
    // Rovers
    res.json({ status: 'success', vehicle: 'Clearpath Husky', task: 'Component Replacement' });
});

// 20. PANEL DNA (Mock Blockchain Verification)
app.post('/api/supply-chain/verify', (req, res) => {
    const { serials } = req.body; // array of strings
    const results = serials.map(s => ({
        serial: s,
        status: s.startsWith('FAKE') ? 'COUNTERFEIT' : 'AUTHENTIC',
        origin: s.startsWith('FAKE') ? 'Unknown Source' : 'Tier-1 Factory (Changzhou)',
        spectralSignatureMatch: s.startsWith('FAKE') ? '82%' : '99.9%'
    }));
    res.json({ results, fraudDetected: results.some(r => r.status === 'COUNTERFEIT') });
});

// 21. MICRO-GRID ISLANDING (Grid Simulation)
app.post('/api/grid/mode', (req, res) => {
    const { mode } = req.body; // 'GRID_TIED' | 'ISLANDING'
    
    if (mode === 'ISLANDING') {
        gridState.mode = 'ISLANDING';
        gridState.frequency = 50.0 + (Math.random() * 0.1); // Simulate microgrid stability
        return res.json({ 
            status: 'success', 
            mode: 'ISLANDING', 
            msg: 'Breaker opened. Grid forming inverters active.', 
            householdsPowered: 4500 
        });
    }
    
    gridState.mode = 'GRID_TIED';
    res.json({ status: 'success', mode: 'GRID_TIED', msg: 'Synchronized with national grid.' });
});

// 22. ACOUSTIC MONITORING (Simulation)
app.post('/api/maintenance/acoustic', (req, res) => {
    // Simulating FFT analysis of an uploaded audio clip
    const anomalies = Math.random() > 0.7; // 30% chance of anomaly
    res.json({
        status: 'success',
        frequencyPeak: anomalies ? '12.5kHz' : '50Hz',
        diagnosis: anomalies ? 'Inverter Fan Bearing Failure (Stage 2)' : 'Normal Operation',
        confidence: 0.94
    });
});

// 23. SPECTRUM OPTIMIZER (Calculation)
app.get('/api/optimization/spectrum', (req, res) => {
    const { lat } = req.query;
    // Logic: Higher latitude = different optimal tilt and spectral shift
    const latitude = parseFloat(lat) || 45;
    res.json({
        recommendedCoating: latitude > 45 ? 'Blue-Shift Anti-Reflective' : 'Standard UV-Cut',
        uvLoss: '36 W/m2',
        potentialGain: '1.85%'
    });
});

// 26. GAMIFICATION LEADERBOARD (Mock DB)
const leaderboard = [
    { rank: 1, park: "Livada", score: 98, badge: "🏆 Uptime King" },
    { rank: 2, park: "Nădab 1", score: 96, badge: "⚡ Trading Genius" },
    { rank: 3, park: "Pilu", score: 95, badge: "🦅 Bio-Friendly" },
    { rank: 4, park: "Văcărești", score: 92, badge: "🛡️ Grid Hero" },
];

app.get('/api/gamification/leaderboard', (req, res) => {
    res.json(leaderboard);
});

app.listen(PORT, () => {
  console.log(`Helios Digital Twin Engine running on http://localhost:${PORT}`);
});
