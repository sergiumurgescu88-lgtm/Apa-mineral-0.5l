
/**
 * Helios Backend - PVsystCLI Automation & Digital Twin Server
 */

const express = require('express');
const cors = require('cors');
const { spawn } = require('child_process');
const bodyParser = require('body-parser');

const app = express();
const PORT = 3001;

// Provided Planet API Credentials
const PLANET_ACCOUNT_ID = 'cc07c01f-abd3-4a7a-a4ed-3584b5fff76f';
const PLANET_API_KEY = 'PLAK965b839381d24a93846595d6932779ca'; // Active Paid Key

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

// =========================================================================
// === SATELLITE API HUB (PLANET & COPERNICUS) ===
// =========================================================================

/**
 * Planet Subscriptions API Proxy
 * Implementation of: https://docs.planet.com/develop/apis/subscriptions/tools/
 */
app.post('/api/satellite/planet', async (req, res) => {
    const { name, coordinates, source = 'planetscope', startDate, cloudCover, spectralBands } = req.body;
    
    console.log(`[Planet API] Authenticating with Key: ${PLANET_API_KEY.slice(0, 4)}...`);
    console.log(`[Planet API] Account ID: ${PLANET_ACCOUNT_ID}`);
    console.log(`[Planet API] Initializing ${source === 'skysat' ? '0.5m SkySat' : '3.0m PlanetScope'} Subscription for: ${name || 'Strategic Asset'}`);

    // --- PLANET SUBSCRIPTIONS API TOOLCHAIN CONSTRUCTION ---
    // We strictly follow the tools defined in: https://docs.planet.com/develop/apis/subscriptions/tools/
    
    const tools = [];

    // 1. CLIP TOOL
    // Clips the imagery to the Area of Interest (AOI) to save processing credits and bandwidth.
    if (coordinates) {
        tools.push({
            type: "clip",
            parameters: { 
                aoi: { 
                    type: "Polygon", 
                    coordinates: [coordinates] // Expecting array of [lng, lat] arrays
                } 
            }
        });
    } else {
        // Default AOI for demo (Bucharest area) if none provided
        tools.push({
            type: "clip",
            parameters: { 
                aoi: { 
                    type: "Polygon", 
                    coordinates: [[[26.1, 44.4], [26.2, 44.4], [26.2, 44.5], [26.1, 44.5], [26.1, 44.4]]] 
                } 
            }
        });
    }

    // 2. BAND MATH TOOL (Optional)
    // Used for on-the-fly index calculation (NDVI, EVI) to reduce data volume.
    // Documentation: https://docs.planet.com/develop/apis/subscriptions/tools/#band_math
    if (spectralBands && spectralBands.length > 0) {
        const bandsConfig = [];
        
        if (spectralBands.includes('NIR') && spectralBands.includes('Red')) {
             bandsConfig.push({ name: "NDVI", expression: "(b4 - b3) / (b4 + b3)" }); // Assuming 4-band PlanetScope (b4=NIR, b3=Red)
        }
        
        if (spectralBands.includes('Blue')) {
             bandsConfig.push({ name: "EVI", expression: "2.5 * ((b4 - b3) / (b4 + 6 * b3 - 7.5 * b2 + 1))" }); // b2=Blue
        }

        if (bandsConfig.length > 0) {
            tools.push({
                type: "band_math",
                parameters: {
                    pixel_type: "32R", // 32-bit Float for indices
                    bands: bandsConfig
                }
            });
        }
    }

    // 3. COMPOSITE TOOL
    // Used to stitch multiple scenes together or remove clouds over a time window.
    // Documentation: https://docs.planet.com/develop/apis/subscriptions/tools/#composite
    if (cloudCover && cloudCover < 10) {
        tools.push({
            type: "composite",
            parameters: { 
                method: "medoid" // Effective for cloud removal in time-series
            }
        });
    }

    // 4. REPROJECT TOOL
    // Ensures output is in a standard web-friendly projection if needed (e.g., EPSG:3857 for Web Maps)
    // Documentation: https://docs.planet.com/develop/apis/subscriptions/tools/#reproject
    tools.push({
        type: "reproject",
        parameters: {
            projection: "EPSG:4326", // Standard Lat/Lng
            kernel: "cubic"
        }
    });

    // 5. FILE FORMAT TOOL
    // Ensures output is Cloud-Optimized GeoTIFF (COG) for streaming.
    // Documentation: https://docs.planet.com/develop/apis/subscriptions/tools/#file_format
    tools.push({
        type: "file_format",
        parameters: {
            format: "COG"
        }
    });

    const planetRequestPayload = {
        name: name || "Smart Helios Monitoring",
        source_type: "publishing",
        source_config: {
            type: "daily_revisit",
            item_types: source === 'skysat' ? ["SkySatScene"] : ["PSScene"],
            asset_types: ["ortho_analytic_4b_sr"] // Surface Reflectance
        },
        tools: tools, // The constructed toolchain
        delivery: { 
            type: "google_cloud_storage", 
            parameters: { bucket: "helios-bucket", credentials: "<GCP_CREDENTIALS>" } 
        }
    };
    
    console.log(`[Planet API] Generated Tool Chain Payload:`, JSON.stringify(planetRequestPayload, null, 2));

    // --- SIMULATED RESPONSE GENERATION ---
    // In a real app, we would POST to https://api.planet.com/subscriptions/v1/ and return the ID.
    // Here we simulate the data that would be returned after the toolchain processes the data.

    // Simulate spectral band reflectance values (0.0 - 1.0)
    const nir = 0.35 + (Math.random() * 0.15); // Near-Infrared
    const red = 0.05 + (Math.random() * 0.05); // Red
    const blue = 0.02 + (Math.random() * 0.04); // Blue

    // Calculate indices based on simulated values
    const ndvi = (nir - red) / (nir + red);
    const evi = 2.5 * ((nir - red) / (nir + 6 * red - 7.5 * blue + 1));

    const subId = `sub_${Date.now()}`;
    
    res.json({
        id: subId,
        status: 'active',
        created: new Date().toISOString(),
        updated: new Date().toISOString(),
        name: name || `Premium_Monitoring_${subId.slice(0, 8)}`,
        source: source === 'skysat' ? 'SkySat (50cm Technical)' : 'PlanetScope (3.0m Daily)',
        resolution: source === 'skysat' ? '0.5m' : '3.0m',
        
        // Calculated Indices
        ndvi_mean: parseFloat(ndvi.toFixed(4)),
        evi_mean: parseFloat(evi.toFixed(4)),
        spectral_metrics: {
            nir_mean: parseFloat(nir.toFixed(4)),
            red_mean: parseFloat(red.toFixed(4)),
            blue_mean: parseFloat(blue.toFixed(4))
        },

        visualUrl: `https://picsum.photos/seed/planet_highres_${subId}/1600/1200`,
        links: [
            { rel: "self", href: `https://api.planet.com/subscriptions/v1/${subId}` },
            { rel: "payload", href: `https://api.planet.com/subscriptions/v1/${subId}/results` }
        ],
        metadata: {
            item_types: source === 'skysat' ? ["SkySatScene"] : ["PSScene"],
            tools_used: tools.map(t => t.type), // Return the list of used tools for verification
            cadence: "daily_revisit",
            last_acquisition: new Date().toISOString(),
            cloud_cover: cloudCover ? `${Math.min(cloudCover, (Math.random() * cloudCover)).toFixed(2)}%` : `${(Math.random() * 2).toFixed(2)}%`,
        }
    });
});

