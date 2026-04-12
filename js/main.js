// PNWAV8R Main JavaScript Functions

// Navigation Functions
function toggleMobileMenu() {
    const navMenu = document.getElementById('navMenu');
    navMenu.classList.toggle('active');
}

// AVWX API Configuration
const AVWX_TOKEN = 'Ld0Z9WEaR9yaouqCqIFqJnaIxQRXIGQ5oyFLJ6_DeD4';
const AVWX_BASE_URL = 'https://avwx.rest/api';

// Fetch weather data using AVWX API
async function fetchWeatherData(icao) {
    try {
        const headers = {
            'Authorization': `TOKEN ${AVWX_TOKEN}`,
            'Content-Type': 'application/json'
        };
        
        const [metarResponse, tafResponse] = await Promise.all([
            fetch(`${AVWX_BASE_URL}/metar/${icao}`, { headers }),
            fetch(`${AVWX_BASE_URL}/taf/${icao}`, { headers })
        ]);
        
        let metarData = null;
        let tafData = null;
        
        if (metarResponse.ok) {
            metarData = await metarResponse.json();
        }
        
        if (tafResponse.ok) {
            tafData = await tafResponse.json();
        }
        
        return processAVWXData(icao, metarData, tafData);
        
    } catch (error) {
        console.error('AVWX fetch error:', error);
        return getFallbackWeatherData(icao);
    }
}

function processAVWXData(icao, metarData, tafData) {
    return {
        name: getAirportName(icao),
        icao: icao,
        metar: metarData ? metarData.raw : `${icao} METAR not available`,
        taf: tafData ? tafData.raw : `${icao} TAF not available`,
        decoded: metarData ? decodeAVWXMetar(metarData) : getEmptyDecoded(),
        tafDecoded: tafData ? decodeAVWXTaf(tafData) : getEmptyTafDecoded()
    };
}

function decodeAVWXMetar(metarData) {
    try {
        const decoded = {
            conditions: 'Clear',
            visibility: 'Unknown',
            wind: 'Calm',
            temperature: 'Unknown',
            altimeter: 'Unknown'
        };
        
        // Wind information
        if (metarData.wind_direction && metarData.wind_speed) {
            const windDir = metarData.wind_direction.repr;
            const windSpeed = metarData.wind_speed.repr;
            const windGust = metarData.wind_gust ? ` gusting ${metarData.wind_gust.repr}` : '';
            decoded.wind = `${windDir}° at ${windSpeed} knots${windGust}`;
        } else if (metarData.wind_speed && metarData.wind_speed.repr === '0') {
            decoded.wind = 'Calm';
        }
        
        // Visibility
        if (metarData.visibility) {
            decoded.visibility = `${metarData.visibility.repr} statute miles`;
        }
        
        // Temperature and dewpoint
        if (metarData.temperature && metarData.dewpoint) {
            const tempC = metarData.temperature.repr;
            const dewC = metarData.dewpoint.repr;
            const tempF = Math.round((parseInt(tempC) * 9/5) + 32);
            const dewF = Math.round((parseInt(dewC) * 9/5) + 32);
            decoded.temperature = `${tempC}°C / ${dewC}°C (${tempF}°F / ${dewF}°F)`;
        }
        
        // Altimeter
        if (metarData.altimeter) {
            decoded.altimeter = `${metarData.altimeter.repr} inHg`;
        }
        
        // Sky conditions
        if (metarData.clouds && metarData.clouds.length > 0) {
            const cloudLayers = metarData.clouds.map(cloud => {
                const type = cloud.type;
                const altitude = cloud.altitude;
                let description = '';
                
                switch(type) {
                    case 'FEW': description = 'Few clouds'; break;
                    case 'SCT': description = 'Scattered clouds'; break;
                    case 'BKN': description = 'Broken clouds'; break;
                    case 'OVC': description = 'Overcast'; break;
                    default: description = type;
                }
                
                return `${description} at ${(altitude * 100).toLocaleString()} ft`;
            });
            
            decoded.conditions = cloudLayers.join(', ');
        } else if (metarData.flight_rules === 'VFR' && !metarData.clouds?.length) {
            decoded.conditions = 'Clear skies';
        }
        
        // Add flight rules info if available
        if (metarData.flight_rules) {
            decoded.conditions += ` (${metarData.flight_rules})`;
        }
        
        return decoded;
        
    } catch (error) {
        console.error('AVWX METAR decode error:', error);
        return getEmptyDecoded();
    }
}

