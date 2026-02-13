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
      cloudCover: { 
          type: Type.NUMBER, 
          description: "Maximum allowed cloud cover percentage (0-100). Default is 20.",
          default: 20
      },
      evalscript: { 
        type: Type.STRING, 
        description: "Javascript evalscript for custom pixel manipulation (e.g. NDVI or LAI calculation)." 
      }
    },
    required: ["bbox", "startDate", "endDate"]
  }
};

const fetchPlanetImageryTool: FunctionDeclaration = {
    name: "fetch_planet_imagery",
    description: "Fetch ultra-high-resolution satellite imagery via Planet Labs Subscriptions API. Supports SkySat (50cm) and PlanetScope (3m). Uses the 'Clip', 'Band Math', 'Composite', and 'File Format' tools from the Planet Toolchain for advanced processing.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            name: { type: Type.STRING, description: "Site name or subscription identifier." },
            coordinates: { 
                type: Type.ARRAY, 
                items: { type: Type.NUMBER }, 
                description: "Array of coordinates forming the asset boundary [lng, lat, ...]" 
            },
            source: { 
                type: Type.STRING, 
                enum: ["planetscope", "skysat"], 
                default: "planetscope",
                description: "Constellation source. Use 'skysat' for 0.5m resolution (precision tasks) or 'planetscope' for 3m (monitoring)."
            },
            startDate: { type: Type.STRING, description: "Acquisition start (YYYY-MM-DD)." },
            cloudCover: { 
                type: Type.NUMBER, 
                description: "Strict cloud filtering threshold (0-100). For SkySat precision tasks, use 5% or lower.", 
                default: 20
            },
            spectralBands: {
                type: Type.ARRAY,
                items: { type: Type.STRING, enum: ["NIR", "Red", "Blue", "Green", "RedEdge", "Thermal"] },
                description: "Specific bands to retrieve. For NDVI/EVI analysis, specify ['NIR', 'Red', 'Blue']."
            }
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

const fetchProductionForecastTool: FunctionDeclaration = {
  name: "fetch_production_forecast",
  description: "Predictive production via Forecast.Solar technical engine.",
  parameters: {
    type: Type.OBJECT,
    properties: { lat: { type: Type.NUMBER }, lng: { type: Type.NUMBER }, dec: { type: Type.NUMBER }, az: { type: Type.NUMBER }, kwp: { type: Type.NUMBER } },
    required: ["lat", "lng", "kwp"]
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
  parameters: { type: Type.OBJECT, properties: { mwh: { type: Type.NUMBER } }, required: ["mwh"] }
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

const fetchWeatherForecastTool: FunctionDeclaration = {
    name: "fetch_weather_forecast",
    description: "Fetch comprehensive meteorological data from Open-Meteo API.",
    parameters: { type: Type.OBJECT, properties: { latitude: { type: Type.NUMBER }, longitude: { type: Type.NUMBER } }, required: ["latitude", "longitude"] }
};

const fetchSolarRadiationForecastTool: FunctionDeclaration = {
    name: "fetch_solar_radiation_forecast",
    description: "Fetch high-precision solar radiation indices (DNI, GHI, GTI) for technical yield prediction.",
    parameters: { type: Type.OBJECT, properties: { latitude: { type: Type.NUMBER }, longitude: { type: Type.NUMBER } }, required: ["latitude", "longitude"] }
};

// --- TECHNICAL OPEN-METEO HANDLERS ---

export const fetchWeatherForecast = async (params: any) => {
  const baseUrl = 'https://api.open-meteo.com/v1/forecast';
  const url = new URL(baseUrl);
  url.searchParams.append('latitude', params.latitude.toString());
  url.searchParams.append('longitude', params.longitude.toString());
  if (params.hourly) url.searchParams.append('hourly', Array.isArray(params.hourly) ? params.hourly.join(',') : params.hourly);
  if (params.daily) url.searchParams.append('daily', Array.isArray(params.daily) ? params.daily.join(',') : params.daily);
  if (params.current) url.searchParams.append('current', Array.isArray(params.current) ? params.current.join(',') : params.current);
  if (params.minutely_15) url.searchParams.append('minutely_15', Array.isArray(params.minutely_15) ? params.minutely_15.join(',') : params.minutely_15);
  if (params.tilt !== undefined) url.searchParams.append('tilt', params.tilt.toString());
  if (params.azimuth !== undefined) url.searchParams.append('azimuth', params.azimuth.toString());
  if (params.timezone) url.searchParams.append('timezone', params.timezone || 'auto');
  if (params.forecast_days !== undefined) url.searchParams.append('forecast_days', params.forecast_days.toString());
  
  const response = await fetch(url.toString());
  if (!response.ok) {
      const errBody = await response.json().catch(() => ({}));
      throw new Error(`Open-Meteo Error ${response.status}: ${errBody.reason || 'Unknown error'}`);
  }
  return await response.json();
}

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
       // Gemini Technical Report Synthesis
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
       if (name === 'fetch_production_forecast') return { result: await fetchJson(`/solar/forecast?lat=${args.lat}&lng=${args.lng}&dec=${args.dec || 35}&az=${args.az || 0}&kwp=${args.kwp}`) };
       if (name === 'fetch_biodiversity_report') return { result: await fetchJson(`/biodiversity/nearby?lat=${args.lat}&lng=${args.lng}&radius=${args.radius || 5000}`) };
       if (name === 'calculate_carbon_impact') return { result: await fetchJson('/esg/carbon-impact', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args) }) };
       if (name === 'reverse_geocode') return { result: await fetchJson(`/geo/reverse?lat=${args.lat}&lng=${args.lng}`) };
       
       // New Advanced Analytics Tools
       if (name === 'fetch_performance_benchmark') return { result: await fetchJson(`/analytics/benchmark?parkId=${args.parkId}&region=${args.region || ''}`) };
       if (name === 'analyze_predictive_failure') return { result: await fetchJson('/analytics/failure-prediction', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args) }) };
       if (name === 'execute_energy_trade') return { result: await fetchJson('/market/trade', { method: 'POST', headers: {'Content-Type':'application/json'}, body: JSON.stringify(args) }) };
       if (name === 'plan_agrivoltaics') return { result: await fetchJson(`/geo/agrivoltaics?location=${args.location}&cropType=${args.cropType || ''}`) };

       // Infrastructure Tools
       if (name === 'fetch_weather_forecast') return { result: await fetchWeatherForecast(paramsFix(args)) };
       if (name === 'fetch_solar_radiation_forecast') return { result: await fetchWeatherForecast({...paramsFix(args), hourly: ["shortwave_radiation", "direct_normal_irradiance", "diffuse_radiation"]}) };
       if (name === 'searchPlaces') return { result: { places: await searchPlaces(args.query) } };
       if (name === 'searchSolarParks') return { result: { parks: searchParks(args.query), count: searchParks(args.query).length } };
       if (name === 'runSimulation') return { result: await createSimulationJob(args.placeId, args.systemSizeKw) };

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

    // Thinking Config
    if (config.isThinking) {
        effectiveConfig.thinkingConfig = { thinkingBudget: 32768 };
        // Important: Do not set maxOutputTokens when using thinking
    }

    // Attach Tools (Only for standard chat, not image gen)
    effectiveConfig.tools = [{ 
      functionDeclarations: [
        generateSiteReportTool, fetchPlanetImageryTool, fetchSatelliteImageryTool, 
        fetchProductionForecastTool, fetchBiodiversityReportTool, calculateCarbonImpactTool, 
        reverseGeocodeTool, searchPlacesTool, searchSolarParksTool, 
        runSimulationTool, fetchWeatherForecastTool, fetchSolarRadiationForecastTool,
        fetchPerformanceBenchmarkTool, analyzePredictiveFailureTool, executeEnergyTradeTool,
        planAgrivoltaicsTool, analyzePanelDnaTool
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

// Utility to ensure param consistency for Open-Meteo
function paramsFix(args: any) {
    return {
        latitude: args.latitude || args.lat,
        longitude: args.longitude || args.lng,
        ...args
    };
}