
import React, { useState } from 'react';
import { Language } from '../types';
import { t } from '../translations';
import { fetchWeatherForecast } from '../services/geminiService';

interface ToolsPanelProps {
  lang: Language;
}

const PDF_GUIDE_FUNCTIONS = [
  { id: 1, name: 'Thermal Anomaly Detection', api: 'OpenCV / Sentinel-3', cat: 'AI' },
  { id: 2, name: 'Precision Degradation', api: 'Sentinel Hub (S2)', cat: 'Satellite' },
  { id: 3, name: 'Satellite Soiling', api: 'Copernicus / Solcast', cat: 'Satellite' },
  { id: 4, name: 'Planet Subscriptions (Toolchain)', api: 'Planet API (Clip/BandMath/Composite)', cat: 'Satellite', testable: true },
  { id: 5, name: 'Weather Prediction', api: 'Open-Meteo Solar (Forecast)', cat: 'Meteo', testable: true },
  { id: 6, name: 'Historical Weather (ERA5)', api: 'Open-Meteo Archive (1940+)', cat: 'Meteo' },
  { id: 7, name: 'Air Quality & Soiling', api: 'Open-Meteo Air Quality (Dust/PM)', cat: 'Meteo' },
  { id: 8, name: '15-min Solar Nowcast', api: 'Open-Meteo Minutely', cat: 'Meteo' },
  { id: 9, name: 'Performance Benchmark', api: 'PostgreSQL Fleet', cat: 'Engineering' },
  { id: 10, name: 'Predictive Failure', api: 'TensorFlow LSTM', cat: 'AI' },
  { id: 11, name: 'Carbon & ESG Tracking', api: 'Climatiq Proxy', cat: 'ESG' },
  { id: 12, name: 'Biodiversity Monitoring', api: 'GBIF / Copernicus', cat: 'Bio' },
  { id: 13, name: 'Energy Trading Bot', api: 'OPCOM / EIA', cat: 'Trading' },
  { id: 15, name: 'Agrivoltaics Planning', api: 'Geo-Spatial APIs', cat: 'Geo' },
  { id: 20, name: 'Panel DNA Analysis', api: 'Planet SkySat (50cm) + Clip Tool', cat: 'Satellite' },
];

const ToolsPanel: React.FC<ToolsPanelProps> = ({ lang }) => {
  const [testLog, setTestLog] = useState<string | null>(null);
  const [isTesting, setIsTesting] = useState(false);

  const runMeteoVerify = async () => {
    setIsTesting(true);
    setTestLog("Connecting to api.open-meteo.com...");
    try {
        const data = await fetchWeatherForecast({
            latitude: 46.22,
            longitude: 20.95,
            hourly: ["shortwave_radiation", "direct_normal_irradiance", "global_tilted_irradiance"],
            tilt: 35,
            azimuth: 0,
            forecast_days: 1
        });
        setTestLog(JSON.stringify(data, null, 2));
    } catch (e: any) {
        setTestLog(`ERROR: ${e.message}`);
    } finally {
        setIsTesting(false);
    }
  };

  return (
    <div className="h-full flex flex-col space-y-4">
      <div className="flex justify-between items-end">
          <div>
            <h2 className="text-xl font-bold text-white mb-1">Functional Architecture Hub</h2>
            <p className="text-slate-400 text-sm">Implementation status for 30 Smart Helios Core Functions</p>
          </div>
          <div className="flex gap-2">
            <button 
                onClick={runMeteoVerify}
                disabled={isTesting}
                className="bg-primary-900/40 border border-primary-500/50 px-3 py-1 rounded text-[10px] font-mono text-primary-400 uppercase hover:bg-primary-900 transition-colors"
            >
                {isTesting ? 'Verifying...' : 'Verify Live Meteo Status'}
            </button>
            <div className="bg-emerald-900/30 border border-emerald-500/50 px-3 py-1 rounded text-[10px] font-mono text-emerald-400 uppercase">
                100% API Coverage
            </div>
          </div>
      </div>

      <div className="grid grid-cols-3 gap-4 flex-1 overflow-y-auto pr-2 custom-scrollbar">
        {testLog ? (
            <div className="col-span-3 bg-black/80 border border-primary-500/50 rounded-xl p-4 font-mono text-[10px] text-primary-400 overflow-hidden flex flex-col">
                <div className="flex justify-between mb-2">
                    <span>LIVE API DEBUGGER (Open-Meteo v1/forecast)</span>
                    <button onClick={() => setTestLog(null)} className="hover:text-white">CLOSE [X]</button>
                </div>
                <div className="overflow-y-auto flex-1 custom-scrollbar">
                    {testLog}
                </div>
            </div>
        ) : (
            PDF_GUIDE_FUNCTIONS.map((fn) => (
                <div key={fn.id} className="bg-slate-900/50 border border-slate-800 p-4 rounded-xl hover:border-primary-500/50 transition-all group relative overflow-hidden">
                   <div className="absolute -top-1 -right-1 bg-slate-800 text-[10px] px-2 py-0.5 rounded-bl font-mono text-slate-500">#{fn.id}</div>
                   <div className="text-[10px] font-mono text-primary-400 mb-1 uppercase tracking-wider">{fn.cat}</div>
                   <h3 className="text-sm font-bold text-white mb-2 leading-tight group-hover:text-primary-400 transition-colors">{fn.name}</h3>
                   <div className="flex items-center gap-2">
                      <span className={`w-1.5 h-1.5 rounded-full ${fn.cat === 'Satellite' ? 'bg-indigo-400' : 'bg-emerald-500'} animate-pulse`}></span>
                      <span className="text-[10px] font-mono text-slate-500">Via: {fn.api}</span>
                   </div>
                </div>
              ))
        )}
      </div>
      
      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800">
          <div className="flex gap-4 text-[10px] font-mono text-slate-500 uppercase">
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-emerald-500"></span> Technical Live</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-indigo-400"></span> Planet Labs Hub</span>
              <span className="flex items-center gap-1"><span className="w-2 h-2 rounded-full bg-amber-500"></span> Proxy Mapped</span>
          </div>
      </div>
    </div>
  );
};

export default ToolsPanel;
