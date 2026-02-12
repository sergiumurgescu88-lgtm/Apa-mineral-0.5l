
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

// --- NEW TYPES FOR FEATURES 17-27 ---

export interface FireRiskReport {
  riskLevel: 'LOW' | 'MODERATE' | 'HIGH' | 'EXTREME';
  temperature: number;
  humidity: number;
  windSpeed: number;
  soilMoisture: number;
  recommendation: string;
}

export interface CleaningSchedule {
  parkId: string;
  rainForecastNext3Days: number; // mm
  soilingLevel: number; // %
  recommendation: 'CLEAN_NOW' | 'WAIT_FOR_RAIN' | 'MONITOR';
  estimatedCostSaved: number;
}

export interface RobotDispatch {
  missionId: string;
  dronesDeployed: number;
  groundRovers: number;
  estimatedDuration: string;
  status: 'DISPATCHED' | 'IN_PROGRESS';
}

export interface GridStatus {
  mode: 'GRID_TIED' | 'ISLANDING' | 'BLACKOUT_SUPPORT';
  activePower: number;
  batteryLevel: number;
  localHouseholdsPowered: number;
}
