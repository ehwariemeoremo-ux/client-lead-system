// Talks to Google's "Places API (New)" to search for businesses.
// Docs: https://developers.google.com/maps/documentation/places/web-service/text-search

const PLACES_SEARCH_URL = 'https://places.googleapis.com/v1/places:searchText';

// The specific fields we ask Google for, per business. Keeping this list
// tight keeps each request cheaper and faster.
const FIELD_MASK = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.internationalPhoneNumber',
  'places.websiteUri',
  'places.primaryType',
].join(',');

/**
 * Searches Google Places for a given text query (e.g. "gym in Nigeria").
 * Returns up to `limit` businesses (Google's max per request is 20).
 */
async function searchBusinesses(searchTerm, limit = 20) {
  const apiKey = process.env.GOOGLE_PLACES_API_KEY;
  if (!apiKey) {
    throw new Error('GOOGLE_PLACES_API_KEY is missing from your environment/secrets.');
  }

  const response = await fetch(PLACES_SEARCH_URL, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': FIELD_MASK,
    },
    body: JSON.stringify({
      textQuery: searchTerm,
      maxResultCount: Math.min(limit, 20),
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Places API error (${response.status}): ${errorBody}`);
  }

  const data = await response.json();
  const places = data.places || [];

  return places.map((place) => ({
    placeId: place.id,
    name: place.displayName ? place.displayName.text : 'Unknown business',
    address: place.formattedAddress || '',
    phone: place.internationalPhoneNumber || '',
    website: place.websiteUri || '',
    type: place.primaryType || '',
  }));
}

module.exports = { searchBusinesses };
