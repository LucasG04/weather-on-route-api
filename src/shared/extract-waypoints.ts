import { getWeather } from '../api';
import { DirectionStep, TimedWaypoint } from './types';
import { decode as decodePolyline } from '@mapbox/polyline';

const INTERVAL_SECONDS = 15 * 60; // 15 minutes in seconds

export const extractWeatherWaypoints = async (
  departAt: Date,
  steps: DirectionStep[]
): Promise<TimedWaypoint[]> => {
  const waypoints = extractWaypoints(steps);
  for (const waypoint of waypoints) {
    const weatherForWaypoint = await getWeather(
      waypoint.lat.toString(),
      waypoint.lon.toString(),
      new Date(departAt.getTime() + waypoint.timeOffsetSec * 1000)
    );
    if (weatherForWaypoint) {
      waypoint.weather = weatherForWaypoint;
    } else {
      console.warn(
        `No weather data found for waypoint at ${waypoint.timeOffsetSec} seconds`
      );
    }
  }
  return waypoints;
};

export const extractWaypoints = (steps: DirectionStep[]): TimedWaypoint[] => {
  let currentTime = 0;
  let nextWaypointTime = INTERVAL_SECONDS;
  const waypoints: TimedWaypoint[] = [];

  for (const step of steps) {
    const coords = decodePolyline(step.geometry, 6); // [ [lat, lon], ... ]
    if (coords.length < 2 || step.duration === 0) continue;

    const segmentDuration = step.duration / (coords.length - 1); // seconds per segment

    for (let i = 0; i < coords.length - 1; i++) {
      const [lat1, lon1] = coords[i];
      const [lat2, lon2] = coords[i + 1];

      while (currentTime + segmentDuration >= nextWaypointTime) {
        const ratio = (nextWaypointTime - currentTime) / segmentDuration;

        const lat = lat1 + (lat2 - lat1) * ratio;
        const lon = lon1 + (lon2 - lon1) * ratio;

        waypoints.push({
          timeOffsetSec: nextWaypointTime,
          lat,
          lon,
        });

        nextWaypointTime += INTERVAL_SECONDS;
      }

      currentTime += segmentDuration;
    }
  }
  return waypoints;
};
