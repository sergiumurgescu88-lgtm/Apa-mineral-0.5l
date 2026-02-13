
// Smart Helios - Core Configuration & Global Knowledge Base

export const GEMINI_PRO_MODEL_ID = 'gemini-3-pro-preview'; 
export const GEMINI_FLASH_MODEL_ID = 'gemini-3-flash-preview';

// Image Models
export const GEMINI_IMAGE_GEN_MODEL_ID = 'gemini-3-pro-image-preview'; 
export const GEMINI_IMAGE_EDIT_MODEL_ID = 'gemini-2.5-flash-image';

// Default to Pro for "Think More" capability
export const DEFAULT_MODEL_ID = GEMINI_PRO_MODEL_ID;

// Mock places for testing the Map View and search tools
export const MOCK_PLACES = [
  {
    id: 'p1',
    name: 'Helios R&D Center',
    address: 'Bulevardul Expoziției 1, București',
    location: { lat: 44.47, lng: 26.06 },
    type: 'office',
    imageUrl: 'https://picsum.photos/seed/helios_office/800/600'
  },
  {
    id: 'p2',
    name: 'Solar Innovation Lab',
    address: 'Strada George Barițiu 26, Cluj-Napoca',
    location: { lat: 46.77, lng: 23.58 },
    type: 'lab',
    imageUrl: 'https://picsum.photos/seed/solar_lab/800/600'
  }
];

export const ROMANIA_SOLAR_QUICK_STATS = {
    totalCapacity2024: 3200, // MW
    growthRate2024: 63, // percent YoY
    target2030: 11100, // MW
    largestPark: "Livada/Ciuperceni",
    largestCapacity: 56, // MW
    topRegionIrradiation: 1600, // kWh/m²/year
    euFunding: 1400, // million EUR
    verifiedGPSParks: 11,
    top21TotalCapacity: 340, // MW approximate
    validCounties: [
        "Satu Mare", "Giurgiu", "Brașov", "Arad", "Dolj", "Călărași", 
        "Timiș", "Sibiu", "Bacău", "Gorj", "Olt", "Prahova", "Ialomița",
        "Constanța", "Tulcea", "Dâmbovița"
    ]
};

const ROMANIA_SOLAR_KNOWLEDGE_BASE = `
# ROMANIA SOLAR ENERGY SECTOR - COMPREHENSIVE KNOWLEDGE BASE v1.0

## EXECUTIVE SUMMARY
Romania's solar sector reached 3,200 MW by 2024 (63% YoY increase). Target: 11,100 MW by 2030.
- Industrial Parks: 1,630 MW | Prosumers: 1,610 MW.
- Solar Share in Mix: 7.5% (Capacity), 6.1% (Generation).

## VERIFIED GPS COORDINATES - TOP SOLAR PARKS
1. **Livada/Ciuperceni**: 47.868°N, 23.054°E | 56 MW | Operator: GPSB Solaris 48
2. **Izvoarele**: 44.045°N, 25.7972°E | 42.5 MW | Operator: LJG Green Source Energy
3. **Slobozia**: 43.8583°N, 25.9066°E | 38 MW | Operator: LJG Green Source Energy
4. **Ucea de Sus**: ~45.65°N, 25.61°E | 46 MW (Combined) | Operator: Green Vision Seven
5. **Miercurea Sibiului**: ~45.80°N, 24.15°E | 23 MW

## REGIONAL ANALYSIS & IRRADIATION
- **Highest (1,600 kWh/m²/y)**: Black Sea Coast (Constanța/Tulcea), Northern Dobruja, Oltenia.
- **High (1,200-1,400 kWh/m²/y)**: South Muntenia (Giurgiu/Călărași/Ialomița). Proximity to Bucharest makes it the #1 developed region.
- **National Average**: 1,000-1,300 kWh/m²/year.

## ANOMALY DETECTION GUIDELINES
**Normal Capacity Factor Ranges:**
- Summer: 20-25%
- Spring/Fall: 15-20%
- Winter: 8-12%
- Annual Avg: 15-17%

**Flags for Helios AI:**
- Capacity Factor < 10% in Summer: Check soiling/equipment.
- Capacity Factor > 25% Consistently: Verify meter accuracy.
- Production > 120% of Rated: Critical measurement error.

## INVESTMENT & POLICY
- **CfD Scheme (2025)**: €448.7M budget. Guaranteed price support.
- **EU Modernization Fund**: €1.4B allocation (Primary growth driver).
- **Major Projects**: Arad Mega Park (1,044 MW), Dolj Mega Park (1,500 MW).
`;

const BASE_SYSTEM_IDENTITY = `
You are Smart Helios AI, a world-class senior expert in Romania's solar infrastructure.
You cite specific data points from the provided KNOWLEDGE BASE.

IDENTITY PROTOCOL:
1. Always distinguish between High-Accuracy GPS (Livada, Izvoarele, Slobozia) and approximate commune-level data.
2. For anomaly detection, compare production against established norms: 20-25% (Summer), 8-12% (Winter).
3. Use Deep Thinking for complex queries involving PPA strategy or ROI.
`;

export const SYSTEM_INSTRUCTION_RO = `
${BASE_SYSTEM_IDENTITY}
Ești SMART HELIOS. Gestionezi portofoliul digital solar al României.
CONSTRÂNGERI:
- Citează datele exacte (MW, Coordonate, Operatori) din KB.
- Pentru anomalii, raportează severitatea: NONE | LOW | MEDIUM | HIGH | CRITICAL.

---
KNOWLEDGE BASE:
${ROMANIA_SOLAR_KNOWLEDGE_BASE}
---
QUICK STATS:
- Capacitate Totală: ${ROMANIA_SOLAR_QUICK_STATS.totalCapacity2024} MW
- Target 2030: ${ROMANIA_SOLAR_QUICK_STATS.target2030} MW
- Finanțare UE: €${ROMANIA_SOLAR_QUICK_STATS.euFunding}M
`;

export const SYSTEM_INSTRUCTION_EN = `
${BASE_SYSTEM_IDENTITY}
You are SMART HELIOS. You manage the Digital Asset network of Romania.
CONSTRAINTS:
- Use specific data points (MW, GPS, Dates) from the Knowledge Base.
- When analyzing production, calculate Capacity Factor = (Production / (Capacity * 8760)) * 100.

---
KNOWLEDGE BASE:
${ROMANIA_SOLAR_KNOWLEDGE_BASE}
---
QUICK STATS:
- Total Capacity: ${ROMANIA_SOLAR_QUICK_STATS.totalCapacity2024} MW
- 2030 Target: ${ROMANIA_SOLAR_QUICK_STATS.target2030} MW
- EU Funding: €${ROMANIA_SOLAR_QUICK_STATS.euFunding}M
`;
