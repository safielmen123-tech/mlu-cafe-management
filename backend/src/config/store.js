/**
 * Official business profile & branding for Romdoul Restaurant & Cafe.
 * Used by AI domain context, weather defaults, and system labels.
 */
const STORE = {
  officialName: 'Romdoul Restaurant & Cafe',
  shortName: 'Romdoul',
  location: 'Siem Reap, Cambodia',
  address: 'Makara St, Krong Siem Reap',
  phone: 'Tel: 099 333 225',
  domainContext:
    'Siem Reap tourist & local market — early morning tourist coffee spikes, midday food orders, and an international/local customer mix.',
  // Approximate city center (Siem Reap) for OpenWeather / macro signals
  weather: {
    lat: '13.3633',
    lon: '103.8564',
    city: 'Siem Reap',
  },
}

module.exports = { STORE }
