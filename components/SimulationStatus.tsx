import React, { useEffect, useState } from 'react';
import { SimulationJob, SimulationStatus, Language } from '../types';
import { getJobStatus } from '../services/pvsystService';
import { t } from '../translations';

interface SimulationStatusProps {
  jobs: string[]; // List of job IDs to track
  lang: Language;
}

const SimulationStatusPanel: React.FC<SimulationStatusProps> = ({ jobs, lang }) => {
  const [jobData, setJobData] = useState<SimulationJob[]>([]);

  useEffect(() => {
    if (jobs.length === 0) return;

    const interval = setInterval(() => {
      const updates = jobs.map(id => getJobStatus(id)).filter((j): j is SimulationJob => !!j);
      setJobData(updates);
    }, 1000);

    return () => clearInterval(interval);
  }, [jobs]);

  const getStatusLabel = (status: SimulationStatus) => {
    switch (status) {
      case SimulationStatus.PENDING: return t(lang, 'status', 'pending');
      case SimulationStatus.PROCESSING: return t(lang, 'status', 'processing');
      case SimulationStatus.COMPLETED: return t(lang, 'status', 'completed');
      case SimulationStatus.FAILED: return t(lang, 'status', 'failed');
      default: return status;
    }
  };

  if (jobs.length === 0) {
    return (
      <div className="h-full flex items-center justify-center text-slate-500 font-mono text-sm">
        {t(lang, 'status', 'noActive')}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {jobData.map((job) => (
        <div key={job.id} className="bg-slate-900 border border-slate-700 rounded-lg p-4 overflow-hidden relative">
           {/* Progress Bar Background */}
           <div 
             className="absolute bottom-0 left-0 h-1 bg-emerald-500 transition-all duration-500"
             style={{ width: `${job.progress}%` }}
           />

          <div className="flex justify-between items-start mb-2">
            <div>
               <h3 className="text-white font-medium text-sm">{t(lang, 'status', 'job')}: {job.id.slice(-6)}</h3>
               <p className="text-xs text-slate-400">{t(lang, 'status', 'target')}: {job.placeId}</p>
            </div>
            <span className={`px-2 py-0.5 rounded text-[10px] font-bold uppercase tracking-wider ${
                job.status === SimulationStatus.COMPLETED ? 'bg-emerald-900/30 text-emerald-400' :
                job.status === SimulationStatus.PROCESSING ? 'bg-primary-900/30 text-primary-400' :
                'bg-slate-800 text-slate-400'
            }`}>
                {getStatusLabel(job.status)}
            </span>
          </div>

          {/* Config Parameters Display */}
          {job.config && (job.config.tilt !== undefined || job.config.modulePower !== undefined) && (
              <div className="flex gap-4 mb-2 text-[10px] text-primary-400 font-mono bg-slate-800/50 p-1.5 rounded">
                  {job.config.systemSize && <span>Size: {job.config.systemSize}kWp</span>}
                  {job.config.tilt && <span>Tilt: {job.config.tilt}°</span>}
                  {job.config.azimuth !== undefined && <span>Az: {job.config.azimuth}°</span>}
                  {job.config.modulePower && <span>Mod: {job.config.modulePower}W</span>}
              </div>
          )}

          <div className="bg-black/50 rounded p-2 h-32 overflow-y-auto font-mono text-[10px] text-slate-300 space-y-1 border border-slate-800">
            {job.logs.map((log, i) => (
                <div key={i} className="flex gap-2">
                    <span className="text-slate-600">[{new Date().toLocaleTimeString()}]</span>
                    <span>{log}</span>
                </div>
            ))}
             {job.status === SimulationStatus.COMPLETED && job.results && (
                 <div className="mt-2 pt-2 border-t border-slate-700 text-emerald-400">
                    <p>{t(lang, 'status', 'prod')}: {job.results.annualProduction} MWh/yr</p>
                    <p>PR: {job.results.performanceRatio}%</p>
                    <p>{t(lang, 'status', 'yield')}: {job.results.specificYield} kWh/kWp</p>
                 </div>
             )}
          </div>
        </div>
      ))}
    </div>
  );
};

export default SimulationStatusPanel;