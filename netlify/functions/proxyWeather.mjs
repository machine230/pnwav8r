// netlify/functions/proxyWeather.js
exports.handler = async (event, context) => {
  // Enable CORS
  const headers = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
  };

  // Handle preflight requests
  if (event.httpMethod === 'OPTIONS') {
    return {
      statusCode: 200,
      headers,
      body: ''
    };
  }

  try {
    const { icao } = event.queryStringParameters;
    
    if (!icao) {
      return {
        statusCode: 400,
        headers,
        body: JSON.stringify({ error: 'ICAO code is required' })
      };
    }

    // Clean up ICAO code
    const cleanIcao = icao.toUpperCase().trim();
    
    // Fetch METAR data from Aviation Weather Center
    const metarUrl = `https://aviationweather.gov/api/data/metar?ids=${cleanIcao}&format=json&taf=false&hours=3&bbox=40,-130,45,-110`;
    const tafUrl = `https://aviationweather.gov/api/data/taf?ids=${cleanIcao}&format=json&hours=12&bbox=40,-130,45,-110`;
    
    // Fetch both METAR and TAF data
    const [metarResponse, tafResponse] = await Promise.all([
      fetch(metarUrl),
      fetch(tafUrl)
    ]);
    
    const metarData = await metarResponse.json();
    const tafData = await tafResponse.json();
    
    // Process the data
    const weatherData = processWeatherData(cleanIcao, metarData, tafData);
    
    return {
      statusCode: 200,
      headers,
      body: JSON.stringify(weatherData)
    };
    
  } catch (error) {
    console.error('Weather fetch error:', error);
    
    return {
      statusCode: 500,
      headers,
      body: JSON.stringify({ 
        error: 'Unable to fetch weather data',
        details: error.message 
      })
    };
  }
};

function processWeatherData(icao, metarData, tafData) {
  // Get the most recent METAR
  const metar = metarData && metarData.length > 0 ? metarData[0] : null;
  const taf = tafData && tafData.length > 0 ? tafData[0] : null;
  
  // Extract airport name from METAR data or use default
  const name = getAirportName(icao);
  
  const weatherInfo = {
    name,
    icao,
    metar: metar ? metar.rawOb : `${icao} METAR data not available`,
    taf: taf ? taf.rawTAF : `${icao} TAF data not available`,
    decoded: {
      conditions: 'Data processing...',
      visibility: 'Unknown',
      wind: 'Unknown', 
      temperature: 'Unknown',
      altimeter: 'Unknown'
    },
    tafDecoded: {
      valid: 'Unknown',
      forecast: 'Data processing...'
    }
  };
  
  // Decode METAR if available
  if (metar) {
    weatherInfo.decoded = decodeMetar(metar);
  }
  
  // Decode TAF if available
  if (taf) {
    weatherInfo.tafDecoded = decodeTaf(taf);
  }
  
  return weatherInfo;
}

