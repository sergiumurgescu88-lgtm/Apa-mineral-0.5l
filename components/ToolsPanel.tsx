
import React, { useState } from 'react';
import { Language } from '../types';
import { t } from '../translations';
import { 
    fetchWeatherForecast, 
    fetchPlanetImageryAPI, 
    fetchSatelliteImageryAPI, 
    executeEnergyTradeAPI,
    analyzePredictiveFailureAPI,
    calculateCarbonImpactAPI 
} from '../services/geminiService';
import { getLicenseInfo } from '../services/pvsystService';

interface ToolsPanelProps {
  lang: Language;
}

const TOOLS_CATALOG = [
  { id: 'meteo_core', name: 'Open-Meteo Solar Forecast', api: 'api.open-meteo.com', cat: 'Meteo', status: 'live', desc: 'Real-time GHI/DNI irradiance data for yield calculation.' },
  { id: 'planet_sat', name: 'Planet Labs (SkySat)', api: 'api.planet.com', cat: 'Satellite', status: 'proxy', desc: '50cm resolution tasking via Helios Proxy.' },
  { id: 'sentinel_hub', name: 'Copernicus Sentinel-2', api: 'dataspace.copernicus.eu', cat: 'Satellite', status: 'live', desc: 'Broad-scale NDVI vegetation monitoring.' },
  { id: 'pvsyst_eng', name: 'PVsyst CLI Engine', api: 'localhost:3001', cat: 'Engineering', status: 'local', desc: 'Automated energy simulation jobs.' },
  { id: 'opcom_trade', name: 'OPCOM Trading Bot', api: 'opcom.ro (Scraper)', cat: 'Market', status: 'sim', desc: 'Day-ahead market price analysis.' },
  { id: 'lstm_predict', name: 'TensorFlow LSTM', api: 'Internal Model', cat: 'AI', status: 'beta', desc: 'Predictive failure analysis based on telemetry.' },
  { id: 'esg_carbon', name: 'ESG Carbon Footprint', api: 'Climatiq / Planet', cat: 'ESG', status: 'live', desc: 'CO2 avoidance & biomass impact analysis.' },
];

