export default async function handler(req, res) {
  try {
    const response = await fetch('https://streamed.su/api/streams', {
      method: 'GET',
      headers: { 'Accept': 'application/json' }
    });
    if (!response.ok) {
      return res.status(response.status).json({ error: `API request failed with status ${response.status}` });
    }
    const data = await response.json();
    res.status(200).json(data);
  } catch (error) {
    res.status(500).json({ error: 'Failed to fetch streams: ' + error.message });
  }
}
