import { Place, Coordinates } from '../types';
import { MOCK_PLACES } from '../constants';

// In a real implementation, this interacts with the Google Maps Places API and Static Maps API.
// We are mocking this for the demo to ensure functionality without requiring a valid GCP Maps Key.

export const searchPlaces = async (query: string): Promise<Place[]> => {
  console.log(`[Maps API] Searching for: ${query}`);
  // Simulate network latency
  await new Promise(resolve => setTimeout(resolve, 800));
  
  // Basic filtering of existing mocks
  const hits = MOCK_PLACES.filter(p => 
    p.name.toLowerCase().includes(query.toLowerCase()) || 
    p.type.includes(query.toLowerCase()) ||
    p.address.toLowerCase().includes(query.toLowerCase())
  );

  if (hits.length > 0) return hits;

  // Fallback: If no match in mocks, generate a "Dynamic Mock" based on the query
  // to make the Map View feel responsive during testing
  return [{
      id: `dynamic_${Date.now()}`,
      name: query.charAt(0).toUpperCase() + query.slice(1) + " (Result)",
      address: `100 Mock Avenue, Near ${query}`,
      location: { lat: 44.43 + (Math.random() * 0.05), lng: 26.10 + (Math.random() * 0.05) },
      type: 'generic_place',
      imageUrl: `https://picsum.photos/seed/${query}/800/600`
  }];
};

export const getPlaceDetails = async (placeId: string): Promise<Place | undefined> => {
  console.log(`[Maps API] Getting details for: ${placeId}`);
  await new Promise(resolve => setTimeout(resolve, 500));
  return MOCK_PLACES.find(p => p.id === placeId);
};

export const getSatelliteImage = (coords: Coordinates): string => {
  // Returns a placeholder URL that would normally be a Google Static Maps URL
  return `https://picsum.photos/seed/${coords.lat + coords.lng}/800/600`;
};