function decodeAVWXTaf(tafData) {
    try {
        let valid = 'Unknown period';
        let forecast = 'Check raw TAF for detailed forecast';
        
        if (tafData.start_time && tafData.end_time) {
            const startTime = tafData.start_time.repr;
            const endTime = tafData.end_time.repr;
            valid = `Valid from ${startTime}Z to ${endTime}Z`;
        }
        
        if (tafData.forecast && tafData.forecast.length > 0) {
            const mainForecast = tafData.forecast[0];
            if (mainForecast.flight_rules) {
                forecast = `Primary conditions: ${mainForecast.flight_rules}`;
                
                if (mainForecast.wind_direction && mainForecast.wind_speed) {
                    forecast += ` with winds ${mainForecast.wind_direction.repr}° at ${mainForecast.wind_speed.repr} knots`;
                }
            }
        }
        
        return {
            valid: valid,
            forecast: forecast
        };
        
    } catch (error) {
        console.error('AVWX TAF decode error:', error);
        return getEmptyTafDecoded();
    }
}

function getFallbackWeatherData(icao) {
    const currentTime = new Date();
    const timeString = currentTime.toISOString().slice(8, 10) + currentTime.toISOString().slice(11, 15) + 'Z';
    
    return {
        name: getAirportName(icao),
        icao: icao,
        metar: `${icao} ${timeString} WEATHER SERVICE TEMPORARILY UNAVAILABLE`,
        taf: `${icao} TAF SERVICE TEMPORARILY UNAVAILABLE`,
        decoded: {
            conditions: 'Weather data temporarily unavailable',
            visibility: 'Check ASOS/AWOS or contact tower',
            wind: 'Verify with local sources',
            temperature: 'Use alternative weather sources',
            altimeter: 'Contact tower for current altimeter setting'
        },
        tafDecoded: {
            valid: 'N/A',
            forecast: 'Use ForeFlight, DUATS, or other certified weather sources'
        }
    };
}

function getEmptyDecoded() {
    return {
        conditions: 'Data not available',
        visibility: 'Unknown',
        wind: 'Unknown',
        temperature: 'Unknown',
        altimeter: 'Unknown'
    };
}

function getEmptyTafDecoded() {
    return {
        valid: 'Unknown',
        forecast: 'Data not available'
    };
}

function getAirportName(icao) {
    const names = {
        'KSEA': 'Seattle-Tacoma International',
        'KBFI': 'Boeing Field/King County International',
        'KRNT': 'Renton Municipal',
        'KPAE': 'Snohomish County (Paine Field)',
        'KBVS': 'Skagit Regional',
        'KAWO': 'Arlington Municipal',
        'KTCM': 'McChord Field',
        'KOLM': 'Olympia Regional',
        'KGRF': 'Gray Army Airfield',
        'KHQM': 'Bowerman Airport',
        'KUIL': 'Quillayute',
        'KCLM': 'William R. Fairchild International',
        'KTIW': 'Tacoma Narrows',
        'KCVO': 'Corvallis Municipal',
        'KPDX': 'Portland International'
    };
    return names[icao] || 'Unknown Airport';
}

// Weather page functions
async function getAirportWeather(icao, element = null) {
    try {
        const weatherData = await fetchWeatherData(icao);
        
        if (element) {
            document.getElementById(element).textContent = weatherData.metar;
        } else {
            window.location.href = `weather.html?airport=${icao}`;
        }
    } catch (error) {
        console.error('Weather fetch error:', error);
        if (element) {
            document.getElementById(element).textContent = 'Weather data unavailable';
        }
    }
}

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
                <h3>${data.icao} - ${data.name}</h3>
                
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
        weatherDisplay.innerHTML = `<div class="error">Unable to retrieve weather data for ${icao}. Please try again later or check alternative weather sources.</div>`;
    }
}

// Home page weather loading
async function loadHomeWeather() {
    try {
        const seaData = await fetchWeatherData('KSEA');
        const seaElement = document.getElementById('sea-metar');
        if (seaElement) {
            seaElement.textContent = seaData.metar;
        }
        
        const bfiData = await fetchWeatherData('KBFI');
        const bfiElement = document.getElementById('bfi-metar');
        if (bfiElement) {
            bfiElement.textContent = bfiData.metar;
        }
    } catch (error) {
        console.error('Error loading home weather:', error);
    }
}

// URL parameter handling
function getUrlParameter(name) {
    const urlParams = new URLSearchParams(window.location.search);
    return urlParams.get(name);
}

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

// Initialize page
document.addEventListener('DOMContentLoaded', function() {
    const airportSearch = document.getElementById('airportSearch');
    if (airportSearch) {
        airportSearch.addEventListener('keypress', function(e) {
            if (e.key === 'Enter') {
                searchWeather();
            }
        });
    }
    
    if (window.location.pathname.includes('weather.html')) {
        initWeatherPage();
    } else if (window.location.pathname.includes('index.html') || window.location.pathname === '/') {
        loadHomeWeather();
    }
});