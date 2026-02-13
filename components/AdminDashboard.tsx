
import React, { useState, useEffect } from 'react';
import { User, LoginLog, ToolCallLog, Message } from '../types';
import ProfilePanel from './ProfilePanel';

// --- DEFAULT SEED DATA (For Offline/First-Run Mode) ---
const DEFAULT_USERS: User[] = [
    { 
        id: 'admin_1', 
        name: 'System Admin', 
        email: 'admin@helios.ai', 
        role: 'admin', 
        avatar: 'https://ui-avatars.com/api/?name=Admin&background=0ea5e9&color=fff',
        created_at: '2023-01-15 10:00:00'
    },
    { 
        id: 'eng_1', 
        name: 'Solar Engineer', 
        email: 'engineer@helios.ai', 
        role: 'engineer', 
        avatar: 'https://ui-avatars.com/api/?name=Engineer&background=10b981&color=fff',
        created_at: '2023-03-22 14:30:00'
    },
    { 
        id: 'view_1', 
        name: 'Stakeholder View', 
        email: 'client@investor.com', 
        role: 'viewer', 
        avatar: 'https://ui-avatars.com/api/?name=Client&background=f59e0b&color=fff',
        created_at: '2023-05-10 09:15:00'
    },
    { 
        id: 'dev_1', 
        name: 'Developer Access', 
        email: 'dev@helios.ai', 
        role: 'admin', 
        avatar: 'https://ui-avatars.com/api/?name=Developer&background=10b981&color=fff',
        created_at: new Date().toISOString()
    }
];

const DEFAULT_LOGS: LoginLog[] = [
    { id: 101, user_name: 'System Admin', email: 'admin@helios.ai', login_time: new Date().toISOString(), ip_address: '192.168.0.101', user_agent: 'Chrome/122.0.0.0' },
    { id: 102, user_name: 'Solar Engineer', email: 'engineer@helios.ai', login_time: new Date(Date.now() - 3600000).toISOString(), ip_address: '10.0.0.55', user_agent: 'Firefox/123.0' },
    { id: 103, user_name: 'System Admin', email: 'admin@helios.ai', login_time: new Date(Date.now() - 86400000).toISOString(), ip_address: '192.168.0.101', user_agent: 'Chrome/122.0.0.0' },
    { id: 104, user_name: 'Developer Access', email: 'dev@helios.ai', login_time: new Date(Date.now() - 120000).toISOString(), ip_address: '127.0.0.1', user_agent: 'Safari/17.0' },
];

