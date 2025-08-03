export async function handler(event) {
    const icao = event.queryStringParameters.icao || 'KBFI';
    const token = 'QzUO0o8Jaw_lFWryxZVMtn2SrI5t5dcD8BsbR-kBEqY';

    try {
        const metarRes = await fetch(`https://avwx.rest/api/metar/${icao}?options=info,translate&format=json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        const tafRes = await fetch(`https://avwx.rest/api/taf/${icao}?options=info,translate&format=json`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });

        if (!metarRes.ok || !tafRes.ok) {
            return { statusCode: 500, body: 'Failed to fetch data from AVWX' };
        }

        const metarData = await metarRes.json();
        const tafData = await tafRes.json();

        return {
            statusCode: 200,
            body: JSON.stringify({
                rawMetar: metarData.Raw || 'No METAR Raw Data',
                metar: metarData.Sanitized || 'No METAR Decoded',
                taf: tafData.Sanitized || 'No TAF'
            })
        };
    } catch (error) {
        return { statusCode: 500, body: `Error: ${error.message}` };
    }
}

