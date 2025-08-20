# Weather on Route API

A secure Express.js API that provides weather forecasts along driving routes. This API combines Mapbox directions with weather data to help users plan their journeys based on weather conditions they'll encounter along the way.

## Features

- Get driving directions with integrated weather data
- Fetch weather conditions for specific coordinates and times
- Search for places using Mapbox geocoding
- JWT authentication, request signing, rate limiting, and honeypot protection
- Full TypeScript support for better development experience
- Includes Dockerfile for containerization

## Docker

### Build and Run

The project is automatically built via GitHub Actions and published as a container image at `ghcr.io/lucasg04/weather-on-route-api:latest`.

It has to be run with the [weather-on-route](https://github.com/LucasG04/weather-on-route) container.

## Environment Variables

| Variable          | Description                                  | Required |
| ----------------- | -------------------------------------------- | -------- |
| `STAGE`           | Environment stage (dev/prod)                 | No       |
| `PORT`            | Server port                                  | No       |
| `ALLOWED_ORIGINS` | Comma-separated list of allowed CORS origins | Yes      |
| `JWT_SECRET`      | Secret for JWT token signing                 | Yes      |
| `API_SECRET`      | Secret for request signature verification    | Yes      |
| `MAPBOX_API_KEY`  | Mapbox API key for directions and geocoding  | Yes      |
| `WEATHER_API_KEY` | WeatherAPI.com API key                       | Yes      |
