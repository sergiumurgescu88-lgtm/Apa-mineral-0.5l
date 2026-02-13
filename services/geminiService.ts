
import { GoogleGenAI, Type, FunctionDeclaration, GenerateContentResponse } from "@google/genai";
import { searchPlaces } from "./googleMapsService";
import { analyzeRoofImage } from "./annoBananaService";
import { createSimulationJob, getLicenseInfo } from "./pvsystService";
import { searchParks } from "./solarParkData";
import { 
  SYSTEM_INSTRUCTION_RO, 
  SYSTEM_INSTRUCTION_EN, 
  GEMINI_PRO_MODEL_ID, 
  GEMINI_FLASH_MODEL_ID, 
  DEFAULT_MODEL_ID,
  GEMINI_IMAGE_GEN_MODEL_ID,
  GEMINI_IMAGE_EDIT_MODEL_ID
} from "../constants";
import { ImageSize, Language, Attachment, GroundingSource } from "../types";

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const isRateLimit = e.message?.includes('429') || e.message?.includes('RESOURCE_EXHAUSTED') || e.status === 429 || e.status === 503;
    if (retries > 0 && isRateLimit) {
      const waitTime = baseDelay * (3 - retries); 
      console.warn(`[Gemini] Rate limit hit. Retrying in ${waitTime}ms...`);
      await delay(waitTime);
      return withRetry(fn, retries - 1, baseDelay);
    }
    throw e;
  }
}

const BACKEND = 'http://localhost:3001/api';

const fetchJson = async (endpoint: string, options: any = {}) => {
    try {
        const res = await fetch(`${BACKEND}${endpoint}`, options);
        if (!res.ok) throw new Error(`Backend Error ${res.status}`);
        return await res.json();
    } catch (e: any) {
        return { error: `Backend connection failed: ${e.message}`, isConnectionError: true };
    }
};

// --- TECHNICAL TOOLS REGISTRY ---

const generateSiteReportTool: FunctionDeclaration = {
    name: "generate_technical_site_report",
    description: "Synthesize all current site data (Telemetry, Planet High-Res, Copernicus, Meteo, PVsyst) into a high-level executive report with prioritized action items.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            siteName: { type: Type.STRING },
            telemetrySummary: { type: Type.STRING, description: "Raw or summarized data from other tools." },
            tone: { type: Type.STRING, enum: ["technical", "executive", "urgent"], default: "executive" }
        },
        required: ["siteName", "telemetrySummary"]
    }
};

// --- OPEN-METEO WEATHER TOOLS (COMPREHENSIVE) ---

const fetchWeatherForecastTool: FunctionDeclaration = {
    name: "fetch_weather_forecast",
    description: "Fetches comprehensive weather forecast from Open-Meteo API for up to 16 days. Includes temperature, precipitation, wind, humidity, cloud cover, and solar radiation data.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            hourly: { type: Type.ARRAY, items: { type: Type.STRING } },
            daily: { type: Type.ARRAY, items: { type: Type.STRING } },
            current: { type: Type.ARRAY, items: { type: Type.STRING } },
            past_days: { type: Type.NUMBER, description: "Include past days data (0-92)" },
            forecast_days: { type: Type.NUMBER, description: "Number of forecast days (0-16). Default 7." },
            tilt: { type: Type.NUMBER, description: "Solar panel tilt angle (0-90)" },
            azimuth: { type: Type.NUMBER, description: "Solar panel azimuth (-180 to 180)" },
            timezone: { type: Type.STRING, description: "Timezone (e.g., 'auto', 'Europe/Bucharest')" }
        },
        required: ["latitude", "longitude"]
    }
};

const fetchSolarRadiationForecastTool: FunctionDeclaration = {
    name: "fetch_solar_radiation_forecast",
    description: "Fetches detailed solar radiation forecast optimized for solar energy applications. Includes GHI, DNI, DHI, and tilted irradiance.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            tilt: { type: Type.NUMBER, default: 35 },
            azimuth: { type: Type.NUMBER, default: 0 },
            forecast_days: { type: Type.NUMBER, default: 7 },
            past_days: { type: Type.NUMBER, default: 0 },
            timezone: { type: Type.STRING, default: "auto" }
        },
        required: ["latitude", "longitude"]
    }
};

