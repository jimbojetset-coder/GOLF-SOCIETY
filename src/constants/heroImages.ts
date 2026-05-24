/**
 * Bundled stock golf course hero images.
 * These are sourced from Unsplash (free to use).
 * The comp organiser can override with their own photo_url on the Competition record.
 */
export const HERO_IMAGES = [
  {
    id: 'links',
    label: 'Links Course',
    uri: 'https://images.unsplash.com/photo-1587174486073-ae5e5cff23aa?w=800&q=80',
  },
  {
    id: 'parkland',
    label: 'Parkland',
    uri: 'https://images.unsplash.com/photo-1535131749006-b7f58c99034b?w=800&q=80',
  },
  {
    id: 'coastal',
    label: 'Coastal',
    uri: 'https://images.unsplash.com/photo-1560635210-d12b8a1f4c91?w=800&q=80',
  },
  {
    id: 'sunrise',
    label: 'Sunrise Fairway',
    uri: 'https://images.unsplash.com/photo-1592919505780-303950717480?w=800&q=80',
  },
  {
    id: 'aerial',
    label: 'Aerial Green',
    uri: 'https://images.unsplash.com/photo-1571055107559-3e67626fa8be?w=800&q=80',
  },
];

export const DEFAULT_HERO = HERO_IMAGES[0].uri;