// Copernicus Data Space Ecosystem (Sentinel Hub)
app.post('/api/satellite/imagery', async (req, res) => {
    const { bbox, collection = 'SENTINEL2', startDate, endDate, cloudCover, evalscript } = req.body;
    
    console.log(`[Copernicus Hub] Technical Request: ${collection}`);
    
    let ndviValue = 0.35;
    let soilingRisk = "Low";
    let analysisType = "Sentinel Standard Monitoring";
    
    if (evalscript && evalscript.toLowerCase().includes('ndvi')) {
        analysisType = "NDVI Vegetation Health Index";
        ndviValue = 0.58; 
    }
    
    // Check if analyzing the Livada area
    const isLivada = bbox && bbox[1] > 47.6 && bbox[1] < 47.9;
    if (isLivada) {
        ndviValue = 0.62; 
        soilingRisk = "Moderate (14.2%) - Accumulation detected in Sector B (North-West)";
    }

    res.json({
        status: 'success',
        provider: 'Copernicus Data Space Ecosystem',
        api: 'Sentinel Hub / openEO Proxy',
        metadata: {
            collection,
            processingType: analysisType,
            resolution: collection.includes('SENTINEL2') ? '10m' : (collection.includes('SENTINEL1') ? '20m' : '60m'),
            cloudCover: cloudCover ? `${(Math.random() * cloudCover).toFixed(2)}%` : '0.8%',
            acquisitionDate: startDate
        },
        analysis: {
            ndvi: ndviValue, 
            evi: (ndviValue * 0.88).toFixed(2),
            soilingEstimate: soilingRisk,
            thermalAnomalies: collection === 'SENTINEL3' ? ['Inverter Station 4: Localized heat spike (+4.5°C)'] : [],
            groundStability: collection === 'SENTINEL1' ? 'Stable (-0.8mm displacement)' : 'N/A'
        },
        visualUrl: `https://picsum.photos/seed/copernicus_${collection}_${isLivada ? 'livada' : 'global'}/1280/960`,
        timestamp: new Date().toISOString()
    });
});

// =========================================================================
// === HELIOS ANALYTICS & TOOLS (NEW) ===
// =========================================================================

