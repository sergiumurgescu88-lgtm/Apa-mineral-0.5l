
import { Language } from './types';

export const translations = {
  ro: {
    app: {
      title: "SMART HELIOS",
      subtitle: "DIGITAL TWIN & AI",
      geoBtn: "CONTEXT GEO-SPAȚIAL",
      pvsystBtn: "AUTOMATIZARE PVSYST",
      queueTitle: "Coada de Simulare",
      active: "Active",
      eventsTitle: "Evenimente de Orchestrare",
      noEvents: "Niciun eveniment de sistem înregistrat.",
      jobQueue: "Coada Joburi Simulare",
    },
    chat: {
      welcome: "Salut. Sunt Smart Helios, Digital Twin Manager-ul tău. Monitorizez 28 de parcuri în timp real cu cele 16 module AI avansate. Cum pot optimiza portofoliul tău astăzi? (Poți întreba despre anomalii termice, trading, agrivoltaice sau PPA-uri)",
      agentName: "SMART_HELIOS_AI",
      imageAttached: "Imagine atașată",
      fileAttached: "Fișier atașat",
      placeholder: "Întreabă despre venituri, anomalii, trading sau agrivoltaice...",
      uploadTitle: "Încarcă Fișier",
      apiKeyMissing: "Cheia API lipsește. Vă rugăm să reporniți cu un process.env.API_KEY valid.",
      error: "Eroare",
      quotaError: "Limita API a fost atinsă (429). Se încearcă reconectarea, vă rugăm așteptați sau verificați planul de facturare Google AI.",
      send: "Trimite",
      sources: "Surse (Grounding)",
      webSource: "Web",
      mapSource: "Hărți",
      listening: "Te ascult...",
      micError: "Accesul la microfon a fost refuzat sau nu este suportat.",
      tapToSpeak: "Apasă pentru a vorbi"
    },
    map: {
      scanning: "SCANARE DATE GEO-SPAȚIALE...",
      emptyTitle: "Vizualizare Hartă Goală",
      emptyDesc: "Cere-i lui Helios să caute un parc (ex: 'Pilu-Graniceri') pentru a activa Digital Twin.",
      lat: "LAT",
      lng: "LNG",
      results: "Active Găsite",
    },
    pvsyst: {
      title: "Controler CLI",
      tabs: {
        config: "CONFIGURARE",
        license: "LICENȚĂ",
        tools: "INSTRUMENTE",
        projects: "PROIECTE"
      },
      cliPath: "Cale Executabil PVsystCLI",
      workspacePath: "Cale Date Workspace",
      saveBtn: "Salvează Configurația",
      saving: "Se salvează...",
      licenseStatus: "Status Licență Output",
      unknownStatus: "Status necunoscut. Apasă 'Verifică Status' pentru a interoga CLI.",
      checkBtn: "Verifică Status (lic-info)",
      querying: "Se interoghează...",
      activateTitle: "Activează Licență Nouă",
      placeholderKey: "Introdu ID Client / Cheie Activare",
      activateBtn: "Activează Licență",
      deactivateBtn: "Dezactivează",
      convertTitle: "Convertește Date Meteo",
      inputCsv: "Cale CSV Intrare...",
      inputSit: "Cale SIT Intrare...",
      outputMet: "Cale MET Ieșire...",
      runConvert: "Rulează convert-meteo",
      searchProjects: "Caută proiecte...",
      noProjects: "Niciun proiect găsit.",
      lastMod: "Modificat:",
    },
    status: {
      noActive: "Nici o simulare activă",
      job: "Job PVsyst",
      target: "ID Țintă",
      prod: "Producție",
      yield: "Randament",
      pending: "ÎN AȘTEPTARE",
      processing: "SE PROCESEAZĂ",
      completed: "FINALIZAT",
      failed: "EȘUAT"
    }
  },
  en: {
    app: {
      title: "SMART HELIOS",
      subtitle: "DIGITAL TWIN & AI",
      geoBtn: "GEO-SPATIAL CONTEXT",
      pvsystBtn: "PVSYST AUTOMATION",
      queueTitle: "Simulation Queue",
      active: "Active",
      eventsTitle: "Orchestration Events",
      noEvents: "No system events recorded.",
      jobQueue: "Simulation Job Queue",
    },
    chat: {
      welcome: "Hello. I am Smart Helios, your Digital Twin Manager. I am monitoring 28 parks in real-time with my 16 advanced AI modules. How can I optimize your portfolio today? (Ask about thermal anomalies, trading, agrivoltaics or PPAs)",
      agentName: "SMART_HELIOS_AI",
      imageAttached: "Image attached",
      fileAttached: "File attached",
      placeholder: "Ask about revenue, anomalies, trading, or agrivoltaics...",
      uploadTitle: "Upload File",
      apiKeyMissing: "API Key missing. Please restart with a valid process.env.API_KEY.",
      error: "Error",
      quotaError: "API Rate limit exceeded (429). Retrying automatically, please wait or check Google AI billing.",
      send: "Send",
      sources: "Sources (Grounding)",
      webSource: "Web",
      mapSource: "Maps",
      listening: "Listening...",
      micError: "Microphone access denied or not supported.",
      tapToSpeak: "Tap to speak"
    },
    map: {
      scanning: "SCANNING GEO-SPATIAL DATA...",
      emptyTitle: "Map Viewport Empty",
      emptyDesc: "Ask Helios to search for a park (e.g., 'Pilu-Graniceri') to activate Digital Twin.",
      lat: "LAT",
      lng: "LNG",
      results: "Assets Found",
    },
    pvsyst: {
      title: "CLI Controller",
      tabs: {
        config: "CONFIG",
        license: "LICENSE",
        tools: "TOOLS",
        projects: "PROJECTS"
      },
      cliPath: "PVsystCLI Executable Path",
      workspacePath: "Workspace Data Path",
      saveBtn: "Save Configuration",
      saving: "Saving...",
      licenseStatus: "License Status Output",
      unknownStatus: "Unknown status. Click 'Check Status' to query CLI.",
      checkBtn: "Check Status (lic-info)",
      querying: "Querying...",
      activateTitle: "Activate New License",
      placeholderKey: "Enter Customer ID / Activation Key",
      activateBtn: "Activate License",
      deactivateBtn: "Deactivate",
      convertTitle: "Convert Meteo Data",
      inputCsv: "Input CSV Path...",
      inputSit: "Input SIT Path...",
      outputMet: "Output MET Path...",
      runConvert: "Run convert-meteo",
      searchProjects: "Search projects...",
      noProjects: "No projects found.",
      lastMod: "Modified:",
    },
    status: {
      noActive: "No active simulations",
      job: "PVsyst Job",
      target: "Target ID",
      prod: "Production",
      yield: "Yield",
      pending: "PENDING",
      processing: "PROCESSING",
      completed: "COMPLETED",
      failed: "FAILED"
    }
  }
};

export const t = (lang: Language, section: keyof typeof translations.ro, key: string): string => {
  // @ts-ignore - dynamic access
  return translations[lang][section][key] || key;
};
