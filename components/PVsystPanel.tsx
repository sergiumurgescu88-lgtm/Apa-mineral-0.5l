import React, { useState, useEffect } from 'react';
import { getLicenseInfo, updateConfig, activateLicense, deactivateLicense, convertMeteo, getProjects } from '../services/pvsystService';
import { Language, PVsystProject } from '../types';
import { t } from '../translations';

interface PVsystPanelProps {
  lang: Language;
}

const PVsystPanel: React.FC<PVsystPanelProps> = ({ lang }) => {
  const [activeTab, setActiveTab] = useState<'config' | 'license' | 'tools' | 'projects'>('config');
  const [config, setConfig] = useState({
    cliPath: 'C:\\Program Files\\PVsyst7.2\\PVsystCLI.exe',
    workspacePath: 'C:\\Users\\Public\\PVsyst7.0_Data'
  });
  const [licenseInfo, setLicenseInfo] = useState<string>('');
  const [licenseKey, setLicenseKey] = useState('');
  const [loading, setLoading] = useState(false);

  // Tools state
  const [meteoFiles, setMeteoFiles] = useState({ csv: '', sit: '', out: '' });
  const [meteoResult, setMeteoResult] = useState<string>('');

  // Projects state
  const [projects, setProjects] = useState<PVsystProject[]>([]);
  const [searchQuery, setSearchQuery] = useState('');
  const [refreshingProjects, setRefreshingProjects] = useState(false);

  // Fetch projects when Projects tab is selected
  useEffect(() => {
    if (activeTab === 'projects') {
        loadProjects();
    }
  }, [activeTab]);

  const loadProjects = async () => {
    setRefreshingProjects(true);
    const data = await getProjects();
    setProjects(data);
    setRefreshingProjects(false);
  };

  const filteredProjects = projects.filter(p => 
    p.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

  const handleSaveConfig = async () => {
    setLoading(true);
    await updateConfig(config);
    setLoading(false);
  };

  const checkLicense = async () => {
    setLoading(true);
    const info = await getLicenseInfo();
    setLicenseInfo(info);
    setLoading(false);
  };

  const handleActivate = async () => {
    if (!licenseKey.trim()) return;
    setLoading(true);
    const result = await activateLicense(licenseKey);
    setLicenseInfo(result);
    setLoading(false);
  };

  const handleDeactivate = async () => {
    if (!confirm('Are you sure you want to deactivate the license?')) return;
    setLoading(true);
    const result = await deactivateLicense();
    setLicenseInfo(result);
    setLoading(false);
  };

  const handleConvert = async () => {
    if (!meteoFiles.csv || !meteoFiles.sit || !meteoFiles.out) return;
    setLoading(true);
    setMeteoResult('Processing...');
    const result = await convertMeteo(meteoFiles.csv, meteoFiles.sit, meteoFiles.out);
    setMeteoResult(result);
    setLoading(false);
  };

  return (
    <div className="bg-slate-900 border border-slate-700 rounded-lg p-4 h-full flex flex-col">
      <div className="flex border-b border-slate-800 mb-4 overflow-x-auto">
        {['config', 'license', 'tools', 'projects'].map((tab) => (
          <button
            key={tab}
            onClick={() => setActiveTab(tab as any)}
            className={`px-4 py-2 text-xs font-mono uppercase tracking-wider transition-colors whitespace-nowrap ${
              activeTab === tab 
                ? 'text-primary-400 border-b-2 border-primary-400 bg-slate-800/50' 
                : 'text-slate-500 hover:text-slate-300'
            }`}
          >
            {t(lang, 'pvsyst', `tabs.${tab}` as any)}
          </button>
        ))}
      </div>

      <div className="flex-1 overflow-y-auto custom-scrollbar">
        {activeTab === 'config' && (
          <div className="space-y-4">
             <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono">{t(lang, 'pvsyst', 'cliPath')}</label>
                <input 
                  type="text" 
                  value={config.cliPath}
                  onChange={e => setConfig({...config, cliPath: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 font-mono"
                />
             </div>
             <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono">{t(lang, 'pvsyst', 'workspacePath')}</label>
                <input 
                  type="text" 
                  value={config.workspacePath}
                  onChange={e => setConfig({...config, workspacePath: e.target.value})}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 font-mono"
                />
             </div>
             <button 
                onClick={handleSaveConfig}
                disabled={loading}
                className="w-full bg-primary-600 hover:bg-primary-500 text-white py-2 rounded text-sm font-medium transition-colors"
             >
                {loading ? t(lang, 'pvsyst', 'saving') : t(lang, 'pvsyst', 'saveBtn')}
             </button>
          </div>
        )}

        {activeTab === 'license' && (
          <div className="space-y-4">
            <div className="space-y-2">
                <label className="text-xs text-slate-400 font-mono">{t(lang, 'pvsyst', 'licenseStatus')}</label>
                <div className="bg-slate-950 p-4 rounded border border-slate-800 min-h-[100px] font-mono text-xs text-emerald-400 whitespace-pre-wrap overflow-x-auto">
                   {licenseInfo || t(lang, 'pvsyst', 'unknownStatus')}
                </div>
            </div>

            <div className="flex gap-2">
                <button 
                    onClick={checkLicense}
                    disabled={loading}
                    className="flex-1 bg-slate-800 hover:bg-slate-700 border border-slate-600 text-white py-2 rounded text-sm font-medium transition-colors"
                >
                    {loading ? t(lang, 'pvsyst', 'querying') : t(lang, 'pvsyst', 'checkBtn')}
                </button>
            </div>

            <div className="pt-4 border-t border-slate-800 space-y-3">
                <label className="text-xs text-slate-400 font-mono">{t(lang, 'pvsyst', 'activateTitle')}</label>
                <input 
                  type="text" 
                  placeholder={t(lang, 'pvsyst', 'placeholderKey')}
                  value={licenseKey}
                  onChange={e => setLicenseKey(e.target.value)}
                  className="w-full bg-slate-950 border border-slate-700 rounded p-2 text-sm text-slate-200 font-mono"
                />
                <div className="flex gap-2">
                    <button 
                        onClick={handleActivate}
                        disabled={loading || !licenseKey}
                        className="flex-1 bg-emerald-600 hover:bg-emerald-500 disabled:bg-slate-800 disabled:text-slate-500 text-white py-2 rounded text-sm font-medium transition-colors"
                    >
                        {t(lang, 'pvsyst', 'activateBtn')}
                    </button>
                    <button 
                        onClick={handleDeactivate}
                        disabled={loading}
                        className="px-4 bg-red-900/30 border border-red-900/50 text-red-400 hover:bg-red-900/50 rounded text-sm transition-colors"
                    >
                        {t(lang, 'pvsyst', 'deactivateBtn')}
                    </button>
                </div>
            </div>
          </div>
        )}

        {activeTab === 'tools' && (
           <div className="space-y-6">
              <div className="space-y-3 p-3 bg-slate-950/50 rounded border border-slate-800">
                 <h4 className="text-sm font-semibold text-slate-300">{t(lang, 'pvsyst', 'convertTitle')}</h4>
                 <input 
                    placeholder={t(lang, 'pvsyst', 'inputCsv')}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono"
                    onChange={e => setMeteoFiles({...meteoFiles, csv: e.target.value})}
                 />
                 <input 
                    placeholder={t(lang, 'pvsyst', 'inputSit')}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono"
                    onChange={e => setMeteoFiles({...meteoFiles, sit: e.target.value})}
                 />
                  <input 
                    placeholder={t(lang, 'pvsyst', 'outputMet')}
                    className="w-full bg-slate-900 border border-slate-700 rounded p-2 text-xs font-mono"
                    onChange={e => setMeteoFiles({...meteoFiles, out: e.target.value})}
                 />
                 <button 
                    onClick={handleConvert}
                    disabled={loading || !meteoFiles.csv || !meteoFiles.sit || !meteoFiles.out}
                    className="w-full bg-emerald-600/20 text-emerald-400 border border-emerald-600/50 py-1.5 rounded text-xs hover:bg-emerald-600/30 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                 >
                    {loading ? 'Converting...' : t(lang, 'pvsyst', 'runConvert')}
                 </button>
              </div>
              
              {/* Result Output */}
              {meteoResult && (
                  <div className="space-y-1">
                      <h4 className="text-xs font-semibold text-slate-400 uppercase tracking-wider">Output Log</h4>
                      <div className="bg-black/50 p-3 rounded border border-slate-800 text-[10px] font-mono text-slate-300 whitespace-pre-wrap overflow-x-auto max-h-40">
                          {meteoResult}
                      </div>
                  </div>
              )}
           </div>
        )}

        {activeTab === 'projects' && (
            <div className="space-y-4">
                <div className="relative">
                    <input 
                        type="text"
                        placeholder={t(lang, 'pvsyst', 'searchProjects')}
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full bg-slate-950 border border-slate-700 rounded p-2 pl-9 text-sm text-slate-200 font-mono focus:border-primary-500 focus:outline-none transition-colors"
                    />
                    <svg className="absolute left-3 top-2.5 text-slate-500" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/></svg>
                </div>

                <div className="flex-1 space-y-2">
                    {refreshingProjects ? (
                         <div className="text-center text-xs text-slate-500 py-4 animate-pulse">{t(lang, 'pvsyst', 'querying')}</div>
                    ) : filteredProjects.length > 0 ? (
                        filteredProjects.map((project, idx) => (
                            <div key={idx} className="bg-slate-950/50 border border-slate-800 rounded p-3 hover:border-slate-600 transition-colors group cursor-pointer">
                                <div className="flex justify-between items-start mb-1">
                                    <h4 className="text-sm font-medium text-slate-200 font-mono group-hover:text-primary-400 transition-colors truncate pr-2" title={project.name}>
                                        {project.name}
                                    </h4>
                                    <span className="text-[10px] bg-slate-800 px-1.5 py-0.5 rounded text-slate-400 border border-slate-700 whitespace-nowrap">{project.fileSize}</span>
                                </div>
                                <div className="flex justify-between items-end">
                                     <span className="text-[10px] text-slate-500">{t(lang, 'pvsyst', 'lastMod')} {project.lastModified}</span>
                                     <svg className="text-slate-600 group-hover:text-emerald-500 opacity-0 group-hover:opacity-100 transition-all" xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><polygon points="5 3 19 12 5 21 5 3"/></svg>
                                </div>
                            </div>
                        ))
                    ) : (
                        <div className="text-center text-xs text-slate-600 py-8 italic">
                            {t(lang, 'pvsyst', 'noProjects')}
                        </div>
                    )}
                </div>
            </div>
        )}
      </div>
    </div>
  );
};

export default PVsystPanel;