const fetch15MinuteSolarDataTool: FunctionDeclaration = {
    name: "fetch_15_minute_solar_data",
    description: "Fetches 15-minute resolution solar radiation data for precise nowcasting. Essential for battery dispatch optimization.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            minutely_15: { type: Type.ARRAY, items: { type: Type.STRING }, default: ["shortwave_radiation", "direct_normal_irradiance", "global_tilted_irradiance"] },
            forecast_minutely_15: { type: Type.NUMBER, default: 96 },
            tilt: { type: Type.NUMBER },
            azimuth: { type: Type.NUMBER }
        },
        required: ["latitude", "longitude"]
    }
};

const fetchHistoricalWeatherTool: FunctionDeclaration = {
    name: "fetch_historical_weather",
    description: "Fetches historical weather data (ERA5) from 1940 to present. Critical for backtesting yield models and analyzing long-term trends.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            start_date: { type: Type.STRING, description: "YYYY-MM-DD" },
            end_date: { type: Type.STRING, description: "YYYY-MM-DD" },
            hourly: { type: Type.ARRAY, items: { type: Type.STRING } },
            daily: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["latitude", "longitude", "start_date", "end_date"]
    }
};

const fetchAirQualityTool: FunctionDeclaration = {
    name: "fetch_air_quality",
    description: "Fetches air quality data (Dust, PM10, PM2.5, AOD). Essential for soiling loss estimation and cleaning scheduling.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER },
            hourly: { 
                type: Type.ARRAY, 
                items: { type: Type.STRING, enum: ["dust", "pm10", "pm2_5", "aerosol_optical_depth", "uv_index"] },
                default: ["dust", "pm10"]
            },
            forecast_days: { type: Type.NUMBER, default: 5 }
        },
        required: ["latitude", "longitude"]
    }
};

const searchLocationTool: FunctionDeclaration = {
    name: "search_location",
    description: "Geocoding service to find coordinates and elevation for a city or place name.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            count: { type: Type.NUMBER, default: 5 }
        },
        required: ["name"]
    }
};

const getElevationTool: FunctionDeclaration = {
    name: "get_elevation",
    description: "Get accurate digital elevation model (DEM) data for a location.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            latitude: { type: Type.NUMBER },
            longitude: { type: Type.NUMBER }
        },
        required: ["latitude", "longitude"]
    }
};

// --- SATELLITE & CORE TOOLS ---

const fetchSatelliteImageryTool: FunctionDeclaration = {
  name: "fetch_satellite_imagery",
  description: "Fetch technical satellite analysis from Copernicus Data Space (Sentinel-1 SAR, Sentinel-2 Optical, Sentinel-3 Thermal). Essential for regional monitoring and broad-scale NDVI.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      bbox: { 
        type: Type.ARRAY, 
        items: { type: Type.NUMBER }, 
        description: "Bounding box coordinates: [minLongitude, minLatitude, maxLongitude, maxLatitude]" 
      },
      collection: { 
        type: Type.STRING, 
        enum: ["SENTINEL2", "SENTINEL1", "SENTINEL3", "LANDSAT"], 
        default: "SENTINEL2",
        description: "Copernicus data collection to query."
      },
      startDate: { type: Type.STRING, description: "Start date for imagery search (YYYY-MM-DD)." },
      endDate: { type: Type.STRING, description: "End date for imagery search (YYYY-MM-DD)." },
      cloudCover: { type: Type.NUMBER, default: 20 },
      evalscript: { type: Type.STRING }
    },
    required: ["bbox", "startDate", "endDate"]
  }
};

const fetchPlanetImageryTool: FunctionDeclaration = {
    name: "fetch_planet_imagery",
    description: "Fetch ultra-high-resolution satellite imagery via Planet Labs Subscriptions API. Supports SkySat (50cm) and PlanetScope (3m). Uses the 'Clip', 'Band Math', 'Composite', and 'File Format' tools from the Planet Toolchain.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING },
            coordinates: { type: Type.ARRAY, items: { type: Type.NUMBER } },
            source: { type: Type.STRING, enum: ["planetscope", "skysat"], default: "planetscope" },
            startDate: { type: Type.STRING },
            cloudCover: { type: Type.NUMBER, default: 20 },
            spectralBands: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["coordinates", "startDate"]
    }
};

