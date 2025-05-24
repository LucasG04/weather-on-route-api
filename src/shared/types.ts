export interface WeatherData {
  temperature: number;
  condition: {
    text: string;
    icon: string;
    code: number;
  };
  time: string;
  date: string;
  hour: number;
}

export interface WeatherApiResponse {
  time_epoch: number;
  time: string;
  temp_c: number;
  temp_f: number;
  is_day: number;
  condition: {
    text: string;
    icon: string;
    code: number;
  };
  wind_mph: number;
  wind_kph: number;
  wind_degree: number;
  wind_dir: string;
  snow_cm: number;
  humidity: number;
  cloud: number;
  feelslike_c: number;
  feelslike_f: number;
  will_it_rain: number;
  chance_of_rain: number;
  will_it_snow: number;
  chance_of_snow: number;
  uv: number;
}

export interface DirectionRequest {
  mode: 'driving' | 'walking' | 'cycling';

  /** coordinates in the format "lon,lat" */
  coords: number[][];

  /** local time in "2023-10-01T13:41" */
  departAt: string;
}

export interface DirectionResponse {
  weight_name: string;
  weight: number;
  duration: number;
  duration_text: string;
  distance: number;
  distance_text: string;
  geometry: string;
  timedWaypoints: TimedWaypoint[];
}

export interface DirectionStep {
  geometry: string;
  distance: number;
  duration: number;
}

export interface TimedWaypoint {
  timeOffsetSec: number;
  lon: number;
  lat: number;
  weather?: WeatherData;
}