const ToolsPanel: React.FC<ToolsPanelProps> = ({ lang }) => {
  const [selectedToolId, setSelectedToolId] = useState<string>('meteo_core');
  const [testLog, setTestLog] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);
  const [statusMessage, setStatusMessage] = useState<string>("");
  const [testSource, setTestSource] = useState<string>("");
  const [latency, setLatency] = useState<string>('12ms');

  const selectedTool = TOOLS_CATALOG.find(t => t.id === selectedToolId) || TOOLS_CATALOG[0];

  const handleToolClick = (toolId: string) => {
      setSelectedToolId(toolId);
      setTestLog(null);
      setStatusMessage("READY");
  };

  const runTest = async () => {
    setIsTesting(true);
    const toolName = selectedTool.name.toUpperCase();
    setStatusMessage(`INITIALIZING CONNECTION TO ${toolName}...`);
    setTestSource(selectedTool.cat);
    setTestLog(null);
    setLatency('measuring...');
    
    try {
        const startTime = Date.now();
        let data: any = {};

        // === 1. METEO (OPEN-METEO) ===
        if (selectedToolId === 'meteo_core') {
            const lat = 46.22;
            const lng = 20.95;
            
            setStatusMessage(`CONNECTING TO OPEN-METEO FOR ARAD PARK (${lat}, ${lng})...`);
            
            const rawData = await fetchWeatherForecast({
                latitude: lat,
                longitude: lng, // Arad Mega Park
                current: ["temperature_2m", "relative_humidity_2m", "cloud_cover", "direct_radiation", "diffuse_radiation", "shortwave_radiation", "wind_speed_10m"],
                hourly: ["temperature_2m", "shortwave_radiation", "direct_normal_irradiance", "global_tilted_irradiance"],
                daily: ["sunrise", "sunset", "daylight_duration"],
                forecast_days: 1,
                timezone: "auto",
                tilt: 35,
                azimuth: 0
            });

            // Data Verification Step
            const c = rawData.current;
            const u = rawData.current_units;
            
            if (!c) throw new Error("Invalid API Response: Missing 'current' data block.");
            
            const checks = {
                temp: c.temperature_2m !== undefined,
                rad: c.shortwave_radiation !== undefined,
                cloud: c.cloud_cover !== undefined
            };

            if (!checks.temp || !checks.rad || !checks.cloud) {
                throw new Error(`Data Integrity Fail: Missing critical fields. T:${checks.temp}, R:${checks.rad}, C:${checks.cloud}`);
            }

            // Construct Verified Report
            data = {
                _status: "INTEGRATION VERIFIED",
                _target: "Arad Mega Solar Park",
                _coordinates: { lat, lng },
                _live_metrics: {
                    temperature: `${c.temperature_2m} ${u.temperature_2m}`,
                    global_radiation_GHI: `${c.shortwave_radiation} ${u.shortwave_radiation}`,
                    cloud_cover: `${c.cloud_cover} ${u.cloud_cover}`,
                    wind_speed: `${c.wind_speed_10m} ${u.wind_speed_10m}`,
                    humidity: `${c.relative_humidity_2m} ${u.relative_humidity_2m}`
                },
                _api_response_metadata: {
                    timezone: rawData.timezone,
                    elevation: rawData.elevation,
                    generation_time_ms: rawData.generationtime_ms
                },
                full_payload: rawData
            };
        }
        
        // === 2. PLANET LABS (PROXY) ===
        else if (selectedToolId === 'planet_sat') {
            data = await fetchPlanetImageryAPI({
                name: "Test_Connectivity_Check",
                coordinates: [23.054, 47.868], // Livada
                source: "skysat",
                startDate: new Date().toISOString().split('T')[0],
                cloudCover: 5,
                spectralBands: ["NIR", "Red", "Blue"]
            });
        }

        // === 3. COPERNICUS (SENTINEL) ===
        else if (selectedToolId === 'sentinel_hub') {
            data = await fetchSatelliteImageryAPI({
                bbox: [22.9, 47.8, 23.1, 47.9],
                collection: "SENTINEL2",
                startDate: new Date(Date.now() - 86400000 * 5).toISOString().split('T')[0], // 5 days ago
                endDate: new Date().toISOString().split('T')[0],
                cloudCover: 20
            });
        }

        // === 4. PVSYST CLI (LOCAL) ===
        else if (selectedToolId === 'pvsyst_eng') {
            const license = await getLicenseInfo();
            data = { status: "Local Connection OK", output: license, timestamp: new Date().toISOString() };
        }

        // === 5. OPCOM TRADING (SIM) ===
        else if (selectedToolId === 'opcom_trade') {
            data = await executeEnergyTradeAPI({
                action: "BUY",
                volumeMwh: 10,
                priceLimit: 120
            });
        }

        // === 6. LSTM PREDICTION (AI) ===
        else if (selectedToolId === 'lstm_predict') {
            data = await analyzePredictiveFailureAPI({
                parkId: "ro_pv_001_livada",
                horizonDays: 7
            });
        }

        // === 7. ESG CARBON IMPACT ===
        else if (selectedToolId === 'esg_carbon') {
            setStatusMessage("CALCULATING CARBON IMPACT FOR 500 MWh...");
            data = await calculateCarbonImpactAPI({
                mwh: 500,
                geometry: { 
                    type: "Polygon", 
                    coordinates: [[[20.95, 46.22], [20.96, 46.22], [20.96, 46.23], [20.95, 46.23], [20.95, 46.22]]] 
                }
            });
        }

        const duration = Date.now() - startTime;
        setLatency(`${duration}ms`);
        
        if (data.error) throw new Error(data.error);
        if (data.isConnectionError) throw new Error("BACKEND UNREACHABLE. Ensure server.js is running.");

        setStatusMessage(`CONNECTION ESTABLISHED [${duration}ms]`);
        setTestLog(JSON.stringify(data, null, 2));

    } catch (e: any) {
        setLatency('ERR');
        setStatusMessage(`CONNECTION FAILED: ${e.message}`);
        setTestLog(JSON.stringify({ error: e.message, hint: "Check server console or network tab." }, null, 2));
    } finally {
        setIsTesting(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      {/* Header with Stats */}
      <div className="flex justify-between items-end bg-slate-800/50 p-4 rounded-xl border border-slate-700">
          <div>
            <h2 className="text-xl font-bold text-white mb-1 flex items-center gap-2">
                <span className="w-2 h-2 bg-emerald-500 rounded-full animate-pulse"></span>
                SYSTEM HEALTH & TOOLS
            </h2>
            <p className="text-slate-400 text-xs font-mono">Gateway Status: ONLINE | {TOOLS_CATALOG.length} Modules Loaded</p>
          </div>
          
          <div className="text-right">
             <button 
                onClick={runTest}
                disabled={isTesting}
                className={`px-4 py-2 rounded text-xs font-bold font-mono uppercase transition-all shadow-lg flex items-center gap-2 ${isTesting ? 'bg-slate-700 text-slate-400' : 'bg-emerald-600 hover:bg-emerald-500 text-white'}`}
             >
                {isTesting ? (
                    <>
                        <svg className="animate-spin h-3 w-3 text-white" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path></svg>
                        Verifying {selectedTool.cat}...
                    </>
                ) : (
                    <>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polyline points="22 12 18 12 15 21 9 3 6 12 2 12"/></svg>
                        Test {selectedTool.name.split(' ')[0]} Connection
                    </>
                )}
             </button>
          </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
        
        {/* Left: Tool Catalog */}
        <div className="lg:col-span-1 overflow-y-auto pr-2 custom-scrollbar space-y-3">
             <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">Registered Modules</h3>
             {TOOLS_CATALOG.map((tool) => (
                <div 
                    key={tool.id} 
                    onClick={() => handleToolClick(tool.id)}
                    className={`border p-3 rounded-lg cursor-pointer transition-all group ${
                        selectedToolId === tool.id 
                        ? 'bg-slate-800 border-primary-500/50 shadow-md ring-1 ring-primary-500/20' 
                        : 'bg-slate-900 border-slate-800 hover:border-slate-600'
                    }`}
                >
                    <div className="flex justify-between items-start mb-1">
                        <span className={`text-[10px] font-mono uppercase px-1.5 py-0.5 rounded ${
                            tool.cat === 'Meteo' ? 'bg-amber-900/30 text-amber-400' : 
                            tool.cat === 'Satellite' ? 'bg-indigo-900/30 text-indigo-400' : 
                            tool.cat === 'AI' ? 'bg-fuchsia-900/30 text-fuchsia-400' : 
                            tool.cat === 'ESG' ? 'bg-teal-900/30 text-teal-400' :
                            'bg-slate-800 text-slate-400'
                        }`}>{tool.cat}</span>
                        <span className={`w-1.5 h-1.5 rounded-full ${tool.status === 'live' ? 'bg-emerald-500' : 'bg-slate-600'}`}></span>
                    </div>
                    <h4 className={`text-sm font-bold ${selectedToolId === tool.id ? 'text-white' : 'text-slate-200 group-hover:text-white'}`}>
                        {tool.name}
                    </h4>
                    <p className="text-[10px] text-slate-500 font-mono mt-1 truncate">{tool.api}</p>
                    <p className={`text-xs mt-2 leading-snug transition-colors ${selectedToolId === tool.id ? 'text-slate-300' : 'text-slate-400'}`}>
                        {tool.desc}
                    </p>
                </div>
             ))}
        </div>

        {/* Right: Console/Log Area */}
        <div className="lg:col-span-2 bg-slate-950 rounded-xl border border-slate-800 flex flex-col overflow-hidden relative shadow-inner">
            <div className="bg-slate-900 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <span className="text-xs font-mono text-slate-400">CONSOLE OUTPUT {testSource ? `// ${testSource}` : ''}</span>
                <div className="flex gap-1.5">
                    <div className="w-2.5 h-2.5 rounded-full bg-red-500/20 border border-red-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-amber-500/20 border border-amber-500/50"></div>
                    <div className="w-2.5 h-2.5 rounded-full bg-emerald-500/20 border border-emerald-500/50"></div>
                </div>
            </div>
            
            <div className="flex-1 p-4 font-mono text-xs overflow-y-auto custom-scrollbar">
                {statusMessage && (
                    <div className={`mb-4 pb-2 border-b border-slate-800 ${statusMessage.includes('FAILED') ? 'text-red-400' : 'text-emerald-400'}`}>
                        {`> ${statusMessage}`}
                    </div>
                )}
                
                {testLog ? (
                    <pre className="text-slate-300 whitespace-pre-wrap leading-relaxed">
                        {testLog}
                    </pre>
                ) : (
                    <div className="h-full flex flex-col items-center justify-center text-slate-600 space-y-2 opacity-50">
                        <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1" strokeLinecap="round" strokeLinejoin="round"><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                        <p>Select a module from the left to test connectivity.</p>
                        <p className="text-[10px]">Start with "Open-Meteo" to verify external internet access.</p>
                    </div>
                )}
            </div>
            
            {/* Status Bar */}
            <div className="bg-slate-900 border-t border-slate-800 px-3 py-1 text-[10px] font-mono text-slate-500 flex justify-between">
                <span>Helios Core v3.1.0</span>
                <span>Latency: <span className={latency === 'ERR' ? 'text-red-500' : 'text-emerald-500'}>{latency}</span></span>
            </div>
        </div>

      </div>
    </div>
  );
};

export default ToolsPanel;
