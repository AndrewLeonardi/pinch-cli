import { getPlaygroundHtml } from "./playground.js";
import { generateToolsFile, generateDevServer, getPackageJson, getTsConfig, getGitignore, getEnvExample, getReadme } from "./server-runtime.js";
import { generateWranglerConfig } from "../lib/worker-gen.js";

export function weatherDashboardTemplate(
  name: string,
  slug: string,
  description: string,
  category: string
): Record<string, string> {
  const manifest = `[tool]
name = "${name}"
slug = "${slug}"
description = "${description}"
version = "0.1.0"
category = "${category}"
tags = ["weather", "dashboard", "api"]

[tool.mcp]
endpoint = "/mcp"
transport = "streamable-http"

[tool.pricing]
type = "free"

[[test]]
tool = "get_weather"
input = { city = "London" }
expect_type = "json"
expect_contains = "temperature"

[[test]]
tool = "get_forecast"
input = { city = "Tokyo", days = 3 }
expect_type = "json"
`;

  const toolsCode = generateToolsFile({
    helpers: `function generateWeather(city: string) {
  // Simulated weather data — replace with a real API (OpenWeatherMap, WeatherAPI, etc.)
  const conditions = ["Sunny", "Partly Cloudy", "Cloudy", "Rainy", "Stormy", "Snowy", "Windy"];
  const seed = city.split("").reduce((a, c) => a + c.charCodeAt(0), 0);
  const tempBase = ((seed * 7) % 35) + 5;
  const humidity = ((seed * 13) % 60) + 30;
  const condition = conditions[seed % conditions.length];
  const windSpeed = ((seed * 3) % 30) + 2;

  return {
    city,
    temperature: tempBase,
    unit: "celsius",
    humidity,
    condition,
    wind_speed_kmh: windSpeed,
    updated_at: new Date().toISOString(),
  };
}

function generateForecast(city: string, days: number) {
  const forecast = [];
  const baseWeather = generateWeather(city);
  for (let i = 0; i < days; i++) {
    const date = new Date();
    date.setDate(date.getDate() + i);
    const variation = ((i * 7 + 3) % 10) - 5;
    forecast.push({
      date: date.toISOString().split("T")[0],
      temperature_high: baseWeather.temperature + variation + 3,
      temperature_low: baseWeather.temperature + variation - 5,
      condition: ["Sunny", "Cloudy", "Rainy", "Partly Cloudy"][(i + baseWeather.temperature) % 4],
      precipitation_chance: Math.max(0, Math.min(100, baseWeather.humidity + variation * 5)),
    });
  }
  return { city, days, forecast };
}`,

    tools: `  server.tool(
    "get_weather",
    "Get current weather conditions for a city",
    {
      city: z.string().describe("City name (e.g., 'London', 'Tokyo', 'New York')"),
    },
    async ({ city }) => {
      const weather = generateWeather(city);
      return {
        content: [{ type: "text", text: JSON.stringify(weather, null, 2) }],
      };
    }
  );

  server.tool(
    "get_forecast",
    "Get multi-day weather forecast for a city",
    {
      city: z.string().describe("City name"),
      days: z.number().min(1).max(7).default(5).describe("Number of days (1-7)"),
    },
    async ({ city, days }) => {
      const forecast = generateForecast(city, days);
      return {
        content: [{ type: "text", text: JSON.stringify(forecast, null, 2) }],
      };
    }
  );

  server.tool(
    "compare_weather",
    "Compare weather between two cities",
    {
      city_a: z.string().describe("First city"),
      city_b: z.string().describe("Second city"),
    },
    async ({ city_a, city_b }) => {
      const a = generateWeather(city_a);
      const b = generateWeather(city_b);
      const comparison = {
        cities: [a, b],
        warmer: a.temperature > b.temperature ? city_a : city_b,
        temperature_difference: Math.abs(a.temperature - b.temperature),
      };
      return {
        content: [{ type: "text", text: JSON.stringify(comparison, null, 2) }],
      };
    }
  );`,
  });

  const uiHtml = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${name}</title>
  <link rel="stylesheet" href="styles.css">
</head>
<body>
  <div class="dashboard">
    <header>
      <h1>Weather Dashboard</h1>
      <div class="search">
        <input type="text" id="cityInput" placeholder="Enter city name..." value="London">
        <button onclick="fetchWeather()">Search</button>
      </div>
    </header>

    <div id="loading" class="loading" style="display:none">Loading...</div>

    <div id="current" class="card current-weather" style="display:none">
      <h2 id="cityName"></h2>
      <div class="temp-display">
        <span id="temp" class="temp-value"></span>
        <span class="temp-unit">&deg;C</span>
      </div>
      <div class="details">
        <div class="detail"><span class="label">Condition</span><span id="condition"></span></div>
        <div class="detail"><span class="label">Humidity</span><span id="humidity"></span></div>
        <div class="detail"><span class="label">Wind</span><span id="wind"></span></div>
      </div>
    </div>

    <div id="forecast" class="forecast-grid" style="display:none"></div>

    <div class="compare-section">
      <h3>Compare Cities</h3>
      <div class="compare-inputs">
        <input type="text" id="cityA" placeholder="City A" value="London">
        <span>vs</span>
        <input type="text" id="cityB" placeholder="City B" value="Tokyo">
        <button onclick="compareWeather()">Compare</button>
      </div>
      <div id="comparison" style="display:none"></div>
    </div>
  </div>

  <script>
    async function fetchWeather() {
      const city = document.getElementById('cityInput').value.trim();
      if (!city) return;

      document.getElementById('loading').style.display = 'block';
      document.getElementById('current').style.display = 'none';
      document.getElementById('forecast').style.display = 'none';

      try {
        const [weatherResult, forecastResult] = await Promise.all([
          window.pinch.callTool('get_weather', { city }),
          window.pinch.callTool('get_forecast', { city, days: 5 }),
        ]);

        const weather = JSON.parse(weatherResult.content[0].text);
        const forecast = JSON.parse(forecastResult.content[0].text);

        document.getElementById('cityName').textContent = weather.city;
        document.getElementById('temp').textContent = weather.temperature;
        document.getElementById('condition').textContent = weather.condition;
        document.getElementById('humidity').textContent = weather.humidity + '%';
        document.getElementById('wind').textContent = weather.wind_speed_kmh + ' km/h';
        document.getElementById('current').style.display = 'block';

        const grid = document.getElementById('forecast');
        grid.innerHTML = forecast.forecast.map(day =>
          '<div class="forecast-day">' +
            '<div class="day-date">' + day.date + '</div>' +
            '<div class="day-temp">' + day.temperature_high + '&deg; / ' + day.temperature_low + '&deg;</div>' +
            '<div class="day-condition">' + day.condition + '</div>' +
            '<div class="day-rain">' + day.precipitation_chance + '% rain</div>' +
          '</div>'
        ).join('');
        grid.style.display = 'grid';
      } catch (err) {
        alert('Error: ' + err.message);
      } finally {
        document.getElementById('loading').style.display = 'none';
      }
    }

    async function compareWeather() {
      const a = document.getElementById('cityA').value.trim();
      const b = document.getElementById('cityB').value.trim();
      if (!a || !b) return;

      try {
        const result = await window.pinch.callTool('compare_weather', { city_a: a, city_b: b });
        const data = JSON.parse(result.content[0].text);
        const el = document.getElementById('comparison');
        el.innerHTML =
          '<div class="compare-result">' +
            data.cities.map(c =>
              '<div class="compare-city">' +
                '<h4>' + c.city + '</h4>' +
                '<div class="compare-temp">' + c.temperature + '&deg;C</div>' +
                '<div>' + c.condition + '</div>' +
              '</div>'
            ).join('<div class="compare-vs">vs</div>') +
            '<div class="compare-verdict">' + data.warmer + ' is warmer by ' + data.temperature_difference + '&deg;C</div>' +
          '</div>';
        el.style.display = 'block';
      } catch (err) {
        alert('Error: ' + err.message);
      }
    }

    // Auto-fetch on load
    window.pinch?.ready?.then(() => fetchWeather());
  </script>
</body>
</html>`;

  const uiCss = `* { margin: 0; padding: 0; box-sizing: border-box; }

body {
  font-family: 'DM Sans', -apple-system, BlinkMacSystemFont, sans-serif;
  background: #f0ece4;
  color: #1a1a1a;
  min-height: 100vh;
}

.dashboard {
  max-width: 800px;
  margin: 0 auto;
  padding: 2rem 1.5rem;
}

header {
  text-align: center;
  margin-bottom: 2rem;
}

header h1 {
  font-size: 1.8rem;
  margin-bottom: 1rem;
}

.search {
  display: flex;
  gap: 0.5rem;
  justify-content: center;
}

.search input {
  padding: 0.6rem 1rem;
  border: 1px solid #d9d3c7;
  border-radius: 8px;
  font-size: 1rem;
  width: 250px;
  background: #fff;
}

button {
  padding: 0.6rem 1.2rem;
  background: #e8503a;
  color: white;
  border: none;
  border-radius: 8px;
  font-size: 1rem;
  cursor: pointer;
  font-weight: 600;
}

button:hover { background: #d14430; }

.loading {
  text-align: center;
  padding: 2rem;
  color: #888;
}

.card {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  margin-bottom: 1.5rem;
  border: 1px solid #d9d3c7;
}

.current-weather { text-align: center; }

.current-weather h2 {
  font-size: 1.4rem;
  margin-bottom: 0.5rem;
}

.temp-display {
  font-size: 3rem;
  font-weight: 700;
  margin: 0.5rem 0;
}

.temp-unit {
  font-size: 1.5rem;
  color: #888;
}

.details {
  display: flex;
  justify-content: center;
  gap: 2rem;
  margin-top: 1rem;
}

.detail {
  display: flex;
  flex-direction: column;
  align-items: center;
}

.detail .label {
  font-size: 0.85rem;
  color: #888;
  margin-bottom: 0.25rem;
}

.forecast-grid {
  display: grid;
  grid-template-columns: repeat(5, 1fr);
  gap: 0.75rem;
  margin-bottom: 1.5rem;
}

.forecast-day {
  background: #fff;
  border-radius: 10px;
  padding: 1rem;
  text-align: center;
  border: 1px solid #d9d3c7;
}

.day-date { font-size: 0.85rem; color: #888; margin-bottom: 0.5rem; }
.day-temp { font-size: 1.1rem; font-weight: 600; }
.day-condition { font-size: 0.85rem; margin: 0.25rem 0; }
.day-rain { font-size: 0.8rem; color: #4a90d9; }

.compare-section {
  background: #fff;
  border-radius: 12px;
  padding: 1.5rem;
  border: 1px solid #d9d3c7;
}

.compare-section h3 { margin-bottom: 1rem; }

.compare-inputs {
  display: flex;
  gap: 0.5rem;
  align-items: center;
  justify-content: center;
  margin-bottom: 1rem;
}

.compare-inputs input {
  padding: 0.5rem 0.75rem;
  border: 1px solid #d9d3c7;
  border-radius: 8px;
  width: 140px;
  background: #fff;
}

.compare-inputs span { color: #888; font-weight: 600; }

.compare-result {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 1rem;
  margin-top: 1rem;
}

.compare-city { text-align: center; }
.compare-city h4 { margin-bottom: 0.25rem; }
.compare-temp { font-size: 1.5rem; font-weight: 700; }
.compare-vs { color: #888; font-weight: 600; font-size: 1.2rem; }

.compare-verdict {
  width: 100%;
  text-align: center;
  margin-top: 0.75rem;
  padding: 0.5rem;
  background: #f8f6f2;
  border-radius: 8px;
  font-weight: 600;
  color: #e8503a;
}

@media (max-width: 600px) {
  .forecast-grid { grid-template-columns: repeat(2, 1fr); }
  .details { flex-direction: column; gap: 0.5rem; }
}`;

  return {
    "pinch.toml": manifest,
    "src/tools.ts": toolsCode,
    "src/index.ts": generateDevServer(name),
    "wrangler.toml": generateWranglerConfig(slug, name),
    "ui/index.html": uiHtml,
    "ui/styles.css": uiCss,
    "public/playground.html": getPlaygroundHtml(name, description),
    "package.json": getPackageJson(slug, description),
    "tsconfig.json": getTsConfig(),
    ".gitignore": getGitignore(),
    ".env.example": getEnvExample(),
    "README.md": getReadme(name, slug, description),
  };
}
