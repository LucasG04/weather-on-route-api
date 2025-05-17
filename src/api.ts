import { DirectionRequest, WeatherData } from './types';

const config = {
  MAPBOX_API_KEY: process.env.MAPBOX_API_KEY,
  MAPBOX_API_URL: 'https://api.mapbox.com',

  WEATHER_API_KEY: process.env.WEATHER_API_KEY,
  WEATHER_API_URL: 'http://api.weatherapi.com/v1',
};

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
    const forecastHour = data.forecast.forecastday[0].hour.find((h) =>
      h.time.includes(`${hour}:00`)
    );

    if (!forecastHour) {
      console.error('No forecast data available for the specified hour.');
      return undefined;
    }

    return {
      temperature: forecastHour.temp_c,
      condition: forecastHour.condition.text,
      time: forecastHour.time,
      date: date,
      hour: hour,
    };
  } catch (error) {
    console.error('Error fetching weather data:', error);
    return undefined;
  }
};

export const getDirections = async (req: DirectionRequest): Promise<any> => {
  const coordsStr = req.coords.join(';');
  const url = urlWithParams(
    `${config.MAPBOX_API_URL}/directions/v5/mapbox/${req.mode}/${coordsStr}`,
    {
      language: req.language, // en, de
      depart_at: req.departAt,
      access_token: config.MAPBOX_API_KEY,
      alternatives: false,
      geometries: 'geojson',
      overview: 'full',
      steps: false,
    }
  );

  try {
    const response = await fetch(url);
    const data = (await response.json()) as any;
    return data;
  } catch (error) {
    console.error('Error fetching directions data:', error);
    return undefined;
  }
};

export const getSearch = async (
  query: string,
  language: 'en' | 'de'
): Promise<any> => {
  const url = urlWithParams(
    `${config.MAPBOX_API_URL}/search/searchbox/v1/suggest`,
    {
      q: query,
      access_token: config.MAPBOX_API_KEY,
      language: language,
      limit: 5,
    }
  );
  try {
    const response = await fetch(url);
    const data = (await response.json()) as any;
    return data;
  } catch (error) {
    console.error('Error fetching search data:', error);
    return undefined;
  }
};
