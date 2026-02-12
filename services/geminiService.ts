
import { GoogleGenAI, Type, FunctionDeclaration, FunctionCall } from "@google/genai";
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
                        e.status === 429;

    if (retries > 0 && isRateLimit) {
      const waitTime = baseDelay * (3 - retries); 
      console.warn(`[Gemini] Rate limit hit (429). Retrying in ${waitTime}ms... (${retries} retries left)`);
      await delay(waitTime);
      return withRetry(fn, retries - 1, baseDelay);
    }
    throw e;
  }
}

// --- API Helpers for New Features ---

const BACKEND = 'http://localhost:3001/api';

const fetchJson = async (endpoint: string, options: any = {}) => {
    try {
        const res = await fetch(`${BACKEND}${endpoint}`, options);
        return await res.json();
    } catch (e: any) {
        return { error: `Backend connection failed: ${e.message}` };
    }
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
    const cleanBase64 = base64Image.replace(/^data:image\/(png|jpeg|jpg);base64,/, "");
    const response = await ai.models.generateContent({
      model: 'gemini-2.5-flash-image',
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
  description: "Analyze roof image for PV potential.",
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
  description: "Generate image with Nano Banana Pro.",
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
  description: "Edit uploaded image with Nano Banana.",
  parameters: {
    type: Type.OBJECT,
    properties: { prompt: { type: Type.STRING } },
    required: ["prompt"],
  },
};

// --- NEW TOOLS FOR FEATURES 17-27 ---

const checkRiskTool: FunctionDeclaration = {
    name: "checkRisk",
    description: "Check Fire and Flood risk based on real-time weather/elevation at location. Also checks Cleaning schedule.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            lat: { type: Type.NUMBER },
            lng: { type: Type.NUMBER }
        },
        required: ["lat", "lng"]
    }
};

const dispatchRobotTool: FunctionDeclaration = {
    name: "dispatchRobot",
    description: "Dispatch autonomous drone or rover for inspection/repair.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            type: { type: Type.STRING, enum: ["drone", "rover"] },
            target: { type: Type.STRING, description: "Target park or sector ID" }
        },
        required: ["type", "target"]
    }
};

const verifyPanelTool: FunctionDeclaration = {
    name: "verifyPanel",
    description: "Verify solar panel authenticity using Panel DNA/Blockchain ledger.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            serials: { type: Type.ARRAY, items: { type: Type.STRING } }
        },
        required: ["serials"]
    }
};

const switchGridModeTool: FunctionDeclaration = {
    name: "switchGridMode",
    description: "Switch park grid connection mode (Island vs Grid-Tied) for blackouts.",
    parameters: {
        type: Type.OBJECT,
        properties: {
            mode: { type: Type.STRING, enum: ["GRID_TIED", "ISLANDING"] }
        },
        required: ["mode"]
    }
};

const getLeaderboardTool: FunctionDeclaration = {
    name: "getLeaderboard",
    description: "Get the current Gamification Leaderboard for solar parks.",
    parameters: { type: Type.OBJECT, properties: {} }
};

const optimizeSpectrumTool: FunctionDeclaration = {
    name: "optimizeSpectrum",
    description: "Calculate optimal spectral coatings based on latitude.",
    parameters: {
        type: Type.OBJECT,
        properties: { lat: { type: Type.NUMBER } },
        required: ["lat"]
    }
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

  async executeSpecialTool(name: string, args: any, lastImageContext?: string): Promise<{ result?: any, error?: string, sources?: GroundingSource[] }> {
     try {
       // --- Legacy Tools ---
       if (name === 'generateImage') {
         const img = await generateImageWithNanoBananaPro(this.apiKey, args.prompt, args.size || '1K');
         return { result: { imageUrl: img, message: "Image generated successfully." } };
       }
       if (name === 'editImage') {
         if (!lastImageContext) return { error: "No image found to edit." };
         const img = await editImageWithNanoBanana(this.apiKey, lastImageContext, args.prompt);
         return { result: { imageUrl: img, message: "Image edited successfully." } };
       }
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
       
       // --- NEW API TOOLS (17-27) ---
       if (name === 'checkRisk') {
           const data = await fetchJson(`/risk/analysis?lat=${args.lat}&lng=${args.lng}`);
           const flood = await fetchJson(`/risk/flood?lat=${args.lat}&lng=${args.lng}`);
           return { result: { fireAndCleaning: data, flood: flood } };
       }
       if (name === 'dispatchRobot') {
           const data = await fetchJson('/robots/dispatch', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
           return { result: data };
       }
       if (name === 'verifyPanel') {
           const data = await fetchJson('/supply-chain/verify', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
           return { result: data };
       }
       if (name === 'switchGridMode') {
           const data = await fetchJson('/grid/mode', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(args) });
           return { result: data };
       }
       if (name === 'optimizeSpectrum') {
           const data = await fetchJson(`/optimization/spectrum?lat=${args.lat}`);
           return { result: data };
       }
       if (name === 'getLeaderboard') {
           const data = await fetchJson('/gamification/leaderboard');
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
    
    try {
        return await this._sendMessageInternal(text, attachment, onToolCall, lastImageContext, language, preferredModel);
    } catch (error: any) {
        const isQuota = error.message?.includes('429') || error.message?.includes('RESOURCE_EXHAUSTED');
        if (isQuota && preferredModel === GEMINI_PRO_MODEL_ID) {
            console.warn("Pro model quota exhausted. Switching to Flash.");
            const fallback = await this._sendMessageInternal(text, attachment, onToolCall, lastImageContext, language, GEMINI_FLASH_MODEL_ID);
            fallback.text += "\n\n(Note: Switched to Flash model due to high traffic.)";
            return fallback;
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
          readUrlTool, analyzeRoofTool, runSimulationTool, checkLicenseTool, generateImageTool, editImageTool,
          // New
          checkRiskTool, dispatchRobotTool, verifyPanelTool, switchGridModeTool, getLeaderboardTool, optimizeSpectrumTool
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
                'checkRisk', 'dispatchRobot', 'verifyPanel', 'switchGridMode', 'optimizeSpectrum', 'getLeaderboard'
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
