const searchCompetitorReviews = async (query) => {
  // Ưu tiên Maps_API_KEY trước nếu khách hàng điền key vào đó
  const apiKey = process.env.Maps_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes('sau_nay_dien_sau') || apiKey === 'your_google_map_key_here') {
    throw new Error('Chưa cấu hình Google Maps API Key hợp lệ trong file .env (Hãy điền vào Maps_API_KEY hoặc GOOGLE_MAPS_API_KEY)');
  }

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.reviews,places.location'
  };

  try {
    const response = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({ textQuery: query })
    });

    if (!response.ok) {
      const errData = await response.json().catch(() => ({}));
      const googleMsg = errData.error?.message || response.statusText;
      console.error(`❌ Google Places Error [${response.status}]:`, googleMsg);
      throw new Error(`Google API [${response.status}]: ${googleMsg}`);
    }

    const data = await response.json();
    const firstPlace = data.places?.[0];

    if (!firstPlace) return null;

    return {
      id: firstPlace.id,
      displayName: firstPlace.displayName?.text || query,
      rating: firstPlace.rating || 0,
      userRatingCount: firstPlace.userRatingCount || 0,
      reviews: firstPlace.reviews ? firstPlace.reviews.map(r => r.text?.text).filter(Boolean) : [],
      location: firstPlace.location || null
    };
  } catch (error) {
    console.error('Lỗi searchCompetitorReviews:', error.message);
    throw error; // Throw để controller bắt và trả về message chi tiết
  }
};

const searchRadar = async (centerLocation, radius, keyword) => {
  const apiKey = process.env.Maps_API_KEY || process.env.GOOGLE_MAPS_API_KEY || process.env.GOOGLE_API_KEY;
  if (!apiKey || apiKey.includes('sau_nay_dien_sau')) throw new Error('API Key Google Maps chưa được cấu hình.');

  const url = 'https://places.googleapis.com/v1/places:searchText';
  const headers = {
    'Content-Type': 'application/json',
    'X-Goog-Api-Key': apiKey,
    'X-Goog-FieldMask': 'places.id,places.displayName,places.rating,places.userRatingCount,places.location,places.reviews'
  };

  const body = JSON.stringify({
    textQuery: keyword,
    locationRestriction: {
      circle: {
        center: {
          latitude: centerLocation.latitude || centerLocation.lat,
          longitude: centerLocation.longitude || centerLocation.lng
        },
        radius: parseInt(radius, 10) || 2000
      }
    }
  });

  try {
    const response = await fetch(url, { method: 'POST', headers, body });
    if (!response.ok) {
       const errData = await response.json().catch(() => ({}));
       throw new Error(`Google Radar API [${response.status}]: ${errData.error?.message || response.statusText}`);
    }
    
    const data = await response.json();
    return (data.places || []).map(p => ({
      id: p.id,
      displayName: p.displayName?.text || 'Unknown',
      rating: p.rating || 0,
      userRatingCount: p.userRatingCount || 0,
      location: p.location || null,
      reviews: p.reviews ? p.reviews.map(r => r.text?.text).filter(Boolean) : []
    }));
  } catch (error) {
    console.error('Lỗi searchRadar:', error.message);
    throw error;
  }
};

module.exports = {
  searchCompetitorReviews,
  searchRadar
};
