export default async function handler(req, res) {
  try {
    // Fetch sports
    const sportsResponse = await fetch('https://streamed.su/api/sports', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!sportsResponse.ok) {
      return res.status(sportsResponse.status).json({ error: `Sports API failed with status ${sportsResponse.status}` });
    }
    const sports = await sportsResponse.json();

    // Fetch matches
    const matchesResponse = await fetch('https://streamed.su/api/matches/all', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!matchesResponse.ok) {
      return res.status(matchesResponse.status).json({ error: `Matches API failed with status ${matchesResponse.status}` });
    }
    const matchesData = await matchesResponse.json();

    // Fetch streams for each match
    const streamEndpoints = ['alpha', 'bravo', 'charlie', 'delta', 'echo', 'foxtrot'];
    const streams = sports.map(sport => {
      const sportMatches = matchesData.matches
        .filter(match => match.sport_id === sport.id)
        .map(async match => {
          let streamUrl = null;
          // Try each stream endpoint until a valid URL is found
          for (const endpoint of streamEndpoints) {
            try {
              const streamResponse = await fetch(`https://streamed.su/api/stream/${endpoint}/${match.id}`, {
                method: 'GET',
                headers: { 'Accept': 'application/json' }
              });
              if (streamResponse.ok) {
                const streamData = await streamResponse.json();
                if (streamData.stream_url) {
                  streamUrl = streamData.stream_url;
                  break;
                }
              }
            } catch (err) {
              // Continue to next endpoint if one fails
              console.error(`Stream ${endpoint} failed for match ${match.id}: ${err.message}`);
            }
          }

          return {
            uri_name: match.slug,
            name: match.title,
            poster: match.poster ? `https://streamed.su/api/images/proxy/${match.poster}.webp` : 'https://via.placeholder.com/300x150?text=No+Image',
            tag: sport.name,
            viewers: match.viewers || 0,
            starts_at: match.start_time,
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
        streams: await Promise.all(sportMatches)
      };
    });

    res.status(200).json({ success: true, streams: await Promise.all(streams) });
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch data: ' + error.message });
  }
}
