class WeatherDashboard {
    constructor() {
        this.ws = null;
        this.subscribedCities = new Set();
        this.availableCities = [];
        this.isConnected = false;
        this.messageCount = 0;
        this.lastHeartbeat = null;
        this.reconnectAttempts = 0;
        this.maxReconnectAttempts = 5;

        this.initializeWebSocket();
        this.setupEventListeners();
        this.startClock();
        this.updateEmptyState();
    }

    initializeWebSocket() {
        // Use your server's WebSocket URL
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const wsUrl = `${protocol}//localhost:8080/ws/weather`;

        console.log('Connecting to WebSocket:', wsUrl);

        try {
            this.ws = new WebSocket(wsUrl);

            this.ws.onopen = () => {
                console.log('✅ WebSocket connected successfully');
                this.isConnected = true;
                this.reconnectAttempts = 0;
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
                this.attemptReconnect();
            };

            this.ws.onerror = (error) => {
                console.error('❌ WebSocket error:', error);
                this.isConnected = false;
                this.updateConnectionStatus(false, 'Connection error');
            };

        } catch (error) {
            console.error('❌ Failed to create WebSocket connection:', error);
            this.attemptReconnect();
        }
    }

    attemptReconnect() {
        if (this.reconnectAttempts < this.maxReconnectAttempts) {
            this.reconnectAttempts++;
            const delay = Math.min(1000 * Math.pow(2, this.reconnectAttempts), 30000);

            console.log(`🔄 Reconnection attempt ${this.reconnectAttempts}/${this.maxReconnectAttempts} in ${delay}ms`);

            setTimeout(() => {
                if (!this.isConnected) {
                    this.initializeWebSocket();
                }
            }, delay);
        } else {
            console.error('❌ Max reconnection attempts reached');
            this.updateConnectionStatus(false, 'Failed to connect to server');
        }
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
        console.log('🌤 Weather update received:', weatherData);
        const city = weatherData.city;

        // Create or update weather card
        if (!document.getElementById(`weather-${city}`)) {
            this.createWeatherCard(city);
        }

        this.updateWeatherCard(weatherData);
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

            // Remove weather card after a delay
            setTimeout(() => {
                const card = document.getElementById(`weather-${city}`);
                if (card) {
                    card.remove();
                }
                this.updateEmptyState();
            }, 300);
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
        if (!container) {
            console.error('❌ cityButtons container not found');
            return;
        }

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
    }

    createWeatherCard(city) {
        const grid = document.getElementById('weatherGrid');
        if (!grid) {
            console.error('❌ weatherGrid container not found');
            return;
        }

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
            <button class="unsubscribe-btn" onclick="weatherDashboard.unsubscribeFromCity('${city}')">
                Unsubscribe
            </button>
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
        if (descElement) descElement.textContent = this.capitalizeFirstLetter(description);
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

    capitalizeFirstLetter(string) {
        return string.charAt(0).toUpperCase() + string.slice(1);
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

        if (statusDot && statusText) {
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
        if (grid && grid.children.length === 0) {
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
            return true;
        } else {
            console.error('❌ Cannot send message - WebSocket not connected');
            this.updateConnectionStatus(false, 'Cannot send message - Connection lost');
            return false;
        }
    }

    startClock() {
        setInterval(() => {
            const now = new Date();
            const timeElement = document.getElementById('serverTime');
            if (timeElement) {
                timeElement.textContent = now.toLocaleTimeString();
            }
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

        // Handle manual reconnect button
        const reconnectBtn = document.getElementById('reconnectBtn');
        if (reconnectBtn) {
            reconnectBtn.addEventListener('click', () => {
                this.reconnectAttempts = 0;
                this.initializeWebSocket();
            });
        }
    }
}

// Initialize the dashboard when the page loads
document.addEventListener('DOMContentLoaded', () => {
    console.log('🚀 Initializing Weather Dashboard...');
    window.weatherDashboard = new WeatherDashboard();
});

// Add CSS styles dynamically
const addStyles = () => {
    const styles = `
    .status-dot {
        width: 12px;
        height: 12px;
        border-radius: 50%;
        display: inline-block;
        margin-right: 8px;
    }
    
    .status-dot.connected {
        background-color: #4CAF50;
    }
    
    .status-dot.disconnected {
        background-color: #f44336;
    }
    
    .city-btn {
        padding: 12px 16px;
        border: 2px solid #e0e0e0;
        border-radius: 8px;
        background: white;
        cursor: pointer;
        transition: all 0.3s ease;
        text-align: center;
    }
    
    .city-btn:hover {
        border-color: #2196F3;
    }
    
    .city-btn.subscribed {
        background: #2196F3;
        color: white;
        border-color: #2196F3;
    }
    
    .subscription-status {
        font-size: 0.8em;
        margin-top: 4px;
    }
    
    .weather-card {
        background: white;
        border-radius: 12px;
        padding: 20px;
        box-shadow: 0 4px 6px rgba(0, 0, 0, 0.1);
        transition: all 0.3s ease;
        border: 2px solid transparent;
    }
    
    .weather-card:hover {
        border-color: #2196F3;
    }
    
    .weather-header {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .weather-city {
        font-size: 1.5em;
        font-weight: bold;
    }
    
    .weather-status {
        padding: 4px 8px;
        background: #4CAF50;
        color: white;
        border-radius: 12px;
        font-size: 0.8em;
    }
    
    .weather-main {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 16px;
    }
    
    .temperature {
        font-size: 3em;
        font-weight: bold;
    }
    
    .weather-icon {
        font-size: 3em;
    }
    
    .weather-description {
        text-align: center;
        font-size: 1.2em;
        margin-bottom: 16px;
        text-transform: capitalize;
    }
    
    .weather-details {
        display: grid;
        grid-template-columns: 1fr 1fr;
        gap: 12px;
        margin-bottom: 16px;
    }
    
    .detail-item {
        display: flex;
        justify-content: space-between;
        padding: 8px;
        background: #f5f5f5;
        border-radius: 6px;
    }
    
    .last-update {
        text-align: center;
        font-size: 0.9em;
        color: #666;
        margin-bottom: 12px;
    }
    
    .unsubscribe-btn {
        width: 100%;
        padding: 8px 16px;
        background: #f44336;
        color: white;
        border: none;
        border-radius: 6px;
        cursor: pointer;
        transition: background 0.3s ease;
    }
    
    .unsubscribe-btn:hover {
        background: #d32f2f;
    }
    
    .no-data {
        text-align: center;
        padding: 40px;
        color: #666;
    }
    
    #cityButtons {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
        gap: 12px;
        margin-bottom: 24px;
    }
    
    #weatherGrid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
        gap: 20px;
    }
    `;

    const styleSheet = document.createElement('style');
    styleSheet.textContent = styles;
    document.head.appendChild(styleSheet);
};

// Add styles when DOM is loaded
document.addEventListener('DOMContentLoaded', addStyles);