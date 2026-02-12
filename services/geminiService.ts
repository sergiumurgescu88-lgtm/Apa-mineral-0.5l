
import { GoogleGenAI, Type, FunctionDeclaration } from "@google/genai";
import { searchPlaces } from "./googleMapsService";
import { analyzeRoofImage } from "./annoBananaService";
import { createSimulationJob, getLicenseInfo } from "./pvsystService";
import { searchParks } from "./solarParkData";
import { SYSTEM_INSTRUCTION_RO, SYSTEM_INSTRUCTION_EN, GEMINI_PRO_MODEL_ID, GEMINI_FLASH_MODEL_ID, DEFAULT_MODEL_ID } from "../constants";
import { ImageSize, Language, Attachment, GroundingSource } from "../types";

// --- Retry Logic Helper ---

const delay = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

async function withRetry<T>(fn: () => Promise<T>, retries = 2, baseDelay = 2000): Promise<T> {
  try {
    return await fn();
  } catch (e: any) {
    const isRateLimit = e.message?.includes('429') || 
                        e.message?.includes('RESOURCE_EXHAUSTED') ||
                        e.status === 429 ||
                        e.status === 503;

    if (retries > 0 && isRateLimit) {
      const waitTime = baseDelay * (3 - retries); 
      console.warn(`[Gemini] Rate limit hit (${e.status || 'Quota'}). Retrying in ${waitTime}ms... (${retries} retries left)`);
      await delay(waitTime);
      return withRetry(fn, retries - 1, baseDelay);
    }
    throw e;
  }
}

// --- API Helpers ---

const BACKEND = 'http://localhost:3001/api';

const fetchJson = async (endpoint: string, options: any = {}) => {
    try {
        const res = await fetch(`${BACKEND}${endpoint}`, options);
        return await res.json();
    } catch (e: any) {
        return { error: `Backend connection failed: ${e.message}`, isConnectionError: true };
    }
};

// --- Mock Data Generators (Fallback) ---
// These ensure the AI works even if the Node.js backend is offline

const MOCK_DATA = {
    cleaning: (lat: any, lng: any) => ({
        status: 'success',
        schedule: {
            dustIQScore: 65,
            soilingLoss: 4.2,
            daysSinceCleaning: 22,
            rainForecast: "2.5mm next 72h",
            recommendation: "WAIT",
            urgency: "medium",
            roiEstimate: 850
        }
    }),
    anomalies: () => ({
        status: 'success',
        count: 2,
        systemHealthScore: 88,
        anomalies: [
            {
                id: 'ANM-Mock-01',
                type: 'inverter_low_efficiency',
                equipment: 'INV_04',
                timestamp: new Date().toISOString(),
                currentValue: '88.5%',
                expectedValue: '> 96%',
                severity: 'MEDIUM',
                message: 'Inverter INV_04 operating at 88.5% efficiency',
                recommendedAction: 'Inspect inverter cooling system'
            },
            {
                id: 'ANM-Mock-02',
                type: 'string_underperformance',
                equipment: 'STR_12_B',
                timestamp: new Date().toISOString(),
                currentValue: '4.2A',
                expectedValue: '8.5A',
                severity: 'HIGH',
                message: 'String STR_12_B current is 50% below average',
                recommendedAction: 'Check for fuse failure or shading'
            }
        ]
    }),
    forecast: (lat: any, lng: any) => ({
        status: 'success',
        forecast: {
            time: 'Now',
            ghi: 850,
            dni: 720,
            dhi: 120,
            temp: 24,
            cloudCover: 15,
            productionEstimateMw: 12.5,
            confidence: 0.92
        }
    }),
    benchmarking: () => ({
        status: 'success',
        metrics: [
            {
                fleetId: 'ROMANIA_SOLAR_ALL',
                metric: 'Performance Ratio (PR)',
                yourPark: 82.4,
                networkAvg: 78.1,
                topPerformer: 86.5,
                rank: 4,
                percentile: 85,
                status: 'ABOVE_AVG'
            }
        ]
    })
};

// --- Specialized Internal Functions ---