const AdminDashboard: React.FC = () => {
  const [users, setUsers] = useState<User[]>([]);
  const [logs, setLogs] = useState<LoginLog[]>([]);
  const [stats, setStats] = useState({ totalUsers: 0, totalLogins: 0, recentLogins: 0 });
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [isOfflineMode, setIsOfflineMode] = useState(false);
  
  // View As User State
  const [viewAsUser, setViewAsUser] = useState<User | null>(null);

  useEffect(() => {
    loadData();
  }, []);

  // --- ROBUST HYBRID DATA LOADING ---
  const loadData = async () => {
    setLoading(true);
    
    // Fast failover timeout (1s) to make the app feel snappy even if backend is missing
    const fetchWithTimeout = (url: string, ms = 1000) => 
        Promise.race([
            fetch(url),
            new Promise((_, reject) => setTimeout(() => reject(new Error('Timeout')), ms))
        ]) as Promise<Response>;

    try {
        // 1. Attempt Real Backend Connection
        const [statsRes, usersRes, logsRes] = await Promise.all([
            fetchWithTimeout('http://localhost:3001/api/admin/stats'),
            fetchWithTimeout('http://localhost:3001/api/admin/users'),
            fetchWithTimeout('http://localhost:3001/api/admin/logs')
        ]);

        if (!statsRes.ok || !usersRes.ok || !logsRes.ok) throw new Error("Backend Error");

        const s = await statsRes.json();
        const u = await usersRes.json();
        const l = await logsRes.json();

        setStats(s);
        setUsers(u.users);
        setLogs(l.logs);
        setIsOfflineMode(false);

        // Optional: Sync real data to local storage for future fallback
        localStorage.setItem('helios_users_cache', JSON.stringify(u.users));
        localStorage.setItem('helios_logs_cache', JSON.stringify(l.logs));

    } catch (e) {
        // 2. Silent Failover to Local Storage (Offline/Demo Mode)
        // No console.warn() - expected behavior in serverless environments
        setIsOfflineMode(true);
        loadLocalData();
    } finally {
        setLoading(false);
    }
  };

  const loadLocalData = () => {
      // Users
      const cachedUsers = localStorage.getItem('helios_users_cache');
      let localUsers: User[] = cachedUsers ? JSON.parse(cachedUsers) : DEFAULT_USERS;
      
      // Logs
      const cachedLogs = localStorage.getItem('helios_logs_cache');
      let localLogs: LoginLog[] = cachedLogs ? JSON.parse(cachedLogs) : DEFAULT_LOGS;

      // Ensure we have data (seed if empty)
      if (localUsers.length === 0) localUsers = DEFAULT_USERS;
      if (localLogs.length === 0) localLogs = DEFAULT_LOGS;

      setUsers(localUsers);
      setLogs(localLogs);
      
      // Calc Stats on the fly
      setStats({
          totalUsers: localUsers.length,
          totalLogins: localLogs.length,
          recentLogins: localLogs.filter(l => {
              const d = new Date(l.login_time);
              const now = new Date();
              return d.getDate() === now.getDate() && d.getMonth() === now.getMonth();
          }).length
      });
  };

  // --- ACTIONS WITH PERSISTENCE ---
  const deleteUser = async (id: string) => {
    if (!confirm('Are you sure you want to delete this user?')) return;
    
    // 1. Optimistic Update (UI)
    const updatedUsers = users.filter(u => u.id !== id);
    setUsers(updatedUsers);

    // 2. Try Backend Delete
    try {
        if (!isOfflineMode) {
            await fetch(`http://localhost:3001/api/admin/users/${id}`, { method: 'DELETE' });
        } else {
            throw new Error("Offline"); // Force local update logic
        }
    } catch (e) {
        // 3. Fallback: Update Local Storage
        // This ensures the user STAYS deleted even on refresh if backend is down
        localStorage.setItem('helios_users_cache', JSON.stringify(updatedUsers));
    }
  };

  const exportCSV = () => {
    const headers = "User,Email,Data,IP,Agent\n";
    const csv = logs.map(l => `${l.user_name},${l.email},${l.login_time},${l.ip_address},"${l.user_agent}"`).join("\n");
    const blob = new Blob([headers + csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `helios_logs_${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
  };

  const generateMockToolLogs = (userId: string): ToolCallLog[] => [
    { toolName: 'fetch_planet_imagery', args: { location: 'Arad', source: 'skysat' }, result: 'Success', timestamp: Date.now() - 120000 },
    { toolName: 'analyze_predictive_failure', args: { parkId: 'ro_pv_002' }, result: 'Anomaly Detected (Inverter B2)', timestamp: Date.now() - 500000 },
    { toolName: 'execute_energy_trade', args: { action: 'BUY', amount: 50 }, result: 'Executed @ 120 EUR/MWh', timestamp: Date.now() - 86400000 },
    { toolName: 'calculate_carbon_impact', args: { mwh: 1500 }, result: 'Avoided 450t CO2', timestamp: Date.now() - 1200000 },
    { toolName: 'fetch_weather_forecast', args: { lat: 44.4, lng: 26.1 }, result: 'Clear Sky', timestamp: Date.now() - 2000000 },
  ];

  const generateMockChatHistory = (userName: string): Message[] => [
    { id: '1', role: 'user', content: 'Care este statusul operațional pentru parcul Livada?', timestamp: Date.now() - 1000000 },
    { id: '2', role: 'model', content: `Salut ${userName}. Parcul Livada funcționează la 98% capacitate. NDVI este 0.65, indicând o stare bună a vegetației. Nu au fost detectate anomalii termice majore în ultima scanare Sentinel-3.`, timestamp: Date.now() - 900000 },
    { id: '3', role: 'user', content: 'Generează un raport de producție pentru ieri.', timestamp: Date.now() - 800000 },
    { id: '4', role: 'model', content: 'Am generat raportul tehnic. Producția totală a fost de 45.2 MWh, cu un randament specific de 4.1 kWh/kWp. Vrei să îl export în format PDF?', timestamp: Date.now() - 700000 }
  ];

  const filteredUsers = users.filter(u => 
    u.name?.toLowerCase().includes(search.toLowerCase()) || 
    u.email?.toLowerCase().includes(search.toLowerCase())
  );

  // --- RENDER: VIEW AS USER (FULL PROFILE) ---
  if (viewAsUser) {
    return (
        <div className="h-full relative animate-in slide-in-from-right duration-500 bg-slate-950">
            <div className="absolute top-4 right-4 md:right-10 z-50">
                <button 
                    onClick={() => setViewAsUser(null)} 
                    className="bg-red-500/10 backdrop-blur-md text-red-400 border border-red-500/30 px-4 md:px-6 py-2 rounded-full text-xs font-bold hover:bg-red-500/20 transition-all flex items-center gap-2 shadow-2xl"
                >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><path d="M18 6L6 18M6 6l12 12"/></svg>
                    EXIT VIEW AS {viewAsUser.name.split(' ')[0].toUpperCase()}
                </button>
            </div>
            <ProfilePanel 
                user={viewAsUser} 
                logs={generateMockToolLogs(viewAsUser.id)} 
                chatHistory={generateMockChatHistory(viewAsUser.name)} 
                lang="ro" 
                onLogout={() => setViewAsUser(null)} 
            />
        </div>
    );
  }

  // --- RENDER: ADMIN DASHBOARD (DEFAULT) ---
  return (
    <div className="flex flex-col h-full bg-slate-900 rounded-3xl border border-slate-800 overflow-hidden shadow-2xl animate-in fade-in duration-500">
      {/* Header Statistici */}
      <div className="p-8 bg-slate-950 border-b border-slate-800">
        <div className="flex justify-between items-start mb-6">
            <h2 className="text-2xl font-bold text-white">Panou Administrare Strategică</h2>
            {isOfflineMode && (
                <span className="bg-slate-800 text-slate-400 text-[10px] px-2 py-1 rounded border border-slate-700 font-mono" title="Running on Local Browser Database">
                    OFFLINE MODE
                </span>
            )}
        </div>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-mono uppercase mb-1">Total Utilizatori</p>
                <p className="text-3xl font-bold text-primary-400">{stats.totalUsers}</p>
            </div>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-mono uppercase mb-1">Total Login-uri</p>
                <p className="text-3xl font-bold text-emerald-400">{stats.totalLogins}</p>
            </div>
            <div className="bg-slate-900 p-6 rounded-2xl border border-slate-800">
                <p className="text-slate-500 text-[10px] font-mono uppercase mb-1">Login-uri Azi</p>
                <p className="text-3xl font-bold text-amber-500">{stats.recentLogins}</p>
            </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-8 space-y-12 custom-scrollbar">
        {/* Tabel Utilizatori */}
        <section>
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center mb-6 gap-4">
                <h3 className="text-white font-bold text-lg">Toate Conturile Create</h3>
                <input 
                    type="text" 
                    placeholder="Caută utilizator..." 
                    className="bg-slate-950 border border-slate-800 rounded-xl px-4 py-2 text-sm text-white focus:border-primary-500 outline-none w-full md:w-64"
                    value={search}
                    onChange={e => setSearch(e.target.value)}
                />
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-mono tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Utilizator</th>
                            <th className="px-6 py-4 hidden md:table-cell">Google ID</th>
                            <th className="px-6 py-4 hidden md:table-cell">Creat la</th>
                            <th className="px-6 py-4">Acțiuni</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                             <tr><td colSpan={4} className="text-center py-8 text-slate-500 italic">Se încarcă datele...</td></tr>
                        ) : filteredUsers.length === 0 ? (
                             <tr><td colSpan={4} className="text-center py-8 text-slate-500 italic">Niciun utilizator găsit.</td></tr>
                        ) : (
                            filteredUsers.map(u => (
                                <tr key={u.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-3">
                                            <img src={u.avatar} className="w-8 h-8 rounded-full border border-slate-700" alt="avatar" />
                                            <div>
                                                <p className="text-white font-bold flex items-center gap-2">
                                                    {u.name}
                                                    {u.role === 'admin' && <span className="text-[9px] bg-amber-500/10 text-amber-500 px-1 rounded border border-amber-500/20">ADMIN</span>}
                                                </p>
                                                <p className="text-slate-500 text-xs">{u.email}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 font-mono text-xs hidden md:table-cell">{u.google_id ? u.google_id.slice(0, 8) + '...' : 'LOCAL'}</td>
                                    <td className="px-6 py-4 text-slate-500 text-xs hidden md:table-cell">{u.created_at ? new Date(u.created_at).toLocaleDateString() : '-'}</td>
                                    <td className="px-6 py-4">
                                        <div className="flex gap-2">
                                            <button 
                                                onClick={() => setViewAsUser(u)}
                                                className="text-primary-400 hover:text-white text-xs font-bold bg-primary-500/10 hover:bg-primary-500 px-3 py-1.5 rounded border border-primary-500/20 transition-all flex items-center gap-1"
                                            >
                                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                                                VIEW PROFILE
                                            </button>
                                            <button 
                                                onClick={() => deleteUser(u.id)} 
                                                className="text-red-500 hover:text-red-400 text-xs font-bold bg-red-500/10 px-3 py-1.5 rounded border border-red-500/20 transition-all"
                                            >
                                                DELETE
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>

        {/* Tabel Istoric Login */}
        <section>
            <div className="flex justify-between items-center mb-6">
                <h3 className="text-white font-bold text-lg">Istoric Login-uri</h3>
                <button onClick={exportCSV} className="bg-slate-800 hover:bg-slate-700 text-white text-xs font-bold px-4 py-2 rounded-xl border border-slate-700 transition-all">
                    EXPORT CSV
                </button>
            </div>
            <div className="overflow-x-auto rounded-xl border border-slate-800">
                <table className="w-full text-left text-sm">
                    <thead className="bg-slate-950 text-slate-500 uppercase text-[10px] font-mono tracking-wider">
                        <tr>
                            <th className="px-6 py-4">Utilizator</th>
                            <th className="px-6 py-4">Dată/Oră</th>
                            <th className="px-6 py-4 hidden md:table-cell">IP</th>
                            <th className="px-6 py-4 hidden md:table-cell">Browser</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-800">
                        {loading ? (
                             <tr><td colSpan={4} className="text-center py-8 text-slate-500 italic">Se încarcă log-urile...</td></tr>
                        ) : logs.length === 0 ? (
                             <tr><td colSpan={4} className="text-center py-8 text-slate-500 italic">Niciun log disponibil.</td></tr>
                        ) : (
                            logs.map(l => (
                                <tr key={l.id} className="hover:bg-slate-800/30 transition-colors">
                                    <td className="px-6 py-4">
                                        <p className="text-white font-bold">{l.user_name}</p>
                                        <p className="text-slate-500 text-xs">{l.email}</p>
                                    </td>
                                    <td className="px-6 py-4 text-slate-500 text-xs">{new Date(l.login_time).toLocaleString()}</td>
                                    <td className="px-6 py-4 text-emerald-400 font-mono text-xs hidden md:table-cell">{l.ip_address}</td>
                                    <td className="px-6 py-4 text-slate-500 text-xs truncate max-w-xs hidden md:table-cell" title={l.user_agent}>{l.user_agent}</td>
                                </tr>
                            ))
                        )}
                    </tbody>
                </table>
            </div>
        </section>
      </div>
    </div>
  );
};

export default AdminDashboard;
