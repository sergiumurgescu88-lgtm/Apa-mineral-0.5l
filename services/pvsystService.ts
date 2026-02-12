import { SimulationJob, SimulationStatus, PVsystConfig, PVsystProject } from '../types';

// API URL - tries to connect to the local node server
const BACKEND_URL = 'http://localhost:3001/api';

let jobs: SimulationJob[] = [];
let backendAvailable = false;

// Check if backend is alive
const checkBackend = async () => {
  try {
    await fetch(`${BACKEND_URL}/pvsyst/license`, { method: 'GET' });
    backendAvailable = true;
    console.log('[PVsyst Service] Connected to Local Backend');
  } catch (e) {
    backendAvailable = false;
    console.log('[PVsyst Service] Backend offline, using Mock Mode');
  }
};
checkBackend();

export const updateConfig = async (config: PVsystConfig) => {
  if (backendAvailable) {
    await fetch(`${BACKEND_URL}/config`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(config)
    });
  }
};

export const getProjects = async (): Promise<PVsystProject[]> => {
  if (backendAvailable) {
    try {
        const res = await fetch(`${BACKEND_URL}/pvsyst/projects`);
        const data = await res.json();
        return data.projects || [];
    } catch (e) {
        console.warn("Failed to fetch projects");
    }
  }
  // Mock data
  return [
    { name: 'Bucharest_Mall_Roof_v1.PRJ', fileSize: '120 KB', lastModified: '2024-01-15' },
    { name: 'Bucharest_Mall_Roof_v2_Optimized.PRJ', fileSize: '125 KB', lastModified: '2024-01-18' },
    { name: 'Constanta_Solar_Park.PRJ', fileSize: '350 KB', lastModified: '2024-02-20' },
    { name: 'Project_Demo_01.PRJ', fileSize: '45 KB', lastModified: '2023-12-01' },
    { name: 'Timisoara_Warehouse.PRJ', fileSize: '85 KB', lastModified: '2024-03-10' },
    { name: 'Home_Installation_v2.PRJ', fileSize: '12 KB', lastModified: '2024-03-12' },
    { name: 'Brasov_Factory_Phase1.PRJ', fileSize: '210 KB', lastModified: '2024-03-15' },
  ];
};

export const getLicenseInfo = async (): Promise<string> => {
  if (backendAvailable) {
    try {
      const res = await fetch(`${BACKEND_URL}/pvsyst/license`);
      const data = await res.json();
      return data.output || data.error;
    } catch (e) {
      return "Error connecting to CLI.";
    }
  }
  return "MOCK MODE: License Active (Professional) - Expiration 2026-12-31";
};

export const activateLicense = async (key: string): Promise<string> => {
  if (backendAvailable) {
    try {
      const res = await fetch(`${BACKEND_URL}/pvsyst/license/activate`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ key })
      });
      const data = await res.json();
      return data.output || JSON.stringify(data.error);
    } catch (e: any) {
      return `Activation failed: ${e.message}`;
    }
  }
  return "MOCK MODE: License Activated successfully for key: " + key;
};

export const deactivateLicense = async (): Promise<string> => {
  if (backendAvailable) {
    try {
      const res = await fetch(`${BACKEND_URL}/pvsyst/license/deactivate`, { method: 'POST' });
      const data = await res.json();
      return data.output || JSON.stringify(data.error);
    } catch (e: any) {
      return `Deactivation failed: ${e.message}`;
    }
  }
  return "MOCK MODE: License Deactivated.";
};

export const convertMeteo = async (inputCsv: string, inputSit: string, outputMet: string): Promise<string> => {
  if (backendAvailable) {
    try {
      const res = await fetch(`${BACKEND_URL}/pvsyst/convert-meteo`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ inputCsv, inputSit, outputMet })
      });
      const data = await res.json();
      return data.output || JSON.stringify(data.details || data.error);
    } catch (e: any) {
      return `Conversion failed: ${e.message}`;
    }
  }
  // Mock response
  return `MOCK MODE: Successfully converted meteo data.\nInput: ${inputCsv}\nSite: ${inputSit}\nOutput: ${outputMet}`;
};