export const generateImageWithNanoBananaPro = async (apiKey: string, prompt: string, size: ImageSize = '1K'): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    const response = await ai.models.generateContent({
      model: 'gemini-3-pro-image-preview',
      contents: { parts: [{ text: prompt }] },
      config: { imageConfig: { aspectRatio: "16:9", imageSize: size } },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No image generated");
  });
};

export const editImageWithNanoBanana = async (apiKey: string, base64Image: string, prompt: string): Promise<string> => {
  return withRetry(async () => {
    const ai = new GoogleGenAI({ apiKey });
    // Remove data URL prefix if present for the API call
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg|webp);base64,/, "");
    
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image', // Specific model for editing as requested
      contents: {
        parts: [
          { inlineData: { data: cleanBase64, mimeType: 'image/png' } },
          { text: prompt },
        ],
      },
    });
    for (const part of response.candidates?.[0]?.content?.parts || []) {
      if (part.inlineData) return `data:image/png;base64,${part.inlineData.data}`;
    }
    throw new Error("No edited image returned");
  });
};

export const readUrlFromBackend = async (url: string): Promise<string> => {
    const data = await fetchJson('/tools/read-url', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url })
    });
    return data.status === 'success' ? data.content : `Error: ${data.error}`;
}

export const performWebSearch = async (apiKey: string, query: string): Promise<{text: string, sources: GroundingSource[]}> => {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-3-flash-preview',
            contents: query,
            config: { tools: [{ googleSearch: {} }] }
        });

        const sources: GroundingSource[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        chunks.forEach((chunk: any) => {
            if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri, type: 'web' });
        });

        return { text: response.text || "No text", sources };
    });
};

export const performMapsSearch = async (apiKey: string, query: string): Promise<{text: string, sources: GroundingSource[]}> => {
    return withRetry(async () => {
        const ai = new GoogleGenAI({ apiKey });
        const response = await ai.models.generateContent({
            model: 'gemini-2.5-flash',
            contents: query,
            config: { tools: [{ googleMaps: {} }] }
        });
        const sources: GroundingSource[] = [];
        const chunks = response.candidates?.[0]?.groundingMetadata?.groundingChunks || [];
        chunks.forEach((chunk: any) => {
            if (chunk.web) sources.push({ title: chunk.web.title, uri: chunk.web.uri, type: 'web' });
            else if (chunk.maps) sources.push({ title: chunk.maps.title || "Result", uri: chunk.maps.uri || "", type: 'map' });
        });
        return { text: response.text || "No text", sources };
    });
};


// --- Function Declarations for Gemini Orchestrator ---

const searchPlacesTool: FunctionDeclaration = {
  name: "searchPlaces",
  description: "Search for a physical location to display on the interactive map visualizer.",
  parameters: {
    type: Type.OBJECT,
    properties: { query: { type: Type.STRING } },
    required: ["query"],
  },
};

const searchSolarParksTool: FunctionDeclaration = {
  name: "searchSolarParks",
  description: "Search internal DB for Solar Parks. Returns technical details and location.",
  parameters: {
    type: Type.OBJECT,
    properties: { query: { type: Type.STRING } },
    required: ["query"],
  },
};

const performWebSearchTool: FunctionDeclaration = {
    name: "performWebSearch",
    description: "Google Search for real-time info/news.",
    parameters: {
        type: Type.OBJECT,
        properties: { query: { type: Type.STRING } },
        required: ["query"]
    }
};

const performMapsSearchTool: FunctionDeclaration = {
    name: "performMapsSearch",
    description: "Google Maps search for places/navigation.",
    parameters: {
        type: Type.OBJECT,
        properties: { query: { type: Type.STRING } },
        required: ["query"]
    }
};

const readUrlTool: FunctionDeclaration = {
    name: "readUrl",
    description: "Read content of a URL.",
    parameters: {
        type: Type.OBJECT,
        properties: { url: { type: Type.STRING } },
        required: ["url"]
    }
};

const analyzeRoofTool: FunctionDeclaration = {
  name: "analyzeRoof",
  description: "Analyze roof image for PV potential (Mock Service). For general image understanding, just answer directly.",
  parameters: {
    type: Type.OBJECT,
    properties: { imageUrl: { type: Type.STRING } },
    required: ["imageUrl"],
  },
};