const fetchPerformanceBenchmarkTool: FunctionDeclaration = {
    name: "fetch_performance_benchmark",
    description: "Compare current solar park performance against regional averages and top performers (PR, Specific Yield).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            parkId: { type: Type.STRING },
            region: { type: Type.STRING }
        },
        required: ["parkId"]
    }
};

const analyzePredictiveFailureTool: FunctionDeclaration = {
    name: "analyze_predictive_failure",
    description: "Run LSTM (Long Short-Term Memory) models on telemetry to predict component failures (Inverters, Strings).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            parkId: { type: Type.STRING },
            horizonDays: { type: Type.NUMBER, description: "Prediction horizon in days" }
        },
        required: ["parkId"]
    }
};

const executeEnergyTradeTool: FunctionDeclaration = {
    name: "execute_energy_trade",
    description: "Execute or simulate an algorithmic energy trade on the OPCOM/Day-Ahead market based on forecast.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            action: { type: Type.STRING, enum: ["BUY", "SELL", "HOLD"] },
            volumeMwh: { type: Type.NUMBER },
            priceLimit: { type: Type.NUMBER }
        },
        required: ["action", "volumeMwh"]
    }
};

const planAgrivoltaicsTool: FunctionDeclaration = {
    name: "plan_agrivoltaics",
    description: "Generate an agricultural compatibility report for a solar site (Crop suitability, shading analysis).",
    parameters: {
        type: Type.OBJECT,
        properties: {
            location: { type: Type.STRING },
            areaHectares: { type: Type.NUMBER },
            cropType: { type: Type.STRING }
        },
        required: ["location"]
    }
};

const analyzePanelDnaTool: FunctionDeclaration = {
    name: "analyze_panel_dna",
    description: "Perform ultra-high precision (50cm) SkySat analysis to detect micro-cracks or specific panel DNA anomalies.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            parkId: { type: Type.STRING },
            coordinates: { type: Type.ARRAY, items: { type: Type.NUMBER } }
        },
        required: ["coordinates"]
    }
};

const estimateSolarProductionTool: FunctionDeclaration = {
  name: "estimate_solar_production",
  description: "Calculate expected solar energy production (kWh/MWh) based on specific system configuration. Useful for ROI estimation.",
  parameters: {
    type: Type.OBJECT,
    properties: { 
        latitude: { type: Type.NUMBER }, 
        longitude: { type: Type.NUMBER }, 
        kwp: { type: Type.NUMBER, description: "System installed capacity in kWp" },
        tilt: { type: Type.NUMBER, description: "Panel tilt angle (0-90)" },
        azimuth: { type: Type.NUMBER, description: "Panel azimuth (-180 to 180, 0 = South)" }
    },
    required: ["latitude", "longitude", "kwp"]
  }
};

const fetchBiodiversityReportTool: FunctionDeclaration = {
  name: "fetch_biodiversity_report",
  description: "Species observations via GBIF. Used for ESG and Agrivoltaics environmental impact studies.",
  parameters: {
    type: Type.OBJECT,
    properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER }, radius: { type: Type.NUMBER } },
    required: ["lat", "lng"]
  }
};

const calculateCarbonImpactTool: FunctionDeclaration = {
  name: "calculate_carbon_impact",
  description: "ESG footprint analysis for carbon avoidance reporting.",
  parameters: { type: Type.OBJECT, properties: { mwh: { type: Type.NUMBER }, geometry: { type: Type.OBJECT } }, required: ["mwh"] }
};

const reverseGeocodeTool: FunctionDeclaration = {
  name: "reverse_geocode",
  description: "Convert GPS coordinates to physical address via Maps.co API.",
  parameters: { type: Type.OBJECT, properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER } }, required: ["lat", "lng"] }
};

const searchPlacesTool: FunctionDeclaration = {
  name: "searchPlaces",
  description: "Search for a physical location via Google Maps backend.",
  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] },
};

