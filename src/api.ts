import mbxClient from '@mapbox/mapbox-sdk';
import mbxGeocoding from '@mapbox/mapbox-sdk/services/geocoding';
import mbxDirections from '@mapbox/mapbox-sdk/services/directions';

import {
  DirectionRequest,
  DirectionResponse,
  WeatherApiResponse as WeatherApiForecastHour,
  WeatherData,
} from './shared/types';
import { formatDistance, formatDuration } from './shared/format';
import { extractWeatherWaypoints } from './shared/extract-waypoints';

const config = {
  MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
  MAPBOX_API_URL: 'https://api.mapbox.com',

  WEATHER_API_KEY: process.env.WEATHER_API_KEY,
  WEATHER_API_URL: 'http://api.weatherapi.com/v1',
};

const baseClient = mbxClient({ accessToken: config.MAPBOX_API_KEY });
const geocodingClient = mbxGeocoding(baseClient);
const directionsClient = mbxDirections(baseClient);

const urlWithParams = (url, params) => {
  let query = Object.keys(params)
    .map((k) => encodeURIComponent(k) + '=' + encodeURIComponent(params[k]))
    .join('&');

  return `${url}?${query}`;
};

export const getWeather = async (
  lat: string,
  lon: string,
  datetime: Date
): Promise<WeatherData | undefined> => {
  const date = datetime.toISOString().split('T')[0]; // Format: YYYY-MM-DD
  const hour = datetime.getHours(); // Hour from 0 to 23

  const url = urlWithParams(`${config.WEATHER_API_URL}/forecast.json`, {
    key: config.WEATHER_API_KEY,
    q: `${lat},${lon}`,
    dt: date,
    hour: hour,
  });

  try {
    const response = await fetch(url);
    const data = (await response.json()) as any;

    // Access the hourly forecast
    const forecastHour: WeatherApiForecastHour =
      data.forecast.forecastday[0].hour.find((h) =>
        h.time.includes(`${hour}:00`)
      );

    if (!forecastHour) {
      console.error('No forecast data available for the specified hour.');
      return undefined;
    }

    return {
      temperature: forecastHour.temp_c,
      condition: forecastHour.condition,
      time: forecastHour.time,
      date: date,
      hour: hour,
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return undefined;
  }
};

export const getDirections = async (
  req: DirectionRequest
): Promise<DirectionResponse | undefined> => {
  const coords = req.coords.map((coord) => ({
    coordinates: coord,
    radius: 'unlimited',
    approach: 'unrestricted',
  }));
  const config = {
    profile: req.mode,
    waypoints: coords,
    geometries: 'polyline6',
    overview: 'full',
    voiceInstructions: false,
    steps: true,
  };

  if (req.mode === 'driving') {
    config['departAt'] = req.departAt;
  }

  try {
    const response = await directionsClient.getDirections(config).send();
    const route = response?.body?.routes?.[0];
    if (!route) {
      console.error('No route found in the response.');
      return undefined;
    }

    const steps = route?.legs?.[0]?.steps || [];
    const timedWaypoints = await extractWeatherWaypoints(
      new Date(req.departAt),
      steps
    );

    route.legs = [];

    return {
      ...route,
      depart_at: req.departAt,
      distance_text: formatDistance(route.distance),
      duration_text: formatDuration(route.duration),
      timedWaypoints,
    };
  } catch (error) {
    console.error('Error fetching directions data:', error);
    return undefined;
  }
};

export const getSearch = async (
  query: string,
  language: 'en' | 'de'
): Promise<any> => {
  if (!query) {
    console.error('Query is required for search.');
    return undefined;
  }

  try {
    const forwardGeocode = await geocodingClient
      .forwardGeocode({
        query: query,
        limit: 5,
        language: [language],
      })
      .send();
    return forwardGeocode?.body?.features;
  } catch (error) {
    console.error('Error fetching search data:', error);
    return undefined;
  }
};
