// Predefined options for Vertex AI locations and model IDs

// Google Cloud regions where Vertex AI is available
export const locationOptions = [
  // Americas
  { value: "us-central1", label: "US Central (Iowa)" },
  { value: "us-east1", label: "US East (South Carolina)" },
  { value: "us-east4", label: "US East (Northern Virginia)" },
  { value: "us-east5", label: "US East (Columbus, Ohio)" },
  { value: "us-west1", label: "US West (Oregon)" },
  { value: "us-west2", label: "US West (Los Angeles, California)" },
  { value: "us-west3", label: "US West (Salt Lake City, Utah)" },
  { value: "us-west4", label: "US West (Las Vegas, Nevada)" },
  { value: "us-south1", label: "US South (Dallas, Texas)" },
  { value: "northamerica-northeast1", label: "North America Northeast (Montreal, Canada)" },
  { value: "northamerica-northeast2", label: "North America Northeast (Toronto, Canada)" },
  { value: "southamerica-east1", label: "South America East (São Paulo, Brazil)" },
  { value: "southamerica-west1", label: "South America West (Santiago, Chile)" },

  // Europe
  { value: "europe-central2", label: "Europe Central (Warsaw, Poland)" },
  { value: "europe-north1", label: "Europe North (Finland)" },
  { value: "europe-southwest1", label: "Europe Southwest (Madrid, Spain)" },
  { value: "europe-west1", label: "Europe West (Belgium)" },
  { value: "europe-west2", label: "Europe West (London, UK)" },
  { value: "europe-west3", label: "Europe West (Frankfurt, Germany)" },
  { value: "europe-west4", label: "Europe West (Netherlands)" },
  { value: "europe-west6", label: "Europe West (Zürich, Switzerland)" },
  { value: "europe-west8", label: "Europe West (Milan, Italy)" },
  { value: "europe-west9", label: "Europe West (Paris, France)" },
  { value: "europe-west12", label: "Europe West (Turin, Italy)" },

  // Asia Pacific
  { value: "asia-east1", label: "Asia East (Taiwan)" },
  { value: "asia-east2", label: "Asia East (Hong Kong)" },
  { value: "asia-northeast1", label: "Asia Northeast (Tokyo, Japan)" },
  { value: "asia-northeast2", label: "Asia Northeast (Osaka, Japan)" },
  { value: "asia-northeast3", label: "Asia Northeast (Seoul, South Korea)" },
  { value: "asia-south1", label: "Asia South (Mumbai, India)" },
  { value: "asia-southeast1", label: "Asia Southeast (Singapore)" },
  { value: "asia-southeast2", label: "Asia Southeast (Jakarta, Indonesia)" },
  { value: "australia-southeast1", label: "Australia Southeast (Sydney)" },
  { value: "australia-southeast2", label: "Australia Southeast (Melbourne)" },

  // Middle East
  { value: "me-central1", label: "Middle East Central (Doha, Qatar)" },
  { value: "me-central2", label: "Middle East Central (Dammam, Saudi Arabia)" },
  { value: "me-west1", label: "Middle East West (Tel Aviv, Israel)" },

  // Africa
  { value: "africa-south1", label: "Africa South (Johannesburg, South Africa)" },
];

// Vertex AI Gemini model IDs
export const modelIdOptions = [
  // Placed at the top as requested
  { value: "gemini-2.5-pro-exp-03-25", label: "Gemini 2.5 Pro Experimental (03-25)" },

  // Other Gemini models
  { value: "gemini-2.5-pro-preview-03-25", label: "Gemini 2.5 Pro Preview (03-25)" },
  { value: "gemini-2.5-flash-preview-04-17", label: "Gemini 2.5 Flash Preview (04-17)" },
  { value: "gemini-2.0-pro-exp-02-05", label: "Gemini 2.0 Pro Experimental (02-05)" },
  { value: "gemini-2.0-flash", label: "Gemini 2.0 Flash" },
  { value: "gemini-2.0-flash-001", label: "Gemini 2.0 Flash 001" },
  { value: "gemini-2.0-flash-lite", label: "Gemini 2.0 Flash Lite" },
  { value: "gemini-2.0-flash-lite-001", label: "Gemini 2.0 Flash Lite 001" },
  { value: "gemini-2.0-flash-exp", label: "Gemini 2.0 Flash Experimental" },
  { value: "gemini-2.0-flash-exp-image-generation", label: "Gemini 2.0 Flash Experimental (Image Generation)" },
  { value: "gemini-2.0-flash-thinking-exp-01-21", label: "Gemini 2.0 Flash Thinking Experimental (01-21)" },
  { value: "gemini-embedding-exp", label: "Gemini Embedding Experimental" },
  { value: "gemini-embedding-exp-03-07", label: "Gemini Embedding Experimental (03-07)" },
];
