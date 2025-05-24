/**
 * Utility functions for formatting durations and distances.
 * These functions are designed to convert raw numerical values into human-readable strings.
 * They are useful for displaying durations in a user-friendly format and converting distances into a more understandable form.
 * @param seconds - Duration in seconds
 * @returns Formatted duration string in hours and minutes
 */
export const formatDuration = (seconds: number): string => {
  const hours = Math.floor(seconds / 3600);
  const minutes = Math.round((seconds % 3600) / 60);

  if (hours > 0) {
    return `${hours} h ${minutes} min`;
  }
  return `${minutes} min`;
};

/**
 * Formats a distance in meters to a human-readable string.
 * If the distance is 1000 meters or more, it converts to kilometers.
 * Otherwise, it returns the distance in meters rounded to the nearest whole number.
 * @param meters - Distance in meters
 * @returns Formatted distance string
 */
export const formatDistance = (meters: number): string => {
  if (meters >= 1000) {
    return `${(meters / 1000).toFixed(1)} km`;
  }
  return `${Math.round(meters)} m`;
};