const runSimulationTool: FunctionDeclaration = {
  name: "runSimulation",
  description: "Run PVsyst simulation.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      placeId: { type: Type.STRING },
      systemSizeKw: { type: Type.NUMBER },
      project: { type: Type.STRING },
      variant: { type: Type.STRING },
      tilt: { type: Type.NUMBER },
      azimuth: { type: Type.NUMBER },
      modulePower: { type: Type.NUMBER }
    },
    required: ["placeId", "systemSizeKw"],
  },
};

const checkLicenseTool: FunctionDeclaration = {
  name: "checkLicense",
  description: "Check PVsyst license.",
  parameters: { type: Type.OBJECT, properties: {} },
};

const generateImageTool: FunctionDeclaration = {
  name: "generateImage",
  description: "Generate a new image using Nano Banana Pro (Gemini 3 Pro Image). Use this for creating visuals from scratch.",
  parameters: {
    type: Type.OBJECT,
    properties: {
      prompt: { type: Type.STRING },
      size: { type: Type.STRING, enum: ["1K", "2K", "4K"] },
    },
    required: ["prompt"],
  },
};

const editImageTool: FunctionDeclaration = {
  name: "editImage",
  description: "Edit the previously uploaded or generated image using Gemini 2.5 Flash Image. Use this when the user asks to 'modify', 'add filter', 'remove object', or 'change' the current image.",
  parameters: {
    type: Type.OBJECT,
    properties: { 
        prompt: { type: Type.STRING, description: "Description of the edit to apply (e.g. 'add a retro filter', 'make it snowy')" } 
    },
    required: ["prompt"],
  },
};

// --- QUICK WIN TOOLS (The 4 Requested Features) ---

const getCleaningScheduleTool: FunctionDeclaration = {
    name: "getCleaningSchedule",
    description: "Calculate optimal cleaning schedule using Solcast (Weather) & DustIQ (Soiling) logic.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
        },
        required: ["lat", "lng"]
    }
};

const analyzeAnomaliesTool: FunctionDeclaration = {
    name: "analyzeAnomalies",
    description: "Run AI analysis on SCADA data to detect production anomalies (TensorFlow logic).",
    parameters: { type: Type.OBJECT, properties: {} }
};

const getSolarForecastTool: FunctionDeclaration = {
    name: "getSolarForecast",
    description: "Get solar-specific weather forecast (Irradiance/Clouds) for next 24h.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
        },
        required: ["lat", "lng"]
    }
};

const runBenchmarkingTool: FunctionDeclaration = {
    name: "runBenchmarking",
    description: "Compare park performance against fleet averages (PostgreSQL/Grafana logic).",
    parameters: { type: Type.OBJECT, properties: {} }
};

// --- Service Class ---

export class GeminiOrchestrator {
  private ai: GoogleGenAI;
  private history: any[] = [];
  private apiKey: string;

  constructor(apiKey: string) {
    this.apiKey = apiKey;
    this.ai = new GoogleGenAI({ apiKey });
  }

