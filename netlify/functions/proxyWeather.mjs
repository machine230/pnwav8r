import fetch from 'node-fetch';

export async function handler(event) {
    const icao = event.queryStringParameters.icao || 'KBFI';
    const token = 'Ld0Z9WEaR9yaouqQqIFqJnalxQRXIGQ5oyFLJ6_DeD4';

    try {
        const headers = {
            'Authorization': `Bearer ${token}`,
            'Accept': 'application/json'
        };

        const metarRes = await fetch(`https://avwx.rest/api/metar/${icao}?options=info,translate&format=json`, { headers });
        const tafRes = await fetch(`https://avwx.rest/api/taf/${icao}?options=info,translate&format=json`, { headers });

        if (!metarRes.ok || !tafRes.ok) {
            return {
                statusCode: 500,
                headers: {
                    'Access-Control-Allow-Origin': '*',
                    'Access-Control-Allow-Headers': 'Content-Type'
                },
                body: 'Failed to fetch data from AVWX'
            };
        }

        const metarData = await metarRes.json();
        const tafData = await tafRes.json();

        return {
            statusCode: 200,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: JSON.stringify({
                rawMetar: metarData.raw || 'No METAR Raw Data',
                metar: metarData.sanitized || 'No METAR Decoded',
                taf: tafData.sanitized || 'No TAF'
            })
        };
    } catch (error) {
        return {
            statusCode: 500,
            headers: {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type'
            },
            body: `Error: ${error.message}`
        };
    }
}
