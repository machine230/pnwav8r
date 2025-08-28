// PNWAV8R Main JavaScript Functions

// Navigation Functions
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// Weather Functions
async function getAirportWeather(icao, element = null) {
    try {
        const weatherData = await fetchWeatherData(icao);
        
        if (element) {
            // Update specific element (for home page)
            document.getElementById(element).textContent = weatherData.metar;
        } else {
            // Redirect to weather page with airport parameter
            window.location.href = `weather.html?airport=${icao}`;
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
        if (element) {
            document.getElementById(element).textContent = 'Weather data unavailable';
        }
    }
}

// Fetch real weather data using Netlify Function
async function fetchWeatherData(icao) {
    try {
        const response = await fetch(`/.netlify/functions/proxyWeather?icao=${icao}`);
        
        if (!response.ok) {
            throw new Error(`Weather API error: ${response.status}`);
        }
        
        const data = await response.json();
        
        if (data.error) {
            throw new Error(data.error);
        }
        
        return data;
        
    } catch (error) {
        console.error('Weather fetch error:', error);
        
        // Fallback to basic error data
        return {
            name: 'Unknown Airport',
            metar: `${icao} METAR data not available - ${error.message}`,
            taf: `${icao} TAF data not available`,
            decoded: {
                conditions: 'Data not available',
                visibility: 'Unknown',
                wind: 'Unknown',
                temperature: 'Unknown',
                altimeter: 'Unknown'
            },
            tafDecoded: {
                valid: 'Unknown',
                forecast: 'Data not available'
            }
        };
    }
}

// Home page weather loading
async function loadHomeWeather() {
    try {
        // Load SEA weather
        const seaData = await fetchWeatherData('KSEA');
        const seaElement = document.getElementById('sea-metar');
        if (seaElement) {
            seaElement.textContent = seaData.metar;
        }
        
        // Load BFI weather
        const bfiData = await fetchWeatherData('KBFI');
        const bfiElement = document.getElementById('bfi-metar');
        if (bfiElement) {
            bfiElement.textContent = bfiData.metar;
        }
    } catch (error) {
        console.error('Error loading home weather:', error);
    }
}

// Weather page specific functions
function searchWeather() {
    const airportInput = document.getElementById('airportSearch');
    if (!airportInput) return;
    
    const airportCode = airportInput.value.toUpperCase().trim();
    if (airportCode && airportCode.length >= 3) {
        const icao = airportCode.length === 3 ? 'K' + airportCode : airportCode;
        displayWeatherData(icao);
    } else {
        alert('Please enter a valid airport code (3 or 4 characters)');
    }
}

async function displayWeatherData(icao) {
    const weatherDisplay = document.getElementById('weatherDisplay');
    if (!weatherDisplay) return;
    
    weatherDisplay.innerHTML = '<div class="loading">Loading weather data...</div>';
    
    try {
        const data = await fetchWeatherData(icao);
        weatherDisplay.innerHTML = `
            <div class="weather-data">
                <h3>${icao} - ${data.name}</h3>
                
                <div class="metar-section">
                    <h3>METAR</h3>
                    <div class="raw-data">${data.metar}</div>
                    <div class="decoded-data">
                        <p><strong>Conditions:</strong> ${data.decoded.conditions}</p>
                        <p><strong>Visibility:</strong> ${data.decoded.visibility}</p>
                        <p><strong>Wind:</strong> ${data.decoded.wind}</p>
                        <p><strong>Temperature:</strong> ${data.decoded.temperature}</p>
                        <p><strong>Altimeter:</strong> ${data.decoded.altimeter}</p>
                    </div>
                </div>
                
                <div class="taf-section">
                    <h3>TAF</h3>
                    <div class="raw-data">${data.taf}</div>
                    <div class="decoded-data">
                        <p><strong>Valid:</strong> ${data.tafDecoded.valid}</p>
                        <p><strong>Forecast:</strong> ${data.tafDecoded.forecast}</p>
                    </div>
                </div>
            </div>
        `;
    } catch (error) {
        weatherDisplay.innerHTML = `<div class="error">Unable to retrieve weather data for ${icao}. Please try again later.</div>`;
    }
}

// URL parameter handling for weather page
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

// Initialize weather page if airport parameter is present
function initWeatherPage() {
    const airport = getUrlParameter('airport');
    if (airport) {
        displayWeatherData(airport.toUpperCase());
        const searchInput = document.getElementById('airportSearch');
        if (searchInput) {
            searchInput.value = airport.toUpperCase();
        }
    }
}

// Utility function for form handling
function handleEnterKey(event, callback) {
    if (event.key === 'Enter') {
        callback();
    }
}

// Initialize page based on current page
document.addEventListener('DOMContentLoaded', function() {
    // Common initialization
    const airportSearch = document.getElementById('airportSearch');
    if (airportSearch) {
        airportSearch.addEventListener('keypress', function(e) {
            handleEnterKey(e, searchWeather);
        });
    }
    
    // Page-specific initialization
    if (window.location.pathname.includes('weather.html')) {
        initWeatherPage();
    } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        loadHomeWeather();
    }
});