
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

export interface User {
  id: string;
  google_id?: string;
  email: string;
  name: string;
  company?: string;
  role: 'admin' | 'viewer' | 'engineer';
  avatar?: string;
  token?: string;
  created_at?: string;
}

export interface LoginLog {
  id: number;
  user_name: string;
  email: string;
  login_time: string;
  ip_address: string;
  user_agent: string;
}

export interface SavedChat {
  id: string;
  title: string;
  date: string;
  preview: string;
  messageCount: number;
}

export interface ToolCallLog {
  toolName: string;
  args: any;
  result: any;
  timestamp: number;
}

export type ImageSize = '1K' | '2K' | '4K';
export type Language = 'ro' | 'en';

/**
 * SolarPark represents a physical solar asset in the system.
 */
export interface SolarPark {
  id: string;
  name: string;
  county: string;
  region?: string;
  capacityMw: number;
  operator: string;
  status: string;
  location: Coordinates;
  healthScore?: number;
  dailyRevenueEur?: number;
  co2AvoidedTons?: number;
  technicalDetails?: string;
  panelsCount?: number;
  commissionedDate?: string;
  investment?: string;
}

/**
 * Place represents a geographical location searched via Maps services.
 */
export interface Place {
  id: string;
  name: string;
  address: string;
  location: Coordinates;
  type: string;
  imageUrl: string;
}

/**
 * RoofAnnotation represents computer vision detection results on a roof image.
 */
export interface RoofAnnotation {
  id: string;
  type: string;
  points: Coordinates[];
  area: number;
}

/**
 * SimulationJob tracks the status and results of a PVsyst CLI simulation.
 */
export interface SimulationJob {
  id: string;
  placeId: string;
  status: SimulationStatus;
  progress: number;
  logs: string[];
  config?: {
    project: string;
    variant: string;
    systemSize: number;
    tilt?: number;
    azimuth?: number;
    modulePower?: number;
  };
  results?: {
    annualProduction: number;
    performanceRatio: number;
    specificYield: number;
  };
  createdAt: string;
}

/**
 * PVsystConfig stores the local environment paths for the CLI execution.
 */
export interface PVsystConfig {
  cliPath: string;
  workspacePath: string;
}

/**
 * PVsystProject represents a .PRJ file found in the workspace.
 */
export interface PVsystProject {
  name: string;
  fileSize: string;
  lastModified: string;
}

/**
 * Attachment represents a file (image/pdf) sent to the AI.
 */
export interface Attachment {
  name: string;
  mimeType: string;
  data: string; // Base64 encoded data
}

/**
 * GroundingSource represents a verified source used by Gemini for a response.
 */
export interface GroundingSource {
  title: string;
  uri: string;
  type: 'web' | 'map';
}

/**
 * Message represents an individual turn in a chat conversation.
 */
export interface Message {
  id: string;
  role: 'user' | 'model' | 'system';
  content: string;
  timestamp: number;
  attachment?: Attachment;
  image?: string;
  groundingSources?: GroundingSource[];
}

/**
 * SolarForecast represents meteorological data for yield prediction.
 */
export interface SolarForecast {
  current?: {
    temperature_2m: number;
    shortwave_radiation: number;
    cloud_cover: number;
    wind_speed_10m: number;
    relative_humidity_2m: number;
  };
}
