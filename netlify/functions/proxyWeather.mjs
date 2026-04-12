// Netlify serverless function — proxies NOAA aviation weather API
// Needed because NOAA doesn't send CORS headers for browser requests

const CORS = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'GET, OPTIONS',
    'Content-Type': 'application/json'
};

export const handler = async (event) => {
    if (event.httpMethod === 'OPTIONS') {
        return { statusCode: 200, headers: CORS, body: '' };
    }

    const icao = (event.queryStringParameters?.icao || '').toUpperCase().trim();

    if (!icao || icao.length < 3 || icao.length > 4) {
        return {
            statusCode: 400,
            headers: CORS,
            body: JSON.stringify({ error: 'Valid ICAO code required (3-4 characters)' })
        };
    }

    try {
        const base = 'https://aviationweather.gov/api/data';
        const [metarRes, tafRes] = await Promise.all([
            fetch(`${base}/metar?ids=${icao}&format=json&hours=2`),
            fetch(`${base}/taf?ids=${icao}&format=json`)
        ]);

        // NOAA returns 204 No Content for airports with no data — must check before parsing
        const metar = (metarRes.ok && metarRes.status !== 204) ? await metarRes.json() : [];
        const taf   = (tafRes.ok  && tafRes.status  !== 204) ? await tafRes.json()  : [];

        return {
            statusCode: 200,
            headers: CORS,
            body: JSON.stringify({ metar, taf })
        };

    } catch (err) {
        return {
            statusCode: 500,
            headers: CORS,
            body: JSON.stringify({ error: 'Failed to fetch weather data', details: err.message })
        };
    }
};
