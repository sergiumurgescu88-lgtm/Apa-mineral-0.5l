
import { SolarPark } from '../types';

export const ROMANIAN_SOLAR_PARKS: SolarPark[] = [
  {
    id: 'ro_pv_021',
    name: 'Arad Mega Solar Park (Europe\'s Largest)',
    county: 'Arad',
    region: 'Vest',
    capacityMw: 1044,
    operator: 'Monsson / Rezolv Energy',
    status: 'Under Construction',
    location: { lat: 46.22, lng: 20.95 },
    technicalDetails: 'Pilu/Graniceri area. €800M investment. Largest PV park in Europe upon completion. Includes battery storage.',
    healthScore: 98,
    dailyRevenueEur: 0,
    panelsCount: 1790000,
    co2AvoidedTons: 1150000
  },
  {
    id: 'ro_pv_001',
    name: 'Livada/Ciuperceni Solar Park',
    county: 'Satu Mare',
    region: 'Nord-Vest',
    capacityMw: 56,
    operator: 'GPSB Solaris 48 SRL',
    commissionedDate: '2013-11',
    status: 'Operational',
    location: { lat: 47.868, lng: 23.054 },
    investment: '€105M',
    technicalDetails: '135 hectares, 230,000 units. Ranked #1 in capacity of the legacy 2013 boom era.',
    healthScore: 84,
    dailyRevenueEur: 18500,
    panelsCount: 230000,
    co2AvoidedTons: 62000
  },
  {
    id: 'ro_pv_002',
    name: 'Izvoarele Solar Park',
    county: 'Giurgiu',
    region: 'Sud-Muntenia',
    capacityMw: 42.5,
    operator: 'LJG Green Source Energy Gamma',
    commissionedDate: '2013',
    status: 'Operational',
    location: { lat: 44.045, lng: 25.7972 },
    investment: '€77M',
    technicalDetails: '125 hectares, 215,000 panels. Ranked #2 in legacy ranking.',
    healthScore: 78,
    dailyRevenueEur: 16200,
    panelsCount: 215000,
    co2AvoidedTons: 55000
  },
  {
    id: 'ro_pv_003',
    name: 'Slobozia Solar Park',
    county: 'Giurgiu',
    region: 'Sud-Muntenia',
    capacityMw: 38,
    operator: 'LJG Green Source Energy Alpha',
    commissionedDate: '2013-09',
    status: 'Operational',
    location: { lat: 43.8583, lng: 25.9066 },
    investment: '€100M',
    technicalDetails: '113 hectares, 180,000 units. Ranked #3 in legacy ranking.',
    healthScore: 88,
    dailyRevenueEur: 14500,
    panelsCount: 180000,
    co2AvoidedTons: 42000
  },
  {
    id: 'ro_pv_004',
    name: 'Ucea de Sus Complex',
    county: 'Brașov',
    region: 'Centru',
    capacityMw: 46,
    operator: 'Green Vision Seven SRL',
    commissionedDate: '2013-12',
    status: 'Operational',
    location: { lat: 45.65, lng: 25.61 },
    investment: '€100M',
    technicalDetails: '200 hectares combined (Ucea 1: 28MW, Ucea 2: 18MW). Uses Thin-Film technology (332,000 units).',
    healthScore: 92,
    dailyRevenueEur: 17800,
    panelsCount: 332000,
    co2AvoidedTons: 50000
  },
  {
    id: 'ro_pv_009',
    name: 'Tenaris Călărași',
    county: 'Călărași',
    region: 'Sud-Muntenia',
    capacityMw: 20,
    operator: 'Tenaris Romania',
    commissionedDate: '2025-01',
    status: 'Operational',
    location: { lat: 44.2, lng: 27.33 },
    technicalDetails: 'Industrial self-consumption facility for steel manufacturing. $21.5M investment.',
    healthScore: 97,
    dailyRevenueEur: 8000,
    panelsCount: 45000
  },
  {
    id: 'ro_pv_010',
    name: 'Saint-Gobain Călărași',
    county: 'Călărași',
    region: 'Sud-Muntenia',
    capacityMw: 8.6,
    operator: 'Engie / Saint-Gobain',
    commissionedDate: '2022',
    status: 'Operational',
    location: { lat: 44.2, lng: 27.33 },
    technicalDetails: 'First and largest pure self-consumption project in Romania. Covers 20% of factory needs.',
    healthScore: 99,
    dailyRevenueEur: 3500,
    panelsCount: 18000
  }
];

export const searchParks = (query: string): SolarPark[] => {
    const q = query.toLowerCase().trim();
    if (q === 'romania' || q === 'toate' || q === 'top') {
        return ROMANIAN_SOLAR_PARKS;
    }
    return ROMANIAN_SOLAR_PARKS.filter(p => 
        p.name.toLowerCase().includes(q) || 
        p.county.toLowerCase().includes(q) || 
        p.operator.toLowerCase().includes(q)
    );
};
