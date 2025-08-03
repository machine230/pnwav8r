export async function handler(event) {
    const icao = event.queryStringParameters.icao || 'KBFI';
    const token = 'Ld0Z9WEaR9yaouqQqIFqJnalxQRXIGQ5oyFLJ6_DeD4';

    try {
        const metarRes = await fetch(`https://avwx.rest/api/metar/${icao}?options=info,translate&format=json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const tafRes = await fetch(`https://avwx.rest/api/taf/${icao}?options=info,translate&format=json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const metarData = await metarRes.json();
        const tafData = await tafRes.json();

        console.log('METAR Response:', JSON.stringify(metarData));
        console.log('TAF Response:', JSON.stringify(tafData));

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
        console.error('Error:', error);
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
