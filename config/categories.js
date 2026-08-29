// Each category has:
// - searchTerm: exactly what gets sent to Google as a search phrase
// - pitchAngle: which message-drafting style to use (see messageDrafter.js)
//   'general' = website/automation pitch for local businesses (gyms, salons, etc.)
//   'contentAutomation' = pitch specifically for the content calendar system,
//   aimed at people who already post content and would want it automated

module.exports = [
  {
    name: 'Gyms/Fitness',
    searchTerm: 'gym or fitness center in Nigeria',
    pitchAngle: 'general',
  },
  {
    name: 'Boutiques/Retail',
    searchTerm: 'boutique or clothing store in Nigeria',
    pitchAngle: 'general',
  },
  {
    name: 'Restaurants/Food',
    searchTerm: 'restaurant in Nigeria',
    pitchAngle: 'general',
  },
  {
    name: 'Salons/Beauty',
    searchTerm: 'hair salon or beauty spa in Nigeria',
    pitchAngle: 'general',
  },
  {
    name: 'Marketing/Content Agencies',
    searchTerm: 'social media marketing agency or digital marketing agency in Nigeria',
    pitchAngle: 'contentAutomation',
  },
];