function decodeMetar(metar) {
  const decoded = {
    conditions: 'Clear',
    visibility: 'Unknown',
    wind: 'Unknown',
    temperature: 'Unknown', 
    altimeter: 'Unknown'
  };
  
  try {
    const raw = metar.rawOb;
    
    // Extract wind information
    const windMatch = raw.match(/(\d{3})(\d{2,3})(G\d{2,3})?KT/);
    if (windMatch) {
      const direction = windMatch[1];
      const speed = windMatch[2];
      const gust = windMatch[3] ? ` gusting ${windMatch[3].replace('G', '')}` : '';
      decoded.wind = `${direction}° at ${speed} knots${gust}`;
    }
    
    // Extract visibility
    const visMatch = raw.match(/(\d{1,2})SM|(\d{4})/);
    if (visMatch) {
      if (visMatch[1]) {
        decoded.visibility = `${visMatch[1]} statute miles`;
      } else if (visMatch[2] && parseInt(visMatch[2]) > 50) {
        const vis = parseInt(visMatch[2]) / 1609.34; // Convert meters to miles
        decoded.visibility = `${vis.toFixed(1)} statute miles`;
      }
    }
    
    // Extract temperature and dewpoint
    const tempMatch = raw.match(/M?(\d{2})\/M?(\d{2})/);
    if (tempMatch) {
      let temp = parseInt(tempMatch[1]);
      let dewpoint = parseInt(tempMatch[2]);
      
      // Handle negative temperatures (M prefix)
      if (raw.includes(`M${tempMatch[1]}/`)) temp = -temp;
      if (raw.includes(`/M${tempMatch[2]}`)) dewpoint = -dewpoint;
      
      const tempF = Math.round((temp * 9/5) + 32);
      const dewpointF = Math.round((dewpoint * 9/5) + 32);
      
      decoded.temperature = `${temp}°C / ${dewpoint}°C dewpoint (${tempF}°F / ${dewpointF}°F)`;
    }
    
    // Extract altimeter
    const altMatch = raw.match(/A(\d{4})/);
    if (altMatch) {
      const alt = parseInt(altMatch[1]) / 100;
      decoded.altimeter = `${alt.toFixed(2)} inHg`;
    }
    
    // Decode sky conditions
    const skyConditions = [];
    const skyMatches = raw.match(/(SKC|CLR|FEW|SCT|BKN|OVC)(\d{3})?/g);
    if (skyMatches) {
      skyMatches.forEach(match => {
        const condition = match.replace(/\d{3}/, '');
        const height = match.match(/\d{3}/);
        
        let description = '';
        switch(condition) {
          case 'SKC':
          case 'CLR': description = 'Clear'; break;
          case 'FEW': description = 'Few clouds'; break;
          case 'SCT': description = 'Scattered clouds'; break;  
          case 'BKN': description = 'Broken clouds'; break;
          case 'OVC': description = 'Overcast'; break;
        }
        
        if (height && description !== 'Clear') {
          const heightFt = parseInt(height[0]) * 100;
          description += ` at ${heightFt.toLocaleString()} ft`;
        }
        
        if (description) skyConditions.push(description);
      });
    }
    
    if (skyConditions.length > 0) {
      decoded.conditions = skyConditions.join(', ');
    }
    
  } catch (error) {
    console.error('METAR decode error:', error);
  }
  
  return decoded;
}

function decodeTaf(taf) {
  const decoded = {
    valid: 'Unknown',
    forecast: 'Data available in raw format'
  };
  
  try {
    const raw = taf.rawTAF;
    
    // Extract validity period
    const validMatch = raw.match(/\d{6}Z\s+\d{4}\/\d{4}/);
    if (validMatch) {
      decoded.valid = validMatch[0].replace(/(\d{2})(\d{2})(\d{2})Z\s+(\d{2})(\d{2})\/(\d{2})(\d{2})/, 
        'From $4:$5Z to $6:$7Z on day $1/$2');
    }
    
    // Basic forecast interpretation
    if (raw.includes('VFR')) {
      decoded.forecast = 'VFR conditions expected';
    } else if (raw.includes('IFR')) {
      decoded.forecast = 'IFR conditions possible';
    } else if (raw.includes('MVFR')) {
      decoded.forecast = 'Marginal VFR conditions possible';
    } else {
      decoded.forecast = 'Check raw TAF for detailed forecast';
    }
    
  } catch (error) {
    console.error('TAF decode error:', error);
  }
  
  return decoded;
}

function getAirportName(icao) {
  const airportNames = {
    'KSEA': 'Seattle-Tacoma International',
    'KBFI': 'Boeing Field/King County International', 
    'KPAE': 'Snohomish County (Paine Field)',
    'KBVS': 'Skagit Regional',
    'KAWO': 'Arlington Municipal',
    'KTCM': 'McChord Field',
    'KOLM': 'Olympia Regional',
    'KGRF': 'Gray Army Airfield',
    'KHQM': 'Bowerman Airport',
    'KUIL': 'Quillayute',
    'KCLM': 'William R. Fairchild International'
  };
  
  return airportNames[icao] || 'Unknown Airport';
}