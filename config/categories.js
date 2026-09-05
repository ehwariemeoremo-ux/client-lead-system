// Each category has:
// - searchTemplate: a function that builds the actual search phrase for a
//   given city, e.g. "gym or fitness center in Lagos, Nigeria"
// - pitchAngle: which message-drafting style to use (see messageDrafter.js)
//   'general' = website/automation pitch for local businesses (gyms, salons, etc.)
//   'contentAutomation' = pitch specifically for the content calendar system,
//   aimed at people who already post content and would want it automated

module.exports = [
  {
    name: 'Gyms/Fitness',
    searchTemplate: (city) => `gym or fitness center in ${city}`,
    pitchAngle: 'general',
  },
  {
    name: 'Boutiques/Retail',
    searchTemplate: (city) => `boutique or clothing store in ${city}`,
    pitchAngle: 'general',
  },
  {
    name: 'Restaurants/Food',
    searchTemplate: (city) => `restaurant in ${city}`,
    pitchAngle: 'general',
  },
  {
    name: 'Salons/Beauty',
    searchTemplate: (city) => `hair salon or beauty spa in ${city}`,
    pitchAngle: 'general',
  },
  {
    name: 'Marketing/Content Agencies',
    searchTemplate: (city) => `social media marketing agency or digital marketing agency in ${city}`,
    pitchAngle: 'contentAutomation',
  },
];


