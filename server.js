
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

// --- CORE PVSYST ENDPOINTS ---
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
// === QUICK WIN FEATURES IMPLEMENTATION (Enhanced Logic) ===
// =========================================================================

// --- 1. SMART CLEANING SCHEDULING (DustIQ Logic) ---

function calculateDustIQ({ daysSinceCleaning, precipitationSum, avgWindSpeed, locationType = 'rural' }) {
    // Logic adapted from documentation
    const locationMultipliers = { desert: 1.8, industrial: 1.6, urban: 1.3, rural: 1.0 };
    let baseSoilingRate = 0.15 * (locationMultipliers[locationType] || 1.0);
    
    // Adjust for wind
    if (avgWindSpeed > 15) baseSoilingRate *= 1.2; // High wind = more dust
    
    // Accumulated loss
    let estimatedSoilingLoss = daysSinceCleaning * baseSoilingRate;
    
    // Natural cleaning
    if (precipitationSum > 5) {
        const cleaningFactor = Math.min(precipitationSum / 20, 0.7);
        estimatedSoilingLoss *= (1 - cleaningFactor);
    }
    
    estimatedSoilingLoss = Math.min(estimatedSoilingLoss, 25);
    const dustIQScore = Math.min(100, (estimatedSoilingLoss / 5) * 100);
    
    return { dustIQScore, estimatedSoilingLoss };
}

app.get('/api/maintenance/cleaning-schedule', async (req, res) => {
    const { lat, lng } = req.query;
    try {
        // Doc: past_days gets historical data. daily forecast returns 7 days by default.
        // We get 7 days history + 7 days forecast = 14 items in 'daily' arrays usually.
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat || 44.4}&longitude=${lng || 26.1}&daily=precipitation_sum,windspeed_10m_max&timezone=auto&past_days=7`;
        const weatherRes = await fetch(weatherUrl);
        const data = await weatherRes.json();
        
        // Data Interpretation according to Open-Meteo:
        // Indices 0-6: Past 7 days
        // Index 7: Today
        // Indices 8-10: Next 3 days
        
        const rainNext3Days = (data.daily?.precipitation_sum || []).slice(7, 10).reduce((a, b) => a + b, 0) || 0;
        const rainLast7Days = (data.daily?.precipitation_sum || []).slice(0, 7).reduce((a, b) => a + b, 0) || 0;
        const avgWind7Days = ((data.daily?.windspeed_10m_max || []).slice(0, 7).reduce((a, b) => a + b, 0) / 7) || 10;
        
        // Simulate "Days Since Cleaning" (random 10-40 days)
        const daysSinceCleaning = Math.floor(Math.random() * 30) + 10;

        const { dustIQScore, estimatedSoilingLoss } = calculateDustIQ({
            daysSinceCleaning,
            precipitationSum: rainLast7Days,
            avgWindSpeed: avgWind7Days,
            locationType: 'rural'
        });

        // Recommendation Logic
        let recommendation = 'CLEAN_NOW';
        let urgency = 'medium';
        
        if (dustIQScore > 75) urgency = 'high';
        else if (dustIQScore < 30) urgency = 'low';

        if (rainNext3Days > 5) recommendation = 'WAIT'; // Rain incoming
        else if (dustIQScore < 40) recommendation = 'SKIP'; 

        res.json({
            status: 'success',
            schedule: {
                dustIQScore: Math.round(dustIQScore),
                soilingLoss: parseFloat(estimatedSoilingLoss.toFixed(2)),
                daysSinceCleaning,
                rainForecast: `${rainNext3Days.toFixed(1)}mm next 72h`,
                recommendation,
                urgency,
                roiEstimate: recommendation === 'CLEAN_NOW' ? Math.round(estimatedSoilingLoss * 150) : 0 // Mock ROI
            }
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Failed to calculate cleaning schedule" });
    }
});

// --- 2. PRODUCTION ANOMALY AI (SCADA Simulation) ---

app.get('/api/analytics/anomalies', (req, res) => {
    // Generate mock SCADA data for inverters
    const anomalies = [];
    const inverters = ['INV_01', 'INV_02', 'INV_03', 'INV_04', 'INV_05'];
    
    inverters.forEach(inv => {
        const efficiency = 85 + Math.random() * 14; // 85-99%
        const temp = 40 + Math.random() * 40; // 40-80C
        
        if (efficiency < 90) {
            anomalies.push({
                id: `ANM-${Math.floor(Math.random()*1000)}`,
                type: 'inverter_low_efficiency',
                equipment: inv,
                timestamp: new Date().toISOString(),
                currentValue: `${efficiency.toFixed(1)}%`,
                expectedValue: '> 95%',
                severity: efficiency < 88 ? 'HIGH' : 'MEDIUM',
                message: `Inverter ${inv} operating at ${efficiency.toFixed(1)}% efficiency`,
                recommendedAction: 'Inspect inverter for potential issues'
            });
        }
        
        if (temp > 70) {
             anomalies.push({
                id: `ANM-${Math.floor(Math.random()*1000)}`,
                type: 'thermal_anomaly',
                equipment: inv,
                timestamp: new Date().toISOString(),
                currentValue: `${temp.toFixed(1)}°C`,
                expectedValue: '< 65°C',
                severity: 'CRITICAL',
                message: `Inverter ${inv} overheating (${temp.toFixed(1)}°C)`,
                recommendedAction: 'Check cooling fans immediately'
            });
        }
    });

    // System-wide check
    const performanceRatio = 70 + Math.random() * 20;
    if (performanceRatio < 75) {
         anomalies.push({
            id: 'SYS-001',
            type: 'unexpected_power_drop',
            equipment: 'SYSTEM',
            timestamp: new Date().toISOString(),
            currentValue: `${performanceRatio.toFixed(1)}%`,
            expectedValue: '> 80%',
            severity: 'HIGH',
            message: `System PR is ${performanceRatio.toFixed(1)}%`,
            recommendedAction: 'Comprehensive system inspection'
        });
    }

    res.json({
        status: 'success',
        count: anomalies.length,
        systemHealthScore: Math.max(0, 100 - (anomalies.length * 10)),
        anomalies
    });
});

// --- 3. WEATHER-AWARE FORECASTING (Advanced) ---

app.get('/api/weather/solar-forecast', async (req, res) => {
    const { lat, lng } = req.query;
    try {
        // Doc: Use direct_normal_irradiance (DNI) and diffuse_radiation (DHI) for accurate solar monitoring.
        // cloudcover is Total Cloud Cover.
        const weatherUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat || 44.4}&longitude=${lng || 26.1}&hourly=temperature_2m,shortwave_radiation,cloudcover,direct_normal_irradiance,diffuse_radiation&timezone=auto&forecast_days=1`;
        const weatherRes = await fetch(weatherUrl);
        const data = await weatherRes.json();
        
        const currentHour = new Date().getHours();
        const ghi = data.hourly.shortwave_radiation[currentHour];
        const dni = data.hourly.direct_normal_irradiance[currentHour]; // DNI
        const dhi = data.hourly.diffuse_radiation[currentHour]; // Diffuse
        const cloudCover = data.hourly.cloudcover[currentHour];
        
        // Simple confidence calculation based on cloud volatility
        // We look at the next 3 hours
        const next3HoursClouds = data.hourly.cloudcover.slice(currentHour, currentHour + 3);
        const variance = next3HoursClouds.reduce((p, c) => p + Math.abs(c - cloudCover), 0);
        const confidence = variance > 30 ? 0.65 : 0.95;

        const forecast = {
            time: 'Now',
            ghi: ghi,
            dni: dni,
            dhi: dhi,
            temp: data.hourly.temperature_2m[currentHour],
            cloudCover: cloudCover,
            productionEstimateMw: (ghi * 0.0002).toFixed(2), // Rough estimate formula
            confidence: confidence
        };

        res.json({
            status: 'success',
            forecast
        });
    } catch (e) {
        console.error(e);
        res.status(500).json({ error: "Forecast provider unavailable" });
    }
});