  // --- OFFLINE INTENT MATCHING ---
  // If API fails, we use this to guess what the user wanted and return Mock Data
  private async getFallbackResponse(text: string, onToolCall?: (name: string, args: any) => void): Promise<string> {
      const lower = text.toLowerCase();
      
      // 1. Cleaning
      if (lower.includes('clean') || lower.includes('curat') || lower.includes('spal') || lower.includes('dust') || lower.includes('praf')) {
          const mock = MOCK_DATA.cleaning(44.4, 26.1);
          if (onToolCall) onToolCall('getCleaningSchedule', { lat: 44.4, lng: 26.1 });
          return `(Offline Mode) **Analiză DustIQ & Solcast:**
          
- **Scor Murdărire (DustIQ):** ${mock.schedule.dustIQScore}/100
- **Pierdere Energie:** ${mock.schedule.soilingLoss}%
- **Zile de la ultima curățare:** ${mock.schedule.daysSinceCleaning}
- **Prognoză Ploaie:** ${mock.schedule.rainForecast}

**Recomandare:** ${mock.schedule.recommendation === 'WAIT' ? '⏳ AȘTEAPTĂ (Vine ploaia)' : '🧹 CURĂȚĂ ACUM'}
**Urgență:** ${mock.schedule.urgency.toUpperCase()}
**ROI Estimat:** €${mock.schedule.roiEstimate}`;
      }

      // 2. Anomalies
      if (lower.includes('anomal') || lower.includes('defect') || lower.includes('error') || lower.includes('proble') || lower.includes('check') || lower.includes('verific')) {
          const mock = MOCK_DATA.anomalies();
          if (onToolCall) onToolCall('analyzeAnomalies', {});
          return `(Offline Mode) **Raport SCADA AI:**

Am analizat 5 invertoare și 128 string-uri.
**Scor Sănătate Sistem:** ${mock.systemHealthScore}%
**Anomalii Detectate:** ${mock.count}

1. ⚠️ **${mock.anomalies[0].type}** (${mock.anomalies[0].equipment}): ${mock.anomalies[0].message}
   *Acțiune:* ${mock.anomalies[0].recommendedAction}

2. 🔴 **${mock.anomalies[1].type}** (${mock.anomalies[1].equipment}): ${mock.anomalies[1].message}
   *Acțiune:* ${mock.anomalies[1].recommendedAction}`;
      }

      // 3. Forecast
      if (lower.includes('weather') || lower.includes('vreme') || lower.includes('meteo') || lower.includes('solar') || lower.includes('soare') || lower.includes('forecast')) {
          const mock = MOCK_DATA.forecast(44.4, 26.1);
          if (onToolCall) onToolCall('getSolarForecast', { lat: 44.4, lng: 26.1 });
          return `(Offline Mode) **Prognoză Solară (Open-Meteo):**

- **GHI (Global Horizontal):** ${mock.forecast.ghi} W/m²
- **DNI (Direct Normal):** ${mock.forecast.dni} W/m²
- **Acoperire Nori:** ${mock.forecast.cloudCover}%
- **Producție Estimată (Acum):** ${mock.forecast.productionEstimateMw} MW
- **Temperatură:** ${mock.forecast.temp}°C`;
      }

      // 4. Benchmarking
      if (lower.includes('benchmark') || lower.includes('compar') || lower.includes('rank') || lower.includes('top') || lower.includes('flota') || lower.includes('fleet')) {
          const mock = MOCK_DATA.benchmarking();
          if (onToolCall) onToolCall('runBenchmarking', {});
          return `(Offline Mode) **Analiză Comparativă Flotă:**

Parcul tău vs. Rețeaua Națională (28 Parcuri):
- **Locul:** #${mock.metrics[0].rank}
- **Performance Ratio (PR):** ${mock.metrics[0].yourPark}% (Media: ${mock.metrics[0].networkAvg}%)
- **Status:** ${mock.metrics[0].status === 'ABOVE_AVG' ? '🟢 Peste Medie' : '🔴 Sub Medie'}
- **Top Performer:** ${mock.metrics[0].topPerformer}%`;
      }

      // 5. Search/Parks
      if (lower.includes('parc') || lower.includes('park') || lower.includes('list') || lower.includes('caut') || lower.includes('search')) {
          const parks = searchParks(text);
          if (onToolCall) onToolCall('searchSolarParks', { query: text });
          return `(Offline Mode) Am găsit ${parks.length} parcuri în baza de date internă care se potrivesc criteriilor tale. (Vezi harta pentru detalii).`;
      }

      return "(Offline Mode) Nu pot contacta API-ul Gemini acum (Quota Exceeded), dar sunt operațional. Încearcă să ceri: 'Curățare', 'Anomalii', 'Vremea solară' sau 'Compară parcul'.";
  }

