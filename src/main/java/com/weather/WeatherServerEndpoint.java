package com.weather;

import com.google.gson.Gson;
import com.google.gson.JsonObject;

import jakarta.websocket.*;
import jakarta.websocket.server.ServerEndpoint;
import java.io.IOException;
import java.util.Collections;
import java.util.HashSet;
import java.util.Set;
import java.util.concurrent.ConcurrentHashMap;

@ServerEndpoint("/weather")
public class WeatherServerEndpoint {
    public static final Set<Session> sessions = Collections.synchronizedSet(new HashSet<>());
    private static final ConcurrentHashMap<Session, Set<String>> sessionSubscriptions = new ConcurrentHashMap<>();
    private static final Gson gson = new Gson();

    @OnOpen
    public void onOpen(Session session) {
        sessions.add(session);
        sessionSubscriptions.put(session, new HashSet<>());
        System.out.println("Client connected: " + session.getId() + " - Total: " + sessions.size());

        // Send welcome message with available cities
        JsonObject welcome = new JsonObject();
        welcome.addProperty("type", "welcome");
        welcome.addProperty("message", "Connected to Real-Time Weather Server");
        welcome.addProperty("serverTime", System.currentTimeMillis());

        String[] availableCities = {"London", "New York", "Tokyo", "Paris", "Sydney", "Dubai"};
        JsonObject cities = new JsonObject();
        for (String city : availableCities) {
            cities.addProperty(city, city);
        }
        welcome.add("availableCities", cities);

        sendToSession(session, gson.toJson(welcome));
    }

    @OnMessage
    public void onMessage(String message, Session session) {
        try {
            JsonObject jsonMessage = gson.fromJson(message, JsonObject.class);
            String type = jsonMessage.get("type").getAsString();

            switch (type) {
                case "subscribe":
                    handleSubscribe(session, jsonMessage.get("city").getAsString());
                    break;
                case "unsubscribe":
                    handleUnsubscribe(session, jsonMessage.get("city").getAsString());
                    break;
                case "ping":
                    JsonObject pong = new JsonObject();
                    pong.addProperty("type", "pong");
                    pong.addProperty("timestamp", System.currentTimeMillis());
                    sendToSession(session, gson.toJson(pong));
                    break;
            }
        } catch (Exception e) {
            System.err.println("Error processing message from " + session.getId() + ": " + e.getMessage());
        }
    }

    @OnClose
    public void onClose(Session session) {
        sessions.remove(session);
        sessionSubscriptions.remove(session);
        System.out.println("Client disconnected: " + session.getId() + " - Remaining: " + sessions.size());
    }

    @OnError
    public void onError(Session session, Throwable throwable) {
        System.err.println("Error for session " + session.getId() + ": " + throwable.getMessage());
    }

    private void handleSubscribe(Session session, String city) {
        if (city != null && !city.trim().isEmpty()) {
            sessionSubscriptions.get(session).add(city);
            System.out.println("Client " + session.getId() + " subscribed to: " + city);

            // Send subscription confirmation
            JsonObject confirmation = new JsonObject();
            confirmation.addProperty("type", "subscriptionConfirmed");
            confirmation.addProperty("city", city);
            confirmation.addProperty("subscribed", true);
            sendToSession(session, gson.toJson(confirmation));
        }
    }

    private void handleUnsubscribe(Session session, String city) {
        if (city != null) {
            sessionSubscriptions.get(session).remove(city);
            System.out.println("Client " + session.getId() + " unsubscribed from: " + city);
        }
    }

    public static void broadcast(String message) {
        synchronized (sessions) {
            for (Session session : sessions) {
                if (session.isOpen()) {
                    try {
                        session.getBasicRemote().sendText(message);
                    } catch (IOException e) {
                        System.err.println("Error broadcasting to session " + session.getId() + ": " + e.getMessage());
                    }
                }
            }
        }
    }

    public static void broadcastToSubscribers(String city, String message) {
        synchronized (sessions) {
            for (Session session : sessions) {
                Set<String> subscriptions = sessionSubscriptions.get(session);
                if (subscriptions != null && subscriptions.contains(city) && session.isOpen()) {
                    try {
                        session.getBasicRemote().sendText(message);
                    } catch (IOException e) {
                        System.err.println("Error sending to session " + session.getId() + ": " + e.getMessage());
                    }
                }
            }
        }
    }

    private void sendToSession(Session session, String message) {
        if (session.isOpen()) {
            try {
                session.getBasicRemote().sendText(message);
            } catch (IOException e) {
                System.err.println("Error sending to session " + session.getId() + ": " + e.getMessage());
            }
        }
    }
}