// --- 4. BENCHMARKING (Fleet Logic) ---

app.get('/api/benchmarking/compare', (req, res) => {
    // Generate mock fleet data
    const fleetSize = 28;
    const myParkId = 'MY_PARK';
    const fleet = [];
    
    for(let i=0; i<fleetSize; i++) {
        fleet.push({
            id: i === 0 ? myParkId : `PARK_${i}`,
            pr: 75 + Math.random() * 15, // 75-90%
            yield: 1200 + Math.random() * 300 // 1200-1500
        });
    }

    // Rank by PR
    fleet.sort((a, b) => b.pr - a.pr);
    
    const myRank = fleet.findIndex(p => p.id === myParkId);
    const myData = fleet[myRank];
    const avgPr = fleet.reduce((sum, p) => sum + p.pr, 0) / fleetSize;
    
    const metrics = [
        {
            fleetId: 'ROMANIA_SOLAR_ALL',
            metric: 'Performance Ratio (PR)',
            yourPark: parseFloat(myData.pr.toFixed(1)),
            networkAvg: parseFloat(avgPr.toFixed(1)),
            topPerformer: parseFloat(fleet[0].pr.toFixed(1)),
            rank: myRank + 1,
            percentile: Math.round(((fleetSize - myRank) / fleetSize) * 100),
            status: myData.pr > avgPr ? 'ABOVE_AVG' : 'BELOW_AVG'
        }
    ];

    res.json({
        status: 'success',
        metrics
    });
});

app.listen(PORT, () => {
  console.log(`Helios Quick-Win Engine (Advanced) running on http://localhost:${PORT}`);
});
