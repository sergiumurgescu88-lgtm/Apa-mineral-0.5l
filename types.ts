
export enum SimulationStatus {
  PENDING = 'PENDING',
  PROCESSING = 'PROCESSING',
  COMPLETED = 'COMPLETED',
  FAILED = 'FAILED'
}

export interface Coordinates {
  lat: number;
  lng: number;
}

export interface Place {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
  type: string;
  imageUrl?: string;
  roofArea?: number; // In square meters
}

// Enhanced Interface for Smart Helios Digital Twin
export interface SolarPark {
  id: string;
  name: string;
  county: string; // Județ
  region?: string;
  capacityMw: number;
  operator: string;
  commissionedDate?: string;
  status?: string;
  location: Coordinates;
  
  // New Digital Twin Metrics
  healthScore?: number; // 0-100
  dailyRevenueEur?: number; // Estimated
  panelsCount?: number;
  co2AvoidedTons?: number;
  predictionAlerts?: string[]; // e.g., "Inverter 4B failing in 12 days"
  
  technicalDetails?: string; 
  notes?: string;
  investment?: string;
}

export interface RoofAnnotation {
  id: string;
  type: 'panel' | 'obstacle' | 'roof_edge';
  points: Coordinates[];
  area: number;
}

export interface PVsystConfig {
  cliPath: string; // Path to PVsystCLI.exe
  workspacePath: string;
}

export interface PVsystProject {
  name: string;
  fileSize: string;
  lastModified: string;
}

export interface SimulationJob {
  id: string;
  placeId: string;
  status: SimulationStatus;
  progress: number; // 0-100
  logs: string[];
  config?: {
    project: string;
    variant: string;
    systemSize: number;
    // Enhanced parameters
    tilt?: number;
    azimuth?: number;
    modulePower?: number;
  };
  results?: {
    annualProduction: number; // MWh
    performanceRatio: number; // %
    specificYield: number; // kWh/kWp
    csvPath?: string;
  };
  createdAt: string;
}

export interface Attachment {
    name: string;
    mimeType: string;
    data: string; // Base64
}

export interface GroundingSource {
    title?: string;
    uri?: string;
    type: 'web' | 'map';
}

export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  isThinking?: boolean;
  image?: string; // Legacy Base64 string for backward compatibility
  attachment?: Attachment;
  groundingSources?: GroundingSource[];
}

export interface ToolCallLog {
  toolName: string;
  args: any;
  result: any;
  timestamp: number;
}

export type ImageSize = '1K' | '2K' | '4K';

export type Language = 'ro' | 'en';

// --- QUICK WIN TYPES (Features 1, 4, 5, 6) ---

export interface PlanetImagery {
    id: string;
    status: 'active' | 'completed' | 'failed';
    item_type: string;
    resolution: string; // e.g., "3m"
    source: "PlanetScope" | "SkySat";
    ndvi_mean: number;
    evi_mean?: number; // Enhanced Vegetation Index
    spectral_metrics?: {
        nir_mean: number;
        red_mean: number;
        blue_mean: number;
    };
    visual_url: string;
    acquisition_date: string;
}

export interface CleaningSchedule {
  parkId: string;
  dustIQScore: number;
  soilingLoss: number; // % lost generation
  daysSinceCleaning: number;
  rainForecast: string;
  recommendation: 'CLEAN_NOW' | 'WAIT' | 'SKIP';
  urgency: 'high' | 'medium' | 'low';
  roiEstimate: number; // EUR saved
}

export interface ProductionAnomaly {
  id: string;
  type: string;
  equipment: string;
  timestamp: string;
  currentValue: number | string;
  expectedValue: number | string;
  severity: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW';
  message: string;
  recommendedAction: string;
}

export interface SolarForecast {
  time: string;
  ghi: number; // Global Horizontal Irradiance W/m2
  dni: number; // Direct Normal Irradiance W/m2 (Essential for tracking)
  dhi: number; // Diffuse Horizontal Irradiance W/m2
  temp: number; // Celsius
  cloudCover: number; // %
  productionEstimateMw: number;
  confidence: number;
}

export interface BenchmarkData {
  fleetId: string;
  metric: string;
  yourPark: number;
  networkAvg: number;
  topPerformer: number;
  rank: number;
  percentile: number;
  status: 'ABOVE_AVG' | 'BELOW_AVG' | 'ELITE';
}