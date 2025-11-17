package com.weather;

import com.google.gson.Gson;
import com.google.gson.JsonObject;
import org.glassfish.tyrus.server.Server;

import java.io.BufferedReader;
import java.io.InputStreamReader;
import java.net.HttpURLConnection;
import java.net.URL;

public class WebSocketServer {
    private static final Gson gson = new Gson();
    private static final String API_KEY = "bb03421c528c490c842112244250911"; // Replace with your OpenWeatherMap API key

    public static void main(String[] args) {
        Server server = new Server("localhost", 8080, "/ws", null, WeatherServerEndpoint.class);

        try {
            server.start();
            System.out.println("Real-Time Weather WebSocket Server Started!");
            System.out.println("Server URL: ws://localhost:8080/ws/weather");
            System.out.println("Web Dashboard: http://localhost:8080/webapp/index.html");

            // Background weather update thread
            Thread weatherUpdater = new Thread(() -> {
                WeatherDataFetcher fetcher = new WeatherDataFetcher(API_KEY);
                int updateCount = 0;

                try {
                    // Initial delay to let server stabilize
                    Thread.sleep(5000);

                    while (true) {
                        updateCount++;
                        System.out.println("\n[Update #" + updateCount + "] Fetching latest weather data...");

                        // Fetch weather for multiple cities
                        String[] cities = {"London", "New York", "Tokyo", "Paris", "Sydney", "Dubai"};

                        for (String city : cities) {
                            try {
                                JsonObject weatherData = fetcher.fetchWeatherData(city);

                                if (weatherData != null && !weatherData.has("error")) {
                                    // Create weather update message
                                    JsonObject weatherUpdate = new JsonObject();
                                    weatherUpdate.addProperty("type", "weatherUpdate");
                                    weatherUpdate.addProperty("city", city);
                                    weatherUpdate.addProperty("temperature",
                                            weatherData.getAsJsonObject("main").get("temp").getAsDouble());
                                    weatherUpdate.addProperty("description",
                                            weatherData.getAsJsonArray("weather").get(0).getAsJsonObject()
                                                    .get("description").getAsString());
                                    weatherUpdate.addProperty("humidity",
                                            weatherData.getAsJsonObject("main").get("humidity").getAsInt());
                                    weatherUpdate.addProperty("windSpeed",
                                            weatherData.getAsJsonObject("wind").get("speed").getAsDouble());
                                    weatherUpdate.addProperty("timestamp", System.currentTimeMillis());

                                    // Broadcast to all clients subscribed to this city
                                    WeatherServerEndpoint.broadcastToSubscribers(city, gson.toJson(weatherUpdate));

                                    System.out.println("  ✓ Updated weather for: " + city +
                                            " - " + weatherUpdate.get("temperature").getAsDouble() + "°C");
                                } else {
                                    System.err.println("  ✗ Failed to fetch weather for: " + city);
                                }

                                // Small delay between API calls to avoid rate limiting
                                Thread.sleep(1000);

                            } catch (Exception e) {
                                System.err.println("  ✗ Error fetching weather for " + city + ": " + e.getMessage());
                            }
                        }

                        // Send heartbeat status
                        JsonObject status = new JsonObject();
                        status.addProperty("type", "heartbeat");
                        status.addProperty("total_clients", WeatherServerEndpoint.sessions.size());
                        status.addProperty("cities_monitored", cities.length);
                        status.addProperty("timestamp", System.currentTimeMillis());
                        WeatherServerEndpoint.broadcast(gson.toJson(status));

                        System.out.println("Heartbeat sent - Active clients: " +
                                WeatherServerEndpoint.sessions.size());

                        // Wait 30 seconds before next update
                        Thread.sleep(30000);
                    }
                } catch (InterruptedException e) {
                    System.out.println("Weather update thread interrupted.");
                } catch (Exception e) {
                    System.err.println("Error in weather update thread: " + e.getMessage());
                    e.printStackTrace();
                }
            });

            weatherUpdater.setDaemon(false);
            weatherUpdater.start();

            System.out.println("Background weather update thread started.");
            System.out.println("Press Enter to stop the server...\n");

            // Wait for user input to stop server
            new BufferedReader(new InputStreamReader(System.in)).readLine();

            System.out.println("\nStopping server...");
            weatherUpdater.interrupt();

        } catch (Exception e) {
            System.err.println("Server error: " + e.getMessage());
            e.printStackTrace();
        } finally {
            server.stop();
            System.out.println("Server stopped.");
        }
    }
}