export const createSimulationJob = async (
    placeId: string, 
    systemSizeKw: number, 
    project?: string, 
    variant?: string,
    tilt?: number,
    azimuth?: number,
    modulePower?: number
): Promise<SimulationJob> => {
  console.log(`[PVsyst Service] Requesting simulation for: ${placeId}, Size: ${systemSizeKw}kWp, Tilt: ${tilt}, Azimuth: ${azimuth}`);
  
  const newJob: SimulationJob = {
    id: `job_${Date.now()}`,
    placeId,
    status: SimulationStatus.PENDING,
    progress: 0,
    logs: ['Initializing Job...'],
    config: {
      project: project || 'DEMO_PRJ',
      variant: variant || 'VC0',
      systemSize: systemSizeKw,
      tilt,
      azimuth,
      modulePower
    },
    createdAt: new Date().toISOString()
  };

  jobs.push(newJob);
  
  if (backendAvailable) {
    // Real Execution
    runRealSimulation(newJob);
  } else {
    // Mock Execution
    simulateMockProcess(newJob.id);
  }
  
  return newJob;
};

export const getJobStatus = (jobId: string): SimulationJob | undefined => {
  return jobs.find(j => j.id === jobId);
};

// --- Real Backend Execution ---
const runRealSimulation = async (job: SimulationJob) => {
   const jobIndex = jobs.findIndex(j => j.id === job.id);
   if (jobIndex === -1) return;

   const updateJob = (updates: Partial<SimulationJob>) => {
     jobs[jobIndex] = { ...jobs[jobIndex], ...updates };
   };

   updateJob({ status: SimulationStatus.PROCESSING, logs: [...job.logs, 'Sending command to CLI...'] });

   try {
     const res = await fetch(`${BACKEND_URL}/pvsyst/simulate`, {
       method: 'POST',
       headers: { 'Content-Type': 'application/json' },
       body: JSON.stringify({
         project: job.config?.project,
         variant: job.config?.variant,
         outputCsv: `results_${job.id}.csv`
       })
     });

     const data = await res.json();

     if (data.status === 'success') {
        updateJob({
          status: SimulationStatus.COMPLETED,
          progress: 100,
          logs: [...jobs[jobIndex].logs, 'CLI execution finished.', data.output],
          results: {
             annualProduction: 1500, // In real app, parse from CSV
             performanceRatio: 80,
             specificYield: 1400
          }
        });
     } else {
        throw new Error(data.details?.stderr || 'Unknown CLI error');
     }

   } catch (error: any) {
     updateJob({
       status: SimulationStatus.FAILED,
       logs: [...jobs[jobIndex].logs, `Error: ${error.message}`]
     });
   }
};

// --- Mock Execution (Legacy/Fallback) ---
const simulateMockProcess = (jobId: string) => {
  const jobIndex = jobs.findIndex(j => j.id === jobId);
  if (jobIndex === -1) return;

  const job = jobs[jobIndex];
  const updateJob = (updates: Partial<SimulationJob>) => {
    jobs[jobIndex] = { ...jobs[jobIndex], ...updates };
  };

  setTimeout(() => {
    const geoLogs = job.config?.tilt ? `Using Tilt: ${job.config.tilt}°, Azimuth: ${job.config.azimuth}°` : 'Using default geometry';
    updateJob({ status: SimulationStatus.PROCESSING, progress: 10, logs: [...jobs[jobIndex].logs, 'Mock: Importing horizon mask...', `Mock: ${geoLogs}`, 'Mock: Defining module array...'] });
    
    setTimeout(() => {
        updateJob({ progress: 45, logs: [...jobs[jobIndex].logs, 'Mock: Running hourly simulation steps...', 'Mock: Calculating shading losses...'] });
        
        setTimeout(() => {
            updateJob({ progress: 80, logs: [...jobs[jobIndex].logs, 'Mock: Aggregating results...', 'Mock: Generating PDF report...'] });
            
            setTimeout(() => {
                 updateJob({ 
                    status: SimulationStatus.COMPLETED, 
                    progress: 100, 
                    logs: [...jobs[jobIndex].logs, 'Done.'],
                    results: {
                        annualProduction: Math.floor(1400 + Math.random() * 500), 
                        performanceRatio: 82.5,
                        specificYield: 1350
                    }
                 });
            }, 1500);
        }, 2000);
    }, 2000);
  }, 1000);
};