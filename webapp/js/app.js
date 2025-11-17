class WeatherDashboard {
    constructor() {
        this.ws = null;
        this.subscribedCities = new Set();
        this.availableCities = [];
        this.isConnected = false;
        this.messageCount = 0;
        this.lastHeartbeat = null;

        this.initializeWebSocket();
        this.setupEventListeners();
        this.startClock();
    }

    initializeWebSocket() {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//${window.location.host}/ws/weather`;

        console.log('Connecting to WebSocket:', wsUrl);
        this.ws = new WebSocket(wsUrl);

        this.ws.onopen = () => {
            console.log('✅ WebSocket connected successfully');
            this.isConnected = true;
            this.updateConnectionStatus(true, 'Connected to weather server');
        };

        this.ws.onmessage = (event) => {
            this.messageCount++;
            this.updateMessageCount();

            try {
                const message = JSON.parse(event.data);
                this.handleMessage(message);
            } catch (error) {
                console.error('❌ Error parsing message:', error);
            }
        };

        this.ws.onclose = (event) => {
            console.log('🔌 WebSocket disconnected:', event.code, event.reason);
            this.isConnected = false;
            this.updateConnectionStatus(false, 'Disconnected - Attempting to reconnect...');

            // Attempt to reconnect after 3 seconds
            setTimeout(() => {
                if (!this.isConnected) {
                    console.log('🔄 Attempting to reconnect...');
                    this.initializeWebSocket();
                }
            }, 3000);
        };

        this.ws.onerror = (error) => {
            console.error('❌ WebSocket error:', error);
            this.isConnected = false;
            this.updateConnectionStatus(false, 'Connection error');
        };
    }

    handleMessage(message) {
        switch (message.type) {
            case 'welcome':
                this.handleWelcome(message);
                break;
            case 'weatherUpdate':
                this.handleWeatherUpdate(message);
                break;
            case 'subscriptionConfirmed':
                this.handleSubscriptionConfirmed(message);
                break;
            case 'heartbeat':
                this.handleHeartbeat(message);
                break;
            case 'pong':
                console.log('🏓 Pong received');
                break;
            default:
                console.log('📨 Unknown message type:', message.type, message);
        }
    }

    handleWelcome(message) {
        console.log('👋 Welcome message received:', message);
        this.availableCities = Object.keys(message.availableCities || {});
        this.renderCityButtons();
        this.updateConnectionStatus(true, 'Connected - Ready to subscribe to cities');
    }

    handleWeatherUpdate(weatherData) {
        const city = weatherData.city;

        // Create or update weather card
        if (!document.getElementById(`weather-${city}`)) {
            this.createWeatherCard(city);
        }

        this.updateWeatherCard(weatherData);

        // Visual feedback for update
        this.highlightUpdate(city);
    }

    handleSubscriptionConfirmed(message) {
        const city = message.city;
        const subscribed = message.subscribed;

        if (subscribed) {
            this.subscribedCities.add(city);
            this.updateCityButton(city, true);

            if (!document.getElementById(`weather-${city}`)) {
                this.createWeatherCard(city);
            }
        } else {
            this.subscribedCities.delete(city);
            this.updateCityButton(city, false);
        }

        console.log(`📋 Subscription ${subscribed ? 'confirmed' : 'removed'} for: ${city}`);
    }

    handleHeartbeat(heartbeat) {
        this.lastHeartbeat = new Date(heartbeat.timestamp);
        this.updateStats(heartbeat);
        console.log('💓 Heartbeat received:', heartbeat);
    }

    renderCityButtons() {
        const container = document.getElementById('cityButtons');
        container.innerHTML = '';

        this.availableCities.forEach(city => {
            const button = document.createElement('button');
            button.className = 'city-btn';
            button.id = `btn-${city}`;
            button.innerHTML = `
                <div>📍</div>
                <div>${city}</div>
                <div class="subscription-status">Click to subscribe</div>
            `;

            button.onclick = () => this.toggleSubscription(city);

            container.appendChild(button);
        });
    }

    updateCityButton(city, subscribed) {
        const button = document.getElementById(`btn-${city}`);
        if (button) {
            const statusElement = button.querySelector('.subscription-status');

            if (subscribed) {
                button.classList.add('subscribed');
                statusElement.textContent = 'Subscribed ✓';
                statusElement.style.color = 'white';
            } else {
                button.classList.remove('subscribed');
                statusElement.textContent = 'Click to subscribe';
                statusElement.style.color = '';
            }
        }
    }

    toggleSubscription(city) {
        if (this.subscribedCities.has(city)) {
            this.unsubscribeFromCity(city);
        } else {
            this.subscribeToCity(city);
        }
    }

    subscribeToCity(city) {
        this.sendMessage({
            type: 'subscribe',
            city: city
        });
    }

    unsubscribeFromCity(city) {
        this.sendMessage({
            type: 'unsubscribe',
            city: city
        });

        // Remove weather card after a delay
        setTimeout(() => {
            const card = document.getElementById(`weather-${city}`);
            if (card) {
                card.remove();
            }
            this.updateEmptyState();
        }, 300);
    }

    createWeatherCard(city) {
        const grid = document.getElementById('weatherGrid');

        // Remove "no data" message if it exists
        const noData = grid.querySelector('.no-data');
        if (noData) {
            noData.remove();
        }

        const card = document.createElement('div');
        card.className = 'weather-card';
        card.id = `weather-${city}`;

        card.innerHTML = `
            <div class="weather-header">
                <div class="weather-city">${city}</div>
                <div class="weather-status">Loading...</div>
            </div>
            <div class="weather-main">
                <div class="temperature">--°C</div>
                <div class="weather-icon">🌤</div>
            </div>
            <div class="weather-description">Fetching latest data...</div>
            <div class="weather-details">
                <div class="detail-item">
                    <div class="detail-label">Humidity</div>
                    <div class="detail-value" id="humidity-${city}">--%</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Wind Speed</div>
                    <div class="detail-value" id="wind-${city}">-- m/s</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Feels Like</div>
                    <div class="detail-value" id="feelslike-${city}">--°C</div>
                </div>
                <div class="detail-item">
                    <div class="detail-label">Pressure</div>
                    <div class="detail-value" id="pressure-${city}">-- hPa</div>
                </div>
            </div>
            <div class="last-update" id="time-${city}">Last update: Never</div>
        `;

        grid.appendChild(card);
    }

    updateWeatherCard(weatherData) {
        const { city, temperature, description, humidity, windSpeed, timestamp } = weatherData;
        const card = document.getElementById(`weather-${city}`);

        if (!card) return;

        // Update basic info
        const tempElement = card.querySelector('.temperature');
        const descElement = card.querySelector('.weather-description');
        const statusElement = card.querySelector('.weather-status');

        if (tempElement) tempElement.textContent = `${Math.round(temperature)}°C`;
        if (descElement) descElement.textContent = description.charAt(0).toUpperCase() + description.slice(1);
        if (statusElement) statusElement.textContent = 'Live';

        // Update details
        this.updateElement(`humidity-${city}`, `${humidity}%`);
        this.updateElement(`wind-${city}`, `${windSpeed} m/s`);

        // Update timestamp
        const timeElement = document.getElementById(`time-${city}`);
        if (timeElement) {
            const date = new Date(timestamp);
            timeElement.textContent = `Last update: ${date.toLocaleTimeString()}`;
        }

        // Update weather icon based on description
        this.updateWeatherIcon(card, description);
    }

    updateElement(id, value) {
        const element = document.getElementById(id);
        if (element) {
            element.textContent = value;
        }
    }

    updateWeatherIcon(card, description) {
        const iconElement = card.querySelector('.weather-icon');
        if (!iconElement) return;

        const desc = description.toLowerCase();
        let icon = '🌤'; // default

        if (desc.includes('clear')) icon = '☀️';
        else if (desc.includes('cloud')) icon = '☁️';
        else if (desc.includes('rain')) icon = '🌧';
        else if (desc.includes('storm')) icon = '⛈';
        else if (desc.includes('snow')) icon = '❄️';
        else if (desc.includes('fog') || desc.includes('mist')) icon = '🌫';
        else if (desc.includes('wind')) icon = '💨';

        iconElement.textContent = icon;
    }

    highlightUpdate(city) {
        const card = document.getElementById(`weather-${city}`);
        if (card) {
            card.style.transform = 'scale(1.02)';
            card.style.boxShadow = '0 8px 32px rgba(102, 126, 234, 0.3)';

            setTimeout(() => {
                card.style.transform = '';
                card.style.boxShadow = '';
            }, 500);
        }
    }

    updateConnectionStatus(connected, message) {
        const statusDot = document.getElementById('statusDot');
        const statusText = document.getElementById('statusText');

        if (connected) {
            statusDot.className = 'status-dot connected';
            statusText.textContent = message;
            statusText.style.color = '#4CAF50';
        } else {
            statusDot.className = 'status-dot disconnected';
            statusText.textContent = message;
            statusText.style.color = '#f44336';
        }
    }

    updateStats(heartbeat) {
        this.updateElement('connectedClients', heartbeat.total_clients || 0);
        this.updateElement('citiesMonitored', heartbeat.cities_monitored || 0);
        this.updateElement('messageCount', this.messageCount);

        if (this.lastHeartbeat) {
            this.updateElement('lastUpdate', this.lastHeartbeat.toLocaleTimeString());
        }
    }

    updateMessageCount() {
        this.updateElement('messageCount', this.messageCount);
    }

    updateEmptyState() {
        const grid = document.getElementById('weatherGrid');
        if (grid.children.length === 0) {
            grid.innerHTML = `
                <div class="no-data">
                    <h3>No cities subscribed yet</h3>
                    <p>Click on city buttons above to start receiving real-time weather updates</p>
                </div>
            `;
        }
    }

    sendMessage(message) {
        if (this.isConnected && this.ws && this.ws.readyState === WebSocket.OPEN) {
            this.ws.send(JSON.stringify(message));
        } else {
            console.error('❌ Cannot send message - WebSocket not connected');
            this.updateConnectionStatus(false, 'Cannot send message - Connection lost');
        }
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            document.getElementById('serverTime').textContent = now.toLocaleTimeString();
        }, 1000);
    }

    setupEventListeners() {
        // Handle page visibility change
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && !this.isConnected) {
                console.log('🔄 Page visible - reconnecting WebSocket...');
                this.initializeWebSocket();
            }
        });

        // Send ping every 30 seconds to keep connection alive
        setInterval(() => {
            if (this.isConnected) {
                this.sendMessage({ type: 'ping' });
            }
        }, 30000);
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Weather Dashboard...');
    window.weatherDashboard = new WeatherDashboard();
});

// Export for potential debugging
if (typeof module !== 'undefined' && module.exports) {
    module.exports = WeatherDashboard;
}