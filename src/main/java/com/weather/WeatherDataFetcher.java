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
            String urlString = "http://api.openweathermap.org/data/2.5/weather?q=" +
                    city + "&appid=" + apiKey + "&units=metric";

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

                return gson.fromJson(content.toString(), JsonObject.class);

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