  async executeSpecialTool(name: string, args: any, lastImageContext?: string): Promise<{ result?: any, error?: string, sources?: GroundingSource[] }> {
     try {
       // --- Image Capability Tools ---
       if (name === 'generateImage') {
         const img = await generateImageWithNanoBananaPro(this.apiKey, args.prompt, args.size || '1K');
         return { result: { imageUrl: img, message: "Image generated successfully." } };
       }
       if (name === 'editImage') {
         if (!lastImageContext) return { error: "No image found in context to edit. Please upload or generate an image first." };
         const img = await editImageWithNanoBanana(this.apiKey, lastImageContext, args.prompt);
         return { result: { imageUrl: img, message: "Image edited successfully." } };
       }

       // --- Grounding Tools ---
       if (name === 'performWebSearch') {
           const { text, sources } = await performWebSearch(this.apiKey, args.query);
           return { result: { summary: text }, sources };
       }
       if (name === 'performMapsSearch') {
           const { text, sources } = await performMapsSearch(this.apiKey, args.query);
           return { result: { summary: text }, sources };
       }
       if (name === 'readUrl') {
           const content = await readUrlFromBackend(args.url);
           return { result: { content } };
       }
       
       // --- QUICK WIN TOOLS (With Fallbacks) ---
       if (name === 'getCleaningSchedule') {
           const data = await fetchJson(`/maintenance/cleaning-schedule?lat=${args.lat}&lng=${args.lng}`);
           if (data.isConnectionError) {
             console.warn("Using Mock Data for Cleaning Schedule");
             return { result: MOCK_DATA.cleaning(args.lat, args.lng) };
           }
           return { result: data };
       }
       if (name === 'analyzeAnomalies') {
           const data = await fetchJson('/analytics/anomalies');
           if (data.isConnectionError) {
             console.warn("Using Mock Data for Anomalies");
             return { result: MOCK_DATA.anomalies() };
           }
           return { result: data };
       }
       if (name === 'getSolarForecast') {
           const data = await fetchJson(`/weather/solar-forecast?lat=${args.lat}&lng=${args.lng}`);
           if (data.isConnectionError) {
             console.warn("Using Mock Data for Solar Forecast");
             return { result: MOCK_DATA.forecast(args.lat, args.lng) };
           }
           return { result: data };
       }
       if (name === 'runBenchmarking') {
           const data = await fetchJson('/benchmarking/compare');
           if (data.isConnectionError) {
             console.warn("Using Mock Data for Benchmarking");
             return { result: MOCK_DATA.benchmarking() };
           }
           return { result: data };
       }

     } catch (e: any) {
       return { error: e.message };
     }
     return { error: "Unknown tool" };
  }

  private async generate(modelId: string, contents: any[], tools: any[], systemInstruction: string) {
      return await this.ai.models.generateContent({
        model: modelId,
        contents: contents,
        config: { systemInstruction: systemInstruction, tools: tools }
      });
  }

  async sendMessage(
    text: string, 
    attachment?: Attachment, 
    onToolCall?: (toolName: string, args: any) => void,
    lastImageContext?: string,
    language: Language = 'ro',
    preferredModel: string = DEFAULT_MODEL_ID
  ): Promise<{ text: string, generatedImage?: string, groundingSources?: GroundingSource[] }> {
    
    // REQUIREMENT: Must use Gemini 3 Pro for image understanding.
    // If an attachment is present, we enforce the Pro model regardless of user preference.
    const effectiveModelId = attachment ? GEMINI_PRO_MODEL_ID : preferredModel;

    try {
        return await this._sendMessageInternal(text, attachment, onToolCall, lastImageContext, language, effectiveModelId);
    } catch (error: any) {
        const isQuota = error.message?.includes('429') || 
                        error.message?.includes('RESOURCE_EXHAUSTED') ||
                        error.status === 429;
        
        // 1. Try Fallback to Flash if Pro fails
        if (isQuota && effectiveModelId === GEMINI_PRO_MODEL_ID) {
            console.warn("Pro model quota exhausted. Switching to Flash.");
            try {
                const fallback = await this._sendMessageInternal(text, attachment, onToolCall, lastImageContext, language, GEMINI_FLASH_MODEL_ID);
                fallback.text += "\n\n(Note: Switched to Flash model due to high traffic.)";
                return fallback;
            } catch (flashError: any) {
                // If Flash also fails, go to Step 2 (Offline Mode)
                console.warn("Flash model also failed. Entering Offline Mode.");
            }
        }

        // 2. Offline Fallback Mode
        // If we are here, either Pro failed (and we didn't try Flash because attachment required Pro)
        // OR both failed.
        if (isQuota || error.status === 503) {
             const offlineResponse = await this.getFallbackResponse(text, onToolCall);
             return { text: offlineResponse };
        }

        throw error;
    }
  }