const searchSolarParksTool: FunctionDeclaration = {
  name: "searchSolarParks",
  description: "Search internal Helios SCADA database for operational solar assets in Romania.",
  parameters: { type: Type.OBJECT, properties: { query: { type: Type.STRING } }, required: ["query"] },
};

const runSimulationTool: FunctionDeclaration = {
  name: "runSimulation",
  description: "Trigger a remote PVsyst CLI simulation job for advanced energy modeling.",
  parameters: {
    type: Type.OBJECT,
    properties: { placeId: { type: Type.STRING }, systemSizeKw: { type: Type.NUMBER } },
    required: ["placeId", "systemSizeKw"],
  },
};

// --- NEW TOOLS FROM PDF ARCHITECTURE ---

const fetchNdviTimeseriesTool: FunctionDeclaration = {
    name: "fetch_ndvi_timeseries",
    description: "Get historical NDVI (Normalized Difference Vegetation Index) data for a specific park to analyze long-term vegetation health and soiling.",
    parameters: {
        type: Type.OBJECT,
        properties: { parkId: { type: Type.STRING } },
        required: ["parkId"]
    }
};

const checkThermalStatusTool: FunctionDeclaration = {
    name: "check_thermal_status",
    description: "Check the latest LST (Land Surface Temperature) scan for thermal anomalies or hot spots on the panels.",
    parameters: {
        type: Type.OBJECT,
        properties: { parkId: { type: Type.STRING } },
        required: ["parkId"]
    }
};

// --- OPEN-METEO IMPLEMENTATION HELPERS ---

const fetchOpenMeteo = async (baseUrl: string, params: any) => {
    const url = new URL(baseUrl);
    Object.keys(params).forEach(key => {
        if (params[key] !== undefined && params[key] !== null) {
            const val = Array.isArray(params[key]) ? params[key].join(',') : params[key];
            url.searchParams.append(key, val);
        }
    });
    const response = await fetch(url.toString());
    if (!response.ok) throw new Error(`Open-Meteo API Error: ${response.statusText}`);
    return await response.json();
};

export const fetchWeatherForecast = async (params: any) => {
    // Ensure standard params
    const p = {
        latitude: params.latitude || params.lat,
        longitude: params.longitude || params.lng,
        ...params
    };
    return fetchOpenMeteo('https://api.open-meteo.com/v1/forecast', p);
};

const fetchHistoricalWeather = async (params: any) => {
    return fetchOpenMeteo('https://archive-api.open-meteo.com/v1/archive', params);
};

const fetchAirQuality = async (params: any) => {
    return fetchOpenMeteo('https://air-quality-api.open-meteo.com/v1/air-quality', params);
};

const fetchGeocoding = async (params: any) => {
    return fetchOpenMeteo('https://geocoding-api.open-meteo.com/v1/search', params);
};

const fetchElevation = async (params: any) => {
    return fetchOpenMeteo('https://api.open-meteo.com/v1/elevation', params);
};


// --- SERVICE CLASS ---

export interface GeminiRequestConfig {
    isThinking?: boolean;
    isImageGen?: boolean;
    imageSize?: ImageSize;
    isImageEdit?: boolean;
    editContext?: { data: string, mimeType: string };
}

