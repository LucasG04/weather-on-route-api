export interface WeatherData {
  temperature: number;
  condition: string;
  time: string;
  date: string;
  hour: number;
}

export interface DirectionRequest {
  mode: 'driving' | 'walking' | 'cycling';

  /** coordinates in the format "lat,lon" */
  coords: number[][];

  /** local time in "2023-10-01T13:41" */
  departAt: string;
}
