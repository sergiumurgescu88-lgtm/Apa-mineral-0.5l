
import React, { useState, useEffect } from 'react';
import { Place, RoofAnnotation, ToolCallLog, Language, SolarPark, SolarForecast } from '../types';
import { t } from '../translations';

interface MapViewProps {
  activeToolLog: ToolCallLog | null;
  lang: Language;
}

const MapView: React.FC<MapViewProps> = ({ activeToolLog, lang }) => {
  const [currentPlace, setCurrentPlace] = useState<Place | null>(null);
  const [currentSolarPark, setCurrentSolarPark] = useState<SolarPark | null>(null);
  const [searchResults, setSearchResults] = useState<SolarPark[]>([]);
  const [placesMap, setPlacesMap] = useState<Record<string, Place>>({});
  const [annotations, setAnnotations] = useState<RoofAnnotation[]>([]);
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [isListOpen, setIsListOpen] = useState(true);
  
  // Weather & Satellite State
  const [weatherData, setWeatherData] = useState<any>(null);
  const [satelliteData, setSatelliteData] = useState<any>(null);
  const [planetData, setPlanetData] = useState<any>(null);

  // Dashboard Tabs State
  const [activeTab, setActiveTab] = useState<'overview' | 'sat' | 'meteo'>('overview');

  useEffect(() => {
    if (!activeToolLog) return;

    if (activeToolLog.toolName === 'searchPlaces' && activeToolLog.result?.places) {
      if (activeToolLog.result.places.length > 0) {
        setCurrentPlace(activeToolLog.result.places[0]);
        setCurrentSolarPark(null);
        setSearchResults([]);
        setAnnotations([]); 
        setWeatherData(null);
        setSatelliteData(null);
        setPlanetData(null);
      }
    }

    if (activeToolLog.toolName === 'searchSolarParks' && activeToolLog.result) {
        const parks = activeToolLog.result.parks as SolarPark[];
        if (parks && parks.length > 0) {
            setSearchResults(parks);
            setCurrentSolarPark(parks[0]);
            setIsListOpen(true);
            setAnnotations([]);
        }
    }

    // Handle Open-Meteo
    if (['fetch_weather_forecast', 'fetch_solar_radiation_forecast'].includes(activeToolLog.toolName) && activeToolLog.result) {
        setWeatherData(activeToolLog.result);
        setActiveTab('meteo');
    }

    // Handle Copernicus Satellite Analysis
    if (activeToolLog.toolName === 'fetch_satellite_imagery' && activeToolLog.result) {
        setSatelliteData(activeToolLog.result);
        setPlanetData(null); 
        if (activeToolLog.result.visualUrl) {
             // Update the viewport with the satellite image
             if (currentPlace) setCurrentPlace({...currentPlace, imageUrl: activeToolLog.result.visualUrl});
             else if (currentSolarPark) setCurrentPlace({ id: 'tmp', name: currentSolarPark.name, address: '', location: currentSolarPark.location, type: 'park', imageUrl: activeToolLog.result.visualUrl });
        }
        setActiveTab('sat');
    }

    // Handle Planet Labs Analysis
    if (activeToolLog.toolName === 'fetch_planet_imagery' && activeToolLog.result) {
        setPlanetData(activeToolLog.result);
        setSatelliteData(null); 
        if (activeToolLog.result.visualUrl) {
            if (currentPlace) setCurrentPlace({...currentPlace, imageUrl: activeToolLog.result.visualUrl});
            else if (currentSolarPark) setCurrentPlace({ id: 'tmp', name: currentSolarPark.name, address: '', location: currentSolarPark.location, type: 'park', imageUrl: activeToolLog.result.visualUrl });
        }
        setActiveTab('sat');
    }

  }, [activeToolLog]);

  const handleParkSelect = (park: SolarPark) => {
      setCurrentSolarPark(park);
      setActiveTab('overview');
  };

  const getNDVIColor = (val: number) => {
    if (val > 0.6) return 'text-emerald-400';
    if (val > 0.4) return 'text-primary-400';
    return 'text-amber-400';
  };

  const triggerAction = (actionId: string) => {
      const siteName = currentSolarPark?.name || currentPlace?.name || "Unknown Site";
      const coords = currentSolarPark?.location || currentPlace?.location;
      
      let prompt = "";
      
      switch(actionId) {
          case 'image_gen':
              prompt = lang === 'ro' 
                ? `Generează o imagine fotorealistă 2K a parcului fotovoltaic ${siteName} în condiții de vreme actuală.` 
                : `Generate a photorealistic 2K image of the solar park ${siteName} under current weather conditions.`;
              break;
          case 'ndvi':
              prompt = lang === 'ro' 
                ? `Calculează indicele NDVI pentru ${siteName} folosind Planet Toolchain (Clip, Band Math, File Format). Stochează rezultatul pentru monitorizarea vegetației.`
                : `Calculate NDVI for ${siteName} using Planet Toolchain (Clip, Band Math, File Format). Ensure result is stored and accessible for analysis.`;
              break;
          case 'skysat':
              prompt = lang === 'ro' 
                ? `Activează monitorizarea SkySat (50cm) pentru ${siteName} (${coords?.lat}, ${coords?.lng}) cu max 5% nori și benzile NIR, Red, Blue.`
                : `Trigger SkySat (50cm) monitoring for ${siteName} (${coords?.lat}, ${coords?.lng}) with max 5% cloud cover and retrieve NIR, Red, and Blue bands.`;
              break;
          case 'satellite':
              prompt = lang === 'ro' 
                ? `Efectuează o analiză satelitară Sentinel pentru ${siteName}. Calculează indicele NDVI și raportează riscurile.` 
                : `Perform a comprehensive satellite analysis for ${siteName}. Calculate NDVI vegetation health indices and report risks.`;
              break;
          case 'anomaly':
              prompt = lang === 'ro' 
                ? `Rulează o analiză completă de anomalii de sistem pentru ${siteName}.` 
                : `Run a full system anomaly analysis for ${siteName}.`;
              break;
          case 'audit':
               prompt = lang === 'ro' 
                ? `Generează un raport tehnic complet (Site Report) pentru ${siteName}.` 
                : `Generate a comprehensive technical site audit for ${siteName}.`;
              break;
      }

      window.dispatchEvent(new CustomEvent('helios-report-trigger', { 
          detail: { 
              siteName: siteName,
              actionPrompt: prompt,
              data: { weather: weatherData, sat: satelliteData || planetData, park: currentSolarPark }
          } 
      }));
  };

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden flex items-center justify-center font-sans">
      {currentPlace || currentSolarPark ? (
        <>
            <img 
                src={currentPlace?.imageUrl || `https://picsum.photos/seed/${currentSolarPark?.id || 'default'}/1200/900`} 
                alt="Sat View" 
                className={`w-full h-full object-cover transition-all duration-1000 ${planetData ? 'opacity-90 saturate-125' : 'opacity-60'}`} 
            />
            
            <div className="absolute top-4 left-4 z-20 flex flex-col gap-2">
                <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 p-4 rounded-xl shadow-2xl w-85">
                    <div className="flex items-start justify-between mb-2">
                        <div>
                            <div className="flex items-center gap-2 mb-1">
                                <span className={`relative flex h-2 w-2`}>
                                  <span className={`animate-ping absolute inline-flex h-full w-full rounded-full ${planetData ? 'bg-indigo-400' : 'bg-emerald-400'} opacity-75`}></span>
                                  <span className={`relative inline-flex rounded-full h-2 w-2 ${planetData ? 'bg-indigo-500' : 'bg-emerald-500'}`}></span>
                                </span>
                                <span className={`text-[10px] font-mono uppercase ${planetData ? 'text-indigo-400' : 'text-emerald-400'} tracking-wider font-bold`}>
                                    {planetData ? 'Planet Labs 3.0m Daily' : (satelliteData ? 'Copernicus Sentinel' : 'Digital Asset Feed')}
                                </span>
                            </div>
                            <h3 className="text-white font-bold text-lg leading-tight truncate max-w-[220px]">
                                {currentSolarPark ? currentSolarPark.name : (currentPlace?.name || 'Asset View')}
                            </h3>
                        </div>
                        {planetData && (
                            <div className="bg-indigo-600/20 border border-indigo-500/50 px-2 py-0.5 rounded text-[9px] font-mono text-indigo-300 font-bold">
                                HI-RES
                            </div>
                        )}
                    </div>

                    <div className="grid grid-cols-2 gap-2 mt-3">
                         <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                             <p className="text-slate-500 font-mono text-[9px] uppercase">Temperature</p>
                             <p className="text-lg font-bold text-amber-400">{weatherData?.current?.temperature_2m || '22.4'}°C</p>
                         </div>
                         <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                             <p className="text-slate-500 font-mono text-[9px] uppercase">NDVI Index</p>
                             <p className={`text-lg font-bold ${getNDVIColor(planetData?.ndvi_mean || satelliteData?.analysis?.ndvi || 0.52)}`}>
                                {planetData?.ndvi_mean || satelliteData?.analysis?.ndvi || '0.52'}
                             </p>
                         </div>
                    </div>
                </div>

                <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl w-85 overflow-hidden transition-all duration-300">
                    <div className="flex border-b border-slate-700">
                        {(['overview', 'sat', 'meteo'] as const).map(tab => (
                            <button
                                key={tab}
                                onClick={() => setActiveTab(tab)}
                                className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider transition-all ${
                                    activeTab === tab 
                                    ? `bg-slate-800 text-white border-b-2 ${tab === 'sat' ? 'border-primary-500' : 'border-emerald-500'}` 
                                    : 'text-slate-500 hover:text-slate-300'
                                }`}
                            >
                                {tab}
                            </button>
                        ))}
                    </div>
                    
                    <div className="p-4 min-h-[160px]">
                        {activeTab === 'sat' && (
                            <div className="space-y-3 animate-in fade-in slide-in-from-bottom-2">
                                {planetData ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center bg-indigo-900/20 p-2 rounded border border-indigo-500/30">
                                            <span className="text-[10px] text-indigo-300 font-bold font-mono">Planet Sub ID</span>
                                            <span className="text-[10px] text-white font-mono truncate max-w-[120px]">{planetData.id}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800">
                                                <p className="text-[9px] text-slate-400 font-mono uppercase">Resolution</p>
                                                <p className="text-xs font-bold text-indigo-400">{planetData.resolution}</p>
                                            </div>
                                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800">
                                                <p className="text-[9px] text-slate-400 font-mono uppercase">Cloud Cover</p>
                                                <p className="text-xs font-bold text-white">{planetData.metadata?.cloud_cover || '0.2%'}</p>
                                            </div>
                                            {planetData.evi_mean && (
                                                <div className="bg-slate-950/50 p-2 rounded border border-slate-800">
                                                    <p className="text-[9px] text-slate-400 font-mono uppercase">EVI Index</p>
                                                    <p className="text-xs font-bold text-emerald-300">{planetData.evi_mean}</p>
                                                </div>
                                            )}
                                        </div>
                                        <div className="bg-emerald-900/20 p-2 rounded text-[10px] font-mono text-emerald-300 border border-emerald-900/50 flex justify-between">
                                            <span>DAILY REVISIT STATUS:</span>
                                            <span className="font-bold">ACTIVE</span>
                                        </div>
                                    </div>
                                ) : satelliteData ? (
                                    <div className="space-y-2">
                                        <div className="flex justify-between items-center mb-1">
                                            <span className="text-[10px] text-slate-500 font-mono uppercase">Engine: {satelliteData.metadata?.processingType}</span>
                                            <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-primary-400 border border-slate-700">{satelliteData.metadata?.resolution}</span>
                                        </div>
                                        <div className="grid grid-cols-2 gap-2">
                                            <div className="bg-slate-950/50 p-2 rounded border border-slate-800">
                                                <p className="text-[9px] text-slate-400 font-mono uppercase">EVI Health</p>
                                                <p className="text-sm font-bold text-primary-300">{satelliteData.analysis?.evi || '0.42'}</p>
                                            </div>
                                            <div className="bg-slate-950/50 p-2 rounded border border-primary-500/20">
                                                <p className="text-[9px] text-primary-400 font-mono uppercase">Soiling Risk</p>
                                                <p className={`text-[10px] font-bold ${satelliteData.analysis?.soilingEstimate?.includes('Moderate') ? 'text-amber-400' : 'text-white'} truncate`}>
                                                    {satelliteData.analysis?.soilingEstimate || 'Stable'}
                                                </p>
                                            </div>
                                        </div>
                                        <div className="text-[9px] text-slate-500 font-mono italic">Provider: {satelliteData.provider}</div>
                                    </div>
                                ) : (
                                    <div className="text-center py-10 flex flex-col items-center gap-2">
                                        <svg className="text-slate-700 animate-pulse" xmlns="http://www.w3.org/2000/svg" width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17.5 19H9a7 7 0 1 1 6.71-9h1.79a4.5 4.5 0 1 1 0 9Z"/></svg>
                                        <p className="text-slate-500 text-xs italic">Trigger a satellite analysis for high-precision monitoring.</p>
                                    </div>
                                )}
                            </div>
                        )}
                        {activeTab === 'overview' && (currentSolarPark || currentPlace) && (
                             <div className="text-xs space-y-2 text-slate-300 font-mono animate-in fade-in slide-in-from-bottom-2">
                                <p><span className="text-slate-500">Asset Name:</span> {currentSolarPark?.name || currentPlace?.name}</p>
                                <p><span className="text-slate-500">Location:</span> {currentSolarPark?.county || 'Strategic Region'}, RO</p>
                                {currentSolarPark && <p><span className="text-slate-500">System Capacity:</span> {currentSolarPark.capacityMw} MWp</p>}
                                <p><span className="text-slate-500">Coordinates:</span> {currentSolarPark?.location.lat.toFixed(4) || currentPlace?.location.lat.toFixed(4)}, {currentSolarPark?.location.lng.toFixed(4) || currentPlace?.location.lng.toFixed(4)}</p>
                                
                                {currentSolarPark && currentSolarPark.co2AvoidedTons && (
                                    <div className="bg-emerald-900/10 border border-emerald-500/20 p-2 rounded mt-2">
                                        <div className="flex items-center gap-1.5 mb-1">
                                            <svg className="text-emerald-500" xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M4 22a8 8 0 1 1 16 0"/><path d="M12 2v20"/><path d="M2 10h20"/></svg>
                                            <span className="text-[10px] font-mono uppercase text-emerald-400 font-bold">ESG: Carbon Impact</span>
                                        </div>
                                        <div className="flex justify-between items-end">
                                            <div>
                                                <p className="text-sm font-bold text-white">{currentSolarPark.co2AvoidedTons.toLocaleString()} t</p>
                                                <p className="text-[9px] text-slate-500">CO2 Avoided / Year</p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-xs text-emerald-300">~{Math.round(currentSolarPark.co2AvoidedTons / 0.02)}</p>
                                                <p className="text-[9px] text-slate-500">Trees Equivalent</p>
                                            </div>
                                        </div>
                                    </div>
                                )}

                                <div className="mt-2 pt-2 border-t border-slate-800 flex justify-between">
                                    <span className="text-slate-500 uppercase text-[9px]">Operator</span>
                                    <span className="text-emerald-400 font-bold">{currentSolarPark?.operator || 'External'}</span>
                                </div>
                             </div>
                        )}
                    </div>

                    {/* ACTION GRID */}
                    <div className="px-4 pb-4">
                        <div className="grid grid-cols-2 gap-2 mb-2">
                            <button 
                                onClick={() => triggerAction('ndvi')}
                                className="bg-emerald-900/40 hover:bg-emerald-800/60 text-emerald-400 border border-emerald-500/30 p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                                title="Run NDVI Planet Toolchain"
                            >
                                <span>🌱</span> NDVI Analiza
                            </button>
                            <button 
                                onClick={() => triggerAction('skysat')}
                                className="bg-slate-800 hover:bg-slate-700 text-primary-400 border border-primary-500/30 p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                                title="SkySat 50cm"
                            >
                                <span>🌍</span> SkySat
                            </button>
                            <button 
                                onClick={() => triggerAction('satellite')}
                                className="bg-slate-800 hover:bg-slate-700 text-white border border-slate-700 p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                                title="Sat Analysis"
                            >
                                <span>🛰️</span> Sat Analysis
                            </button>
                            <button 
                                onClick={() => triggerAction('anomaly')}
                                className="bg-slate-800 hover:bg-slate-700 text-amber-400 border border-amber-500/30 p-2 rounded text-[10px] font-bold flex items-center justify-center gap-1 transition-colors"
                                title="Anomaly Detect"
                            >
                                <span>🧠</span> Anomaly
                            </button>
                        </div>
                        <button 
                            className="w-full bg-emerald-600 hover:bg-emerald-500 text-white text-[10px] font-mono font-bold py-2.5 rounded flex items-center justify-center gap-2 group transition-all shadow-lg active:scale-95"
                            onClick={() => triggerAction('audit')}
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="group-hover:animate-bounce"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><line x1="10" y1="9" x2="8" y2="9"/></svg>
                            GENERATE TECHNICAL AUDIT
                        </button>
                    </div>
                </div>
            </div>

            {/* Scale Indicator */}
            <div className="absolute bottom-6 left-6 z-20 flex items-center gap-3 bg-slate-900/80 backdrop-blur border border-slate-700 px-3 py-1.5 rounded text-[10px] font-mono text-slate-400">
                <div className="w-12 h-1 bg-slate-700 relative">
                    <div className="absolute top-0 left-0 w-6 h-full bg-white"></div>
                </div>
                <span>50m</span>
                <span className="text-slate-600">|</span>
                <span>Z-Level: 18.4</span>
            </div>
        </>
      ) : (
        <div className="text-center p-12 border border-dashed border-slate-800 rounded-3xl bg-slate-900/30 flex flex-col items-center max-w-sm">
            <div className="w-16 h-16 bg-slate-800 rounded-2xl mb-4 flex items-center justify-center text-slate-600">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
            </div>
            <h3 className="text-slate-300 font-bold text-lg">HELIOS DIGITAL ASSET</h3>
            <p className="text-slate-500 text-xs mt-3 leading-relaxed">Search for a solar asset (e.g. 'Livada') or trigger a coordinate-based technical analysis to initialize the satellite feed.</p>
        </div>
      )}
    </div>
  );
};

export default MapView;