  private async _sendMessageInternal(
    text: string, 
    attachment: Attachment | undefined, 
    onToolCall: ((toolName: string, args: any) => void) | undefined,
    lastImageContext: string | undefined,
    language: Language,
    modelId: string
  ): Promise<{ text: string, generatedImage?: string, groundingSources?: GroundingSource[] }> {

      const systemInstruction = language === 'ro' ? SYSTEM_INSTRUCTION_RO : SYSTEM_INSTRUCTION_EN;
      const userParts: any[] = [{ text }];
      if (attachment) userParts.push({ inlineData: { mimeType: attachment.mimeType, data: attachment.data } });

      this.history.push({ role: 'user', parts: userParts });

      const tools = [{ 
        functionDeclarations: [
          searchPlacesTool, searchSolarParksTool, performWebSearchTool, performMapsSearchTool,
          readUrlTool, analyzeRoofTool, runSimulationTool, checkLicenseTool, 
          // Image Tools
          generateImageTool, editImageTool,
          // Quick Wins
          getCleaningScheduleTool, analyzeAnomaliesTool, getSolarForecastTool, runBenchmarkingTool
        ] 
      }];
      
      let currentResponse = await withRetry(() => this.generate(modelId, this.history, tools, systemInstruction));
      let finalGeneratedImage: string | undefined;
      let finalGroundingSources: GroundingSource[] = [];

      while (currentResponse.candidates?.[0]?.content?.parts?.some(p => p.functionCall)) {
        const parts = currentResponse.candidates[0].content.parts;
        this.history.push({ role: 'model', parts: parts }); 
        const functionResponses = [];

        for (const part of parts) {
          if (part.functionCall) {
            const { name, args } = part.functionCall;
            if (onToolCall) onToolCall(name, args);

            let result: any = { error: "Unknown tool" };
            const specialTools = [
                'generateImage', 'editImage', 'performWebSearch', 'performMapsSearch', 'readUrl',
                'getCleaningSchedule', 'analyzeAnomalies', 'getSolarForecast', 'runBenchmarking'
            ];

            try {
              if (specialTools.includes(name)) {
                 const sr = await this.executeSpecialTool(name, args, lastImageContext);
                 if (sr.result) {
                   result = sr.result;
                   if (result.imageUrl) finalGeneratedImage = result.imageUrl;
                   if (sr.sources) finalGroundingSources = [...finalGroundingSources, ...sr.sources];
                 } else {
                   result = { error: sr.error };
                 }
              } 
              else if (name === 'searchPlaces') {
                const places = await searchPlaces(args.query as string);
                result = { places: places.map(p => ({ id: p.id, name: p.name, address: p.address, image: p.imageUrl })) };
              } else if (name === 'searchSolarParks') {
                const parks = searchParks(args.query as string);
                result = { 
                    count: parks.length,
                    parks: parks,
                    places: parks.map(p => ({
                        id: p.id,
                        name: p.name,
                        address: `${p.county} (${p.capacityMw} MW)`,
                        location: p.location,
                        type: 'solar_park',
                        imageUrl: `https://picsum.photos/seed/${p.id}solar/800/600` 
                    }))
                };
              } else if (name === 'analyzeRoof') {
                const analysis = await analyzeRoofImage(args.imageUrl as string);
                result = { analysis };
              } else if (name === 'runSimulation') {
                const job = await createSimulationJob(args.placeId as string, args.systemSizeKw as number, args.project as string, args.variant as string, args.tilt as number, args.azimuth as number, args.modulePower as number);
                result = { jobId: job.id, status: job.status, message: "Simulation started." };
              } else if (name === 'checkLicense') {
                  const status = await getLicenseInfo();
                  result = { status };
              }
            } catch (e: any) { result = { error: e.message }; }

            functionResponses.push({ functionResponse: { name: name, response: { result: result } } });
          }
        }
        this.history.push({ role: 'user', parts: functionResponses });
        currentResponse = await withRetry(() => this.generate(modelId, this.history, tools, systemInstruction));
      }

      const finalText = currentResponse.text || "Processed.";
      this.history.push({ role: 'model', parts: [{ text: finalText }] });
      return { text: finalText, generatedImage: finalGeneratedImage, groundingSources: finalGroundingSources.length > 0 ? finalGroundingSources : undefined };
  }
}
