export async function handler(event) {
    const icao = event.queryStringParameters.icao || 'KBFI';
    const token = 'Ld0Z9WEaR9yaouqQqIFqJnalxQRXIGQ5oyFLJ6_DeD4';  // <-- Your API Token

    try {
        const metarRes = await fetch(`https://avwx.rest/api/metar/${icao}?token=${token}&options=info,translate&format=json`);
        const tafRes = await fetch(`https://avwx.rest/api/taf/${icao}?token=${token}&options=info,translate&format=json`);

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
                rawMetar: metarData.Raw || 'No METAR Raw Data',
                metar: metarData.Sanitized || 'No METAR Decoded',
                taf: tafData.Sanitized || 'No TAF'
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