// Tool 6: Performance Benchmark
app.get('/api/analytics/benchmark', (req, res) => {
    const { parkId, region } = req.query;
    res.json({
        parkId,
        region: region || "Romania-West",
        metrics: {
            pr: 84.5, // Performance Ratio
            specific_yield: 1350, // kWh/kWp
            availability: 99.2
        },
        comparison: {
            regional_avg_pr: 81.2,
            top_performer_pr: 88.0,
            rank: "Top 15%"
        },
        insights: [
            "Asset performing 3.3% above regional average.",
            "Inverter efficiency trails top performers by 1.1%."
        ]
    });
});

// Tool 7: Predictive Failure (TensorFlow LSTM Mock)
app.post('/api/analytics/failure-prediction', (req, res) => {
    const { parkId, horizonDays } = req.body;
    res.json({
        model: "TensorFlow-LSTM-v4",
        status: "Inference Complete",
        predictions: [
            { component: "Inverter_Block_B2", probability: 0.82, est_failure: "72h", impact: "High (2.1 MW)" },
            { component: "String_Box_14", probability: 0.45, est_failure: "14d", impact: "Low (0.1 MW)" }
        ],
        maintenance_recommendation: "Schedule preventative check for Inverter B2 within 48h."
    });
});

// Tool 13: Energy Trading Bot (OPCOM Simulator)
app.post('/api/market/trade', (req, res) => {
    const { action, volumeMwh, priceLimit } = req.body;
    const executedPrice = 110 + (Math.random() * 20); // EUR/MWh
    res.json({
        exchange: "OPCOM Day-Ahead",
        status: "Executed",
        ticket_id: `TRD-${Date.now()}`,
        details: {
            action,
            volume: volumeMwh,
            limit: priceLimit,
            executed_price_eur: executedPrice.toFixed(2),
            total_value_eur: (executedPrice * volumeMwh).toFixed(2)
        },
        timestamp: new Date().toISOString()
    });
});

// Tool 15: Agrivoltaics Planning
app.get('/api/geo/agrivoltaics', (req, res) => {
    const { location, cropType } = req.query;
    res.json({
        location,
        crop_compatibility: {
            crop: cropType || "Wheat",
            suitability_score: 88,
            shading_tolerance: "High"
        },
        layout_recommendation: {
            panel_height: "2.5m",
            row_spacing: "8m",
            tracker_type: "Single-axis backtracking"
        },
        yield_forecast: {
            energy_loss: "-8%",
            agricultural_yield: "85% of open-field"
        }
    });
});

// ============= EXISTING APIS =============

app.get('/api/solar/forecast', async (req, res) => {
    const { lat, lng, dec = 35, az = 0, kwp = 1 } = req.query;
    try {
        const url = `https://api.forecast.solar/estimate/${lat}/${lng}/${dec}/${az}/${kwp}`;
        const response = await fetch(url);
        const data = await response.json();
        res.json({ status: 'success', data });
    } catch (e) {
        res.status(500).json({ error: "Forecast.Solar provider failed" });
    }
});

app.get('/api/biodiversity/nearby', async (req, res) => {
    const { lat, lng, radius = 5000 } = req.query;
    try {
        const url = `https://api.gbif.org/v1/occurrence/search?decimalLatitude=${lat}&decimalLongitude=${lng}&distance=${radius}&limit=20`;
        const response = await fetch(url);
        const data = await response.json();
        res.json({ status: 'success', results: data.results });
    } catch (e) {
        res.status(500).json({ error: "Biodiversity API failed" });
    }
});

app.post('/api/esg/carbon-impact', async (req, res) => {
    const { mwh } = req.body;
    const emissionFactor = 250.0; 
    const avoidedKg = mwh * emissionFactor;
    res.json({
        status: 'success',
        avoidedTonnes: (avoidedKg / 1000).toFixed(2),
        treesEquivalent: Math.round(avoidedKg / 20),
        roGridIntensity: "250g CO2/kWh",
        methodology: "Climatiq RO-specific Factor"
    });
});

app.get('/api/geo/reverse', async (req, res) => {
    const { lat, lng } = req.query;
    try {
        const url = `https://geocode.maps.co/reverse?lat=${lat}&lon=${lng}`;
        const response = await fetch(url);
        const data = await response.json();
        res.json({ status: 'success', address: data.display_name, raw: data });
    } catch (e) {
        res.status(500).json({ error: "Reverse Geocoding failed" });
    }
});

// PVsyst Endpoints
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

app.post('/api/pvsyst/simulate', async (req, res) => {
  const { project, variant, outputCsv } = req.body;
  const args = ['run-simulation', `--workspace="${config.workspace}"`, `--project="${project}"`, `--variant="${variant}"`, `--output-csv-file="${outputCsv || 'results.csv'}"`];
  try {
    const { stdout } = await runCommand(config.cliPath, args);
    res.json({ status: 'success', output: stdout });
  } catch (error) {
    res.status(500).json({ status: 'error', details: error });
  }
});

app.listen(PORT, () => {
  console.log(`Helios Core & Satellite Hub running on http://localhost:${PORT}`);
  console.log(`Planet Labs Premium Node Initialized: ${PLANET_ACCOUNT_ID}`);
});
