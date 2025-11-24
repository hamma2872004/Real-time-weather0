package com.weather;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class WeatherDataFetcher {
    private final String apiKey;
    private final Gson gson;

    public WeatherDataFetcher(String apiKey) {
        this.apiKey = apiKey;
        this.gson = new Gson();
    }

    public JsonObject fetchWeatherData(String city) {
        try {
            // URL is correct for WeatherAPI's current weather endpoint
            String urlString = "http://api.weatherapi.com/v1/current.json?key=" + apiKey + "&q=" + city + "&aqi=no";

            URL url = new URL(urlString);
            HttpURLConnection connection = (HttpURLConnection) url.openConnection();
            connection.setRequestMethod("GET");
            connection.setConnectTimeout(5000);
            connection.setReadTimeout(5000);

            int responseCode = connection.getResponseCode();

            if (responseCode == HttpURLConnection.HTTP_OK) {
                BufferedReader in = new BufferedReader(
                        new InputStreamReader(connection.getInputStream()));
                String inputLine;
                StringBuilder content = new StringBuilder();

                while ((inputLine = in.readLine()) != null) {
                    content.append(inputLine);
                }

                in.close();
                connection.disconnect();

                JsonObject response = gson.fromJson(content.toString(), JsonObject.class);

                // Check if the API returned an error
                if (response.has("error")) {
                    JsonObject error = new JsonObject();
                    error.addProperty("error", "API error: " + response.get("error").getAsJsonObject().get("message").getAsString());
                    error.addProperty("city", city);
                    return error;
                }

                return response;

            } else {
                JsonObject error = new JsonObject();
                error.addProperty("error", "HTTP error: " + responseCode);
                error.addProperty("city", city);
                return error;
            }

        } catch (Exception e) {
            JsonObject error = new JsonObject();
            error.addProperty("error", e.getMessage());
            error.addProperty("city", city);
            return error;
        }
    }
}