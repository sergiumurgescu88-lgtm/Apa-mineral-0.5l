import { RoofAnnotation } from '../types';

// Mock service for "Anno Banana" - The Roof Analysis AI

export const analyzeRoofImage = async (imageUrl: string): Promise<{ annotations: RoofAnnotation[], totalArea: number }> => {
  console.log(`[Anno Banana] Analyzing image: ${imageUrl}`);
  await new Promise(resolve => setTimeout(resolve, 2000)); // Simulate heavy CV processing

  // Mocked detection results
  const annotations: RoofAnnotation[] = [
    {
      id: 'roof_1',
      type: 'roof_edge',
      points: [{lat: 0, lng: 0}, {lat: 10, lng: 0}, {lat: 10, lng: 10}, {lat: 0, lng: 10}],
      area: 1250 // m2
    },
    {
      id: 'obs_1',
      type: 'obstacle',
      points: [{lat: 2, lng: 2}, {lat: 3, lng: 2}, {lat: 3, lng: 3}],
      area: 45 // m2
    }
  ];

  return {
    annotations,
    totalArea: 1250
  };
};