export class GeminiOrchestrator {
  private ai: GoogleGenAI;
  private history: any[] = [];
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  async executeSpecialTool(name: string, args: any, lastImageContext?: string): Promise<any> {
     try {
       // --- OPEN-METEO SUITE ---
       if (name === 'fetch_weather_forecast') return { result: await fetchWeatherForecast(args) };
       
       if (name === 'fetch_solar_radiation_forecast') {
            return { result: await fetchWeatherForecast({
                ...args, 
                hourly: ["shortwave_radiation", "direct_radiation", "diffuse_radiation", "direct_normal_irradiance", "global_tilted_irradiance"],
                current: ["cloud_cover", "shortwave_radiation"]
            })};
       }

       if (name === 'fetch_15_minute_solar_data') {
           return { result: await fetchWeatherForecast({
               ...args,
               minutely_15: args.minutely_15 || ["shortwave_radiation", "direct_normal_irradiance", "global_tilted_irradiance"]
           })};
       }

       if (name === 'fetch_historical_weather') return { result: await fetchHistoricalWeather(args) };
       if (name === 'fetch_air_quality') return { result: await fetchAirQuality(args) };
       if (name === 'search_location') return { result: await fetchGeocoding(args) };
       if (name === 'get_elevation') return { result: await fetchElevation(args) };


       // --- CORE HELIOS TOOLS ---
       if (name === 'generate_technical_site_report') {
           const ai = new GoogleGenAI({ apiKey: this.apiKey });
           const reportResponse = await ai.models.generateContent({
               model: GEMINI_FLASH_MODEL_ID,
               contents: `As a Senior Solar Architect, synthesize this technical telemetry: ${args.telemetrySummary}. Site: ${args.siteName}. Tone: ${args.tone}. Focus on KPIs (PR, NDVI, Soiling Losses). Use Markdown.`,
               config: { systemInstruction: "You are the lead architect of Helios. Provide actionable, high-density technical insights." }
           });
           return { result: { report: reportResponse.text } };
       }

       // Planet Labs Premium Proxy
       if (name === 'fetch_planet_imagery') {
           const res = await fetchJson('/satellite/planet', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify(args)
           });
           return { result: res };
       }

       // Panel DNA (Wrapper for SkySat)
       if (name === 'analyze_panel_dna') {
           const res = await fetchJson('/satellite/planet', {
               method: 'POST',
               headers: {'Content-Type': 'application/json'},
               body: JSON.stringify({ ...args, source: 'skysat' })
           });
           return { result: res };
       }

       // Copernicus Satellite Integration Proxy
       if (name === 'fetch_satellite_imagery') {
         const { bbox, collection, startDate, endDate, cloudCover, evalscript } = args;
         const res = await fetchJson('/satellite/imagery', { 
           method: 'POST', 
           headers: {'Content-Type':'application/json'}, 
           body: JSON.stringify({ 
             bbox, 
             collection: collection || 'SENTINEL2', 
             startDate, 
             endDate,
             cloudCover,
             evalscript 
           }) 
         });
         return { result: res };
       }

       // Core Function Proxies
       if (name === 'estimate_solar_production') return { result: await fetchJson(`/solar/forecast?lat=${args.latitude}&lng=${args.longitude}&dec=${args.tilt || 35}&az=${args.azimuth || 0}&kwp=${args.kwp}`) };
       if (name === 'fetch_biodiversity_report') return { result: await fetchJson(`/biodiversity/nearby?lat=${args.lat}&lng=${args.lng}&radius=${args.radius || 5000}`) };
       if (name === 'calculate_carbon_impact') return { result: await fetchJson('/esg/carbon-impact', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args) }) };
       if (name === 'reverse_geocode') return { result: await fetchJson(`/geo/reverse?lat=${args.lat}&lng=${args.lng}`) };
       
       // New Advanced Analytics Tools
       if (name === 'fetch_performance_benchmark') return { result: await fetchJson(`/analytics/benchmark?parkId=${args.parkId}&region=${args.region || ''}`) };
       if (name === 'analyze_predictive_failure') return { result: await fetchJson('/analytics/failure-prediction', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args) }) };
       if (name === 'execute_energy_trade') return { result: await fetchJson('/market/trade', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args) }) };
       if (name === 'plan_agrivoltaics') return { result: await fetchJson(`/geo/agrivoltaics?location=${args.location}&cropType=${args.cropType || ''}`) };

       // Infrastructure Tools
       if (name === 'searchPlaces') return { result: { places: await searchPlaces(args.query) } };
       if (name === 'searchSolarParks') return { result: { parks: searchParks(args.query), count: searchParks(args.query).length } };
       if (name === 'runSimulation') return { result: await createSimulationJob(args.placeId, args.systemSizeKw) };

       // New PDF Architecture Tools
       if (name === 'fetch_ndvi_timeseries') return { result: await fetchJson(`/monitoring/ndvi/timeseries/${args.parkId}`) };
       if (name === 'check_thermal_status') return { result: await fetchJson(`/monitoring/thermal/status/${args.parkId}`) };


     } catch (e: any) { return { error: e.message }; }
     return { error: "Unknown tool mapping" };
  }

  async sendMessage(
    text: string, 
    attachment?: Attachment, 
    onToolCall?: any, 
    lastImageContext?: string, 
    language: Language = 'ro', 
    preferredModel: string = DEFAULT_MODEL_ID,
    config: GeminiRequestConfig = {},
    onStreamUpdate?: (text: string) => void
  ): Promise<any> {
    
    // --- 1. IMAGE GENERATION (Nano Banana Pro) ---
    if (config.isImageGen && config.imageSize) {
        const response = await withRetry<GenerateContentResponse>(() => this.ai.models.generateContent({
            model: GEMINI_IMAGE_GEN_MODEL_ID,
            contents: { parts: [{ text }] },
            config: {
                imageConfig: {
                    imageSize: config.imageSize as any,
                    aspectRatio: "1:1" // Default
                }
            }
        }));

        // Find image in response
        let imageUrl = undefined;
        let outputText = "Image generated successfully.";
        
        for (const candidate of response.candidates || []) {
            for (const part of candidate.content.parts) {
                if (part.inlineData) {
                    imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                } else if (part.text) {
                    outputText = part.text;
                }
            }
        }
        
        return { text: outputText, generatedImage: imageUrl };
    }

    // --- 2. IMAGE EDITING (Nano Banana) ---
    if (config.isImageEdit && config.editContext) {
        const response = await withRetry<GenerateContentResponse>(() => this.ai.models.generateContent({
            model: GEMINI_IMAGE_EDIT_MODEL_ID,
            contents: {
                parts: [
                    { inlineData: { mimeType: config.editContext!.mimeType, data: config.editContext!.data } },
                    { text }
                ]
            }
        }));

        let imageUrl = undefined;
        let outputText = "Image edited successfully.";
        
        for (const candidate of response.candidates || []) {
             for (const part of candidate.content.parts) {
                 if (part.inlineData) {
                     imageUrl = `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
                 } else if (part.text) {
                     outputText = part.text;
                 }
             }
        }
        return { text: outputText, generatedImage: imageUrl };
    }

    // --- 3. STANDARD CHAT & ANALYSIS (STREAMING) ---
    
    // Determine Model and Config
    let effectiveModelId = preferredModel;
    let effectiveConfig: any = {
        systemInstruction: language === 'ro' ? SYSTEM_INSTRUCTION_RO : SYSTEM_INSTRUCTION_EN,
    };

    // Force Pro Model for Analysis or Thinking
    if (attachment || config.isThinking) {
        effectiveModelId = GEMINI_PRO_MODEL_ID;
    }

    // Thinking Config (Gemini 3 Pro Only)
    if (config.isThinking) {
        effectiveModelId = GEMINI_PRO_MODEL_ID; // Enforce Pro
        effectiveConfig.thinkingConfig = { thinkingBudget: 32768 }; // Max Thinking Budget
        // CRITICAL: Max Output Tokens must NOT be set when Thinking is active
        if (effectiveConfig.maxOutputTokens) delete effectiveConfig.maxOutputTokens;
    }

    // Attach Tools (Only for standard chat, not image gen)
    effectiveConfig.tools = [{ 
      functionDeclarations: [
        // Open-Meteo Suite
        fetchWeatherForecastTool, fetchSolarRadiationForecastTool, fetch15MinuteSolarDataTool,
        fetchHistoricalWeatherTool, fetchAirQualityTool, searchLocationTool, getElevationTool,
        
        // Helios Core
        generateSiteReportTool, fetchPlanetImageryTool, fetchSatelliteImageryTool, 
        estimateSolarProductionTool, fetchBiodiversityReportTool, calculateCarbonImpactTool, 
        reverseGeocodeTool, searchPlacesTool, searchSolarParksTool, 
        runSimulationTool, fetchPerformanceBenchmarkTool, analyzePredictiveFailureTool, executeEnergyTradeTool,
        planAgrivoltaicsTool, analyzePanelDnaTool,
        
        // New PDF Architecture Tools
        fetchNdviTimeseriesTool, checkThermalStatusTool
      ] 
    }];

    const userParts: any[] = [{ text }];
    if (attachment) userParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });
    
    // Push user message to history
    this.history.push({ role: 'user', parts: userParts });

    let finalGeneratedText = '';
    let finalExtractedImage: string | undefined = undefined;
    let finalGroundingSources: any[] = [];
    
    // Recursive loop to handle multiple tool turns
    let keepGoing = true;
    while (keepGoing) {
        keepGoing = false; // Assume we stop unless we find a function call
        
        // Execute stream. Note: stream is iterable directly.
        const stream = await withRetry(() => this.ai.models.generateContentStream({ 
            model: effectiveModelId, 
            contents: this.history, 
            config: effectiveConfig 
        })) as any;

        const rawPartsFromStream: any[] = [];

        // Iterate through the stream for UI updates and accumulating parts
        for await (const chunk of stream) {
            // 1. Text Update (Streaming to UI)
            // Manual extraction to avoid SDK warnings about FunctionCall parts in .text
            let chunkText = '';
            const candidate = chunk.candidates?.[0];
            
            if (candidate?.content?.parts) {
                for (const part of candidate.content.parts) {
                    if (part.text) {
                        chunkText += part.text;
                    }
                }
            }

            if (chunkText) {
                finalGeneratedText += chunkText; // Aggregate for final result
                if (onStreamUpdate) onStreamUpdate(finalGeneratedText);
            }
            
            // 2. Capture Grounding Metadata (if any)
            if (candidate?.groundingMetadata?.groundingChunks) {
                finalGroundingSources = candidate.groundingMetadata.groundingChunks.map((chunk: any) => ({
                    title: chunk.web?.title || chunk.maps?.title,
                    uri: chunk.web?.uri || chunk.maps?.uri,
                    type: chunk.web ? 'web' : 'map'
                }));
            }

            // 3. Collect Raw Parts (Important for thought signatures)
            if (candidate?.content?.parts) {
                rawPartsFromStream.push(...candidate.content.parts);
            }
        }

        // --- RECONSTRUCT HISTORY WITH THOUGHT SIGNATURES ---
        // We merge consecutive text parts to reduce noise, but preserve thought and functionCall parts as is.
        const mergedParts: any[] = [];
        let currentTextPart: any = null;

        for (const part of rawPartsFromStream) {
            if (part.text && !part.thought) { // Standard text part
                if (currentTextPart) {
                    currentTextPart.text += part.text;
                } else {
                    currentTextPart = { text: part.text };
                    mergedParts.push(currentTextPart);
                }
            } else {
                // Thought part or FunctionCall part
                // Reset currentTextPart because this is a break in the text flow
                currentTextPart = null; 
                mergedParts.push(part);
            }
        }

        // Push Model Turn to History
        this.history.push({ role: 'model', parts: mergedParts });

        // Check for function calls in the reconstructed parts
        // Note: Function calls are parts with `functionCall` property
        const functionCalls = mergedParts.filter(p => p.functionCall).map(p => p.functionCall);

        // Process Function Calls if any
        if (functionCalls.length > 0) {
            const functionResponses = [];
            for (const fc of functionCalls) {
                if (onToolCall) onToolCall(fc.name, fc.args);
                
                const sr = await this.executeSpecialTool(fc.name, fc.args, lastImageContext);
                
                if (sr.result?.visualUrl) {
                    finalExtractedImage = sr.result.visualUrl;
                }

                functionResponses.push({ 
                    functionResponse: { 
                        name: fc.name, 
                        response: { result: sr.result || { error: sr.error } } 
                    } 
                });
            }
            
            // Push Tool Responses (User role in API v1beta/v1) to history
            this.history.push({ role: 'user', parts: functionResponses });
            
            // Continue the loop to get the model's next response (interpretation of tool results)
            keepGoing = true;
            // Add a separator for the UI stream if desired, or just continue appending
            finalGeneratedText += "\n"; 
        }
    }

    return { 
      text: finalGeneratedText, 
      generatedImage: finalExtractedImage,
      groundingSources: finalGroundingSources
    };
  }
}
