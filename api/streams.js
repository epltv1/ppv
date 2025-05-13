export default async function handler(req, res) {
  try {
    // Fetch sports
    const sportsResponse = await fetch('https://streamed.su/api/sports', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!sportsResponse.ok) {
      console.error(`Sports API failed: Status ${sportsResponse.status}`);
      return res.status(500).json({ error: `Sports API failed with status ${sportsResponse.status}` });
    }
    let sports;
    try {
      sports = await sportsResponse.json();
    } catch (err) {
      console.error('Sports API JSON parse error:', err.message);
      return res.status(500).json({ error: 'Invalid sports data format' });
    }
    if (!Array.isArray(sports)) {
      console.error('Sports API returned non-array:', sports);
      return res.status(500).json({ error: 'Sports data is not an array' });
    }

    // Fetch matches
    const matchesResponse = await fetch('https://streamed.su/api/matches/all', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!matchesResponse.ok) {
      console.error(`Matches API failed: Status ${matchesResponse.status}`);
      return res.status(500).json({ error: `Matches API failed with status ${matchesResponse.status}` });
    }
    let matchesData;
    try {
      matchesData = await matchesResponse.json();
    } catch (err) {
      console.error('Matches API JSON parse error:', err.message);
      return res.status(500).json({ error: 'Invalid matches data format' });
    }
    if (!matchesData.matches || !Array.isArray(matchesData.matches)) {
      console.error('Matches API missing matches array:', matchesData);
      return res.status(500).json({ error: 'Matches data missing matches array' });
    }

    // Fetch streams for each match (limit to one endpoint for speed)
    const streamEndpoints = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const streams = sports.map(sport => {
      const sportMatches = matchesData.matches
        .filter(match => match.sport_id === sport.id)
        .map(async match => {
          let streamUrl = null;
          // Try only the first available stream endpoint to avoid timeout
          for (const endpoint of streamEndpoints.slice(0, 1)) {
            try {
              const streamResponse = await fetch(`https://streamed.su/api/stream/${endpoint}/${match.id}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
              });
              if (streamResponse.ok) {
                const streamData = await streamResponse.json();
                if (streamData.stream_url && typeof streamData.stream_url === 'string') {
                  streamUrl = streamData.stream_url;
                  console.log(`Stream found for match ${match.id} on ${endpoint}: ${streamUrl}`);
                  break;
                }
              }
            } catch (err) {
              console.error(`Stream ${endpoint} failed for match ${match.id}: ${err.message}`);
            }
          }

          return {
            uri_name: match.slug || match.id,
            name: match.title || match.name || 'Unknown Match',
            poster: match.poster ? `https://streamed.su/api/images/proxy/${match.poster}.webp` : 'https://via.placeholder.com/300x150?text=No+Image',
            tag: sport.name,
            viewers: match.viewers || 0,
            starts_at: match.start_time || Math.floor(Date.now() / 1000),
            always_live: 0,
            iframe: streamUrl && !streamUrl.includes('.m3u8') ? streamUrl : null,
            m3u8: streamUrl && streamUrl.includes('.m3u8') ? streamUrl : null,
            badge: match.badge ? `https://streamed.su/api/images/badge/${match.badge}.webp` : null
          };
        });

      return {
        id: sport.id,
        category: sport.name,
        always_live: 0,
        streams: sportMatches.length ? await Promise.all(sportMatches) : []
      };
    });

    const result = await Promise.all(streams);
    res.status(200).json({ success: true, streams: result });
  } catch (error) {
    console.error('Serverless function error:', error.message);
    res.status(500).json({ error: 'Failed to fetch data: ' + error.message });
  }
}
