
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
  
  // Weather State
  const [weatherData, setWeatherData] = useState<SolarForecast | null>(null);

  // Dashboard Tabs State
  const [activeTab, setActiveTab] = useState<'overview' | 'financial' | 'health' | 'meteo'>('overview');

  useEffect(() => {
    if (!activeToolLog) return;

    if (activeToolLog.toolName === 'searchPlaces' && activeToolLog.result?.places) {
      if (activeToolLog.result.places.length > 0) {
        setCurrentPlace(activeToolLog.result.places[0]);
        setCurrentSolarPark(null);
        setSearchResults([]);
        setAnnotations([]); 
        setWeatherData(null);
      }
    }

    if (activeToolLog.toolName === 'searchSolarParks' && activeToolLog.result) {
        const parks = activeToolLog.result.parks as SolarPark[];
        const places = activeToolLog.result.places as Place[];

        if (parks && parks.length > 0) {
            setSearchResults(parks);
            
            const pMap: Record<string, Place> = {};
            parks.forEach((park, idx) => {
                if (places[idx]) pMap[park.id] = places[idx];
            });
            setPlacesMap(pMap);

            setCurrentSolarPark(parks[0]);
            if (places[0]) setCurrentPlace(places[0]);
            
            setIsListOpen(true);
            setAnnotations([]);
        } else {
             setSearchResults([]);
        }
    }

    if (activeToolLog.toolName === 'analyzeRoof') {
        setIsAnalyzing(true);
        if (activeToolLog.result?.analysis) {
             setTimeout(() => {
                 setAnnotations(activeToolLog.result.analysis.annotations);
                 setIsAnalyzing(false);
             }, 1000);
        }
    }

    // Handle Anomaly Detection Tool
    if (activeToolLog.toolName === 'analyzeAnomalies' && activeToolLog.result) {
        const anomalies = activeToolLog.result.anomalies || [];
        if (currentSolarPark) {
            const alerts = anomalies.map((a: any) => `${a.severity}: ${a.message}`);
            const newHealth = activeToolLog.result.systemHealthScore || currentSolarPark.healthScore;
            
            setCurrentSolarPark(prev => prev ? ({
                ...prev,
                healthScore: newHealth,
                predictionAlerts: alerts
            }) : null);
            
            setActiveTab('health');
        }
    }

    // --- NEW: Handle Solar Forecast Tool (The Weather Test) ---
    if (activeToolLog.toolName === 'getSolarForecast' && activeToolLog.result?.forecast) {
        const forecast = activeToolLog.result.forecast as SolarForecast;
        setWeatherData(forecast);
        
        // If we don't have a place selected, create a dummy one to show the background
        if (!currentPlace) {
             setCurrentPlace({
                 id: 'weather_loc',
                 name: 'Weather Station Location',
                 address: 'Coordinates Selection',
                 location: { lat: 44.4, lng: 26.1 },
                 type: 'station',
                 imageUrl: 'https://picsum.photos/seed/weather/800/600'
             });
        }
        
        setActiveTab('meteo');
    }

  }, [activeToolLog]);

  const handleParkSelect = (park: SolarPark) => {
      setCurrentSolarPark(park);
      if (placesMap[park.id]) {
          setCurrentPlace(placesMap[park.id]);
      }
      setActiveTab('overview');
  };

  const fmtEur = (val: number) => new Intl.NumberFormat('en-EU', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(val);

  return (
    <div className="w-full h-full relative bg-slate-950 overflow-hidden flex items-center justify-center font-sans">
      {/* Background Layer */}
      {currentPlace ? (
        <>
            <img 
                src={currentPlace.imageUrl} 
                alt="Satellite View" 
                className={`w-full h-full object-cover transition-opacity duration-700 opacity-60 ${currentSolarPark || weatherData ? 'hue-rotate-15 contrast-125 saturate-50' : 'grayscale-[20%]'}`}
            />
            
            {/* --- MAP UI OVERLAYS --- */}

            {/* Smart Helios Digital Twin Dashboard */}
            {(currentSolarPark || weatherData) ? (
                <div className="absolute top-4 left-4 z-20 flex flex-col gap-2 animate-in fade-in slide-in-from-left-4 duration-500">
                    
                    {/* Header Card */}
                    <div className="bg-slate-900/95 backdrop-blur-xl border border-emerald-500/30 p-4 rounded-xl shadow-2xl w-80">
                        <div className="flex items-start justify-between mb-2">
                            <div>
                                <div className="flex items-center gap-2 mb-1">
                                    <span className="relative flex h-2 w-2">
                                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-emerald-400 opacity-75"></span>
                                      <span className="relative inline-flex rounded-full h-2 w-2 bg-emerald-500"></span>
                                    </span>
                                    <span className="text-[10px] font-mono uppercase text-emerald-400 tracking-wider font-bold">Smart Helios Twin</span>
                                </div>
                                <h3 className="text-white font-bold text-lg leading-tight">
                                    {currentSolarPark ? currentSolarPark.name.split(' (')[0] : 'Meteo Station Alpha'}
                                </h3>
                            </div>
                            <div className="text-right">
                                {currentSolarPark ? (
                                    <>
                                        <div className="text-2xl font-bold text-white leading-none tracking-tight">{currentSolarPark.capacityMw}</div>
                                        <div className="text-[9px] text-slate-400 font-mono uppercase">MW Capacity</div>
                                    </>
                                ) : (
                                    <>
                                        <div className="text-2xl font-bold text-white leading-none tracking-tight">LIVE</div>
                                        <div className="text-[9px] text-slate-400 font-mono uppercase">Open-Meteo Stream</div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Quick Stats Grid */}
                        <div className="grid grid-cols-2 gap-2 mt-3">
                             <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                                 <p className="text-slate-500 font-mono text-[9px] uppercase">
                                     {weatherData ? 'Current Temp' : 'Health Score'}
                                 </p>
                                 <div className="flex items-end gap-1">
                                     {weatherData ? (
                                         <span className="text-lg font-bold text-amber-400">{weatherData.temp}°C</span>
                                     ) : (
                                         <span className={`text-lg font-bold transition-colors duration-500 ${
                                             (currentSolarPark?.healthScore || 0) > 90 ? 'text-emerald-400' : 
                                             (currentSolarPark?.healthScore || 0) > 70 ? 'text-amber-400' : 'text-red-400'
                                         }`}>
                                             {currentSolarPark?.healthScore || '--'}%
                                         </span>
                                     )}
                                 </div>
                             </div>
                             <div className="bg-slate-950/60 p-2 rounded border border-slate-800">
                                 <p className="text-slate-500 font-mono text-[9px] uppercase">
                                     {weatherData ? 'Solar Irradiance' : 'Est. Daily Rev'}
                                 </p>
                                 <p className="text-lg font-bold text-white">
                                     {weatherData ? `${weatherData.ghi} W/m²` : (currentSolarPark?.dailyRevenueEur ? `€${(currentSolarPark.dailyRevenueEur / 1000).toFixed(1)}k` : '--')}
                                 </p>
                             </div>
                        </div>
                    </div>

                    {/* Tabbed Detail View */}
                    <div className="bg-slate-900/90 backdrop-blur-xl border border-slate-700 rounded-xl shadow-2xl w-80 overflow-hidden">
                        <div className="flex border-b border-slate-700">
                            {(['overview', 'financial', 'health', 'meteo'] as const).map(tab => (
                                <button
                                    key={tab}
                                    onClick={() => setActiveTab(tab)}
                                    className={`flex-1 py-2 text-[10px] font-mono uppercase tracking-wider transition-colors ${
                                        activeTab === tab 
                                        ? 'bg-slate-800 text-white border-b-2 border-emerald-500' 
                                        : 'text-slate-500 hover:text-slate-300'
                                    }`}
                                >
                                    {tab.slice(0, 4)}
                                </button>
                            ))}
                        </div>
                        
                        <div className="p-4 min-h-[140px]">
                            {activeTab === 'overview' && currentSolarPark && (
                                <div className="space-y-3">
                                    <div className="grid grid-cols-2 gap-x-4 gap-y-2 text-xs">
                                        <div>
                                            <p className="text-slate-500 text-[10px] font-mono">County</p>
                                            <p className="text-slate-200">{currentSolarPark.county}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-[10px] font-mono">Operator</p>
                                            <p className="text-slate-200 truncate" title={currentSolarPark.operator}>{currentSolarPark.operator}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-[10px] font-mono">Panels</p>
                                            <p className="text-slate-200">{currentSolarPark.panelsCount?.toLocaleString() || 'N/A'}</p>
                                        </div>
                                        <div>
                                            <p className="text-slate-500 text-[10px] font-mono">Status</p>
                                            <p className={currentSolarPark.status?.includes('Operational') ? 'text-emerald-400' : 'text-amber-400'}>
                                                {currentSolarPark.status === 'Operational' ? 'Online' : 'In Dev'}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="pt-2 border-t border-slate-700/50">
                                        <p className="text-slate-500 text-[10px] font-mono mb-1">CO2 AVOIDED (Est.)</p>
                                        <p className="text-emerald-400 font-mono font-bold text-sm">
                                            {currentSolarPark.co2AvoidedTons?.toLocaleString()} tonnes
                                        </p>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'financial' && currentSolarPark && (
                                <div className="space-y-3">
                                    <div className="flex items-center justify-between p-2 bg-slate-950/50 rounded border border-slate-700">
                                        <div className="flex flex-col">
                                            <span className="text-[10px] text-slate-400 font-mono">TRADING BOT</span>
                                            <span className="text-xs text-emerald-400 font-bold">ACTIVE</span>
                                        </div>
                                        <div className="text-right">
                                            <span className="text-xs font-bold text-white">+34.7%</span>
                                            <span className="text-[9px] text-slate-500 block">vs Manual</span>
                                        </div>
                                    </div>
                                    <div className="space-y-1">
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span>Annual Revenue Est.</span>
                                            <span className="font-mono text-white">{fmtEur((currentSolarPark.dailyRevenueEur || 0) * 365)}</span>
                                        </div>
                                        <div className="flex justify-between text-xs text-slate-300">
                                            <span>PPA Premium</span>
                                            <span className="font-mono text-emerald-400">+€12.50/MWh</span>
                                        </div>
                                    </div>
                                </div>
                            )}

                            {activeTab === 'health' && currentSolarPark && (
                                <div className="space-y-2">
                                     <div className="flex justify-between items-center mb-1">
                                        <span className="text-[10px] font-mono text-slate-400 uppercase">Active Alerts</span>
                                        <span className="bg-red-900/50 text-red-400 px-1.5 rounded text-[10px] font-bold">
                                            {currentSolarPark.predictionAlerts?.length || 0}
                                        </span>
                                     </div>
                                     <div className="space-y-2 max-h-[100px] overflow-y-auto custom-scrollbar">
                                         {currentSolarPark.predictionAlerts && currentSolarPark.predictionAlerts.length > 0 ? (
                                             currentSolarPark.predictionAlerts.map((alert, i) => (
                                                 <div key={i} className="bg-red-950/30 border border-red-900/30 p-2 rounded flex items-start gap-2">
                                                     <svg className="w-3 h-3 text-red-500 mt-0.5 shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" /></svg>
                                                     <p className="text-[10px] text-slate-300 leading-tight">{alert}</p>
                                                 </div>
                                             ))
                                         ) : (
                                             <div className="text-center py-4 text-slate-500 text-xs italic">
                                                 System Optimal. No anomalies predicted for next 14 days.
                                             </div>
                                         )}
                                     </div>
                                </div>
                            )}

                            {/* --- NEW METEO TAB --- */}
                            {activeTab === 'meteo' && (
                                <div className="space-y-3">
                                    {weatherData ? (
                                        <>
                                            <div className="grid grid-cols-3 gap-2 text-center">
                                                <div className="bg-slate-950/50 p-2 rounded border border-slate-700">
                                                    <p className="text-[9px] text-slate-400 font-mono">GHI</p>
                                                    <p className="text-sm font-bold text-amber-300">{weatherData.ghi}</p>
                                                    <p className="text-[8px] text-slate-500">Global</p>
                                                </div>
                                                <div className="bg-slate-950/50 p-2 rounded border border-emerald-500/20 shadow-inner">
                                                    <p className="text-[9px] text-emerald-400 font-mono font-bold">DNI</p>
                                                    <p className="text-sm font-bold text-white">{weatherData.dni || '--'}</p>
                                                    <p className="text-[8px] text-slate-500">Direct</p>
                                                </div>
                                                <div className="bg-slate-950/50 p-2 rounded border border-slate-700">
                                                    <p className="text-[9px] text-slate-400 font-mono">DHI</p>
                                                    <p className="text-sm font-bold text-sky-300">{weatherData.dhi || '--'}</p>
                                                    <p className="text-[8px] text-slate-500">Diffuse</p>
                                                </div>
                                            </div>
                                            
                                            <div className="flex items-center gap-3 bg-slate-800/50 p-2 rounded border border-slate-700">
                                                <div className="flex-1">
                                                    <div className="flex justify-between text-[10px] mb-1">
                                                        <span className="text-slate-400">Cloud Cover</span>
                                                        <span className="text-white font-mono">{weatherData.cloudCover}%</span>
                                                    </div>
                                                    <div className="h-1.5 w-full bg-slate-900 rounded-full overflow-hidden">
                                                        <div 
                                                            className="h-full bg-sky-500 transition-all duration-1000" 
                                                            style={{ width: `${weatherData.cloudCover}%` }} 
                                                        />
                                                    </div>
                                                </div>
                                                <div className="text-right">
                                                    <p className="text-[9px] text-slate-400">Confidence</p>
                                                    <p className="text-xs font-bold text-emerald-400">{(weatherData.confidence * 100).toFixed(0)}%</p>
                                                </div>
                                            </div>

                                            <p className="text-[9px] text-center text-slate-500 italic mt-1">
                                                Data Source: Open-Meteo API (Solar Radiation)
                                            </p>
                                        </>
                                    ) : (
                                        <div className="text-center py-8 text-slate-500 text-xs animate-pulse">
                                            Connecting to Weather Station...
                                        </div>
                                    )}
                                </div>
                            )}

                            {!currentSolarPark && activeTab !== 'meteo' && (
                                <div className="text-center py-8 text-slate-500 text-xs">
                                    Select a park or use the Weather tool.
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            ) : (
                /* Generic Place Overlay */
                <div className="absolute top-4 left-4 bg-slate-900/80 backdrop-blur border border-slate-700 p-3 rounded shadow-lg z-20">
                    <h3 className="text-white font-bold">{currentPlace.name}</h3>
                    <p className="text-xs text-slate-300">{currentPlace.address}</p>
                </div>
            )}
            
            {/* Search Results List Overlay */}
            {searchResults.length > 1 && (
                <div className={`absolute top-4 right-4 bg-slate-900/95 backdrop-blur-md border border-slate-700 rounded-xl shadow-2xl flex flex-col transition-all duration-300 z-30 overflow-hidden ${isListOpen ? 'w-72 max-h-[80%]' : 'w-auto h-auto'}`}>
                    <div 
                        className="p-3 border-b border-slate-700 flex justify-between items-center cursor-pointer bg-slate-900 hover:bg-slate-800 transition-colors" 
                        onClick={() => setIsListOpen(!isListOpen)}
                    >
                        <div className="flex items-center gap-2">
                            <span className="flex items-center justify-center w-5 h-5 rounded-full bg-emerald-600 text-[10px] font-bold text-white">
                                {searchResults.length}
                            </span>
                            <span className="text-slate-200 text-xs font-bold uppercase tracking-wide">{t(lang, 'map', 'results')}</span>
                        </div>
                        <button className="text-slate-400 hover:text-white">
                            <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className={`transition-transform duration-300 ${isListOpen ? 'rotate-180' : 'rotate-0'}`}><polyline points="6 9 12 15 18 9"/></svg>
                        </button>
                    </div>
                    
                    {isListOpen && (
                        <div className="overflow-y-auto flex-1 p-2 space-y-2 custom-scrollbar bg-slate-950/50">
                            {searchResults.map(park => (
                                <div 
                                    key={park.id}
                                    onClick={() => handleParkSelect(park)}
                                    className={`p-3 rounded-lg border cursor-pointer transition-all relative ${
                                        currentSolarPark?.id === park.id 
                                        ? 'bg-emerald-900/20 border-emerald-500/50 shadow-md' 
                                        : 'bg-slate-800/40 border-slate-700/50 hover:border-slate-500 hover:bg-slate-800'
                                    }`}
                                >
                                    {currentSolarPark?.id === park.id && (
                                        <div className="absolute left-0 top-0 bottom-0 w-1 bg-emerald-500 rounded-l-lg"></div>
                                    )}
                                    <div className="flex justify-between items-start mb-1">
                                        <h4 className={`text-xs font-bold truncate pr-2 ${currentSolarPark?.id === park.id ? 'text-white' : 'text-slate-300'}`}>
                                            {park.name.replace('Parc Fotovoltaic', '').replace('Centrala Fotovoltaică', '').trim()}
                                        </h4>
                                        <span className="text-[10px] font-mono text-emerald-400 bg-emerald-950/50 px-1 rounded border border-emerald-900/50 whitespace-nowrap">
                                            {park.capacityMw} MW
                                        </span>
                                    </div>
                                    <div className="flex justify-between items-center text-[10px] text-slate-500">
                                        <div className="flex items-center gap-1">
                                            <svg xmlns="http://www.w3.org/2000/svg" width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg>
                                            {park.county}
                                        </div>
                                        <span className={park.status?.includes('Operational') ? 'text-emerald-500/80' : 'text-amber-500/80'}>
                                            {(park.healthScore || 0) > 0 ? `Health: ${park.healthScore}%` : 'Dev'}
                                        </span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

            {/* Scanning Effect */}
            {isAnalyzing && (
                <div className="absolute inset-0 bg-emerald-500/10 z-10 animate-pulse pointer-events-none border-4 border-emerald-500/30">
                    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-emerald-400 font-mono text-xl tracking-widest font-bold">
                        {t(lang, 'map', 'scanning')}
                    </div>
                </div>
            )}

            {/* Annotation Overlay (SVG) */}
            <svg className="absolute inset-0 w-full h-full pointer-events-none z-20">
                <defs>
                    <pattern id="grid" width="20" height="20" patternUnits="userSpaceOnUse">
                        <path d="M 20 0 L 0 0 0 20" fill="none" stroke="rgba(255,255,255,0.1)" strokeWidth="1"/>
                    </pattern>
                </defs>
                <rect width="100%" height="100%" fill="url(#grid)" />
                {annotations.map((ann) => {
                    return (
                        <g key={ann.id}>
                            <rect 
                                x="25%" 
                                y="25%" 
                                width="50%" 
                                height="50%" 
                                fill={ann.type === 'roof_edge' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.3)'}
                                stroke={ann.type === 'roof_edge' ? '#10b981' : '#ef4444'}
                                strokeWidth="2"
                                strokeDasharray={ann.type === 'roof_edge' ? 'none' : '4 4'}
                            />
                            <text x="26%" y="29%" fill="white" fontSize="12" fontFamily="monospace">
                                {ann.type.toUpperCase()} ({ann.area} m²)
                            </text>
                        </g>
                    )
                })}
            </svg>
        </>
      ) : (
        <div className="text-center p-8 border border-dashed border-slate-700 rounded-xl bg-slate-900/50">
            <div className="w-16 h-16 bg-slate-800 rounded-full flex items-center justify-center mx-auto mb-4 text-slate-500">
                <svg xmlns="http://www.w3.org/2000/svg" width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10"/><path d="M12 2a14.5 14.5 0 0 0 0 20 14.5 14.5 0 0 0 0-20"/><path d="M2 12h20"/></svg>
            </div>
            <h3 className="text-slate-300 font-medium">{t(lang, 'map', 'emptyTitle')}</h3>
            <p className="text-slate-500 text-sm mt-2 max-w-xs">
                {t(lang, 'map', 'emptyDesc')}
            </p>
        </div>
      )}
    </div>
  );
};

export default MapView;
