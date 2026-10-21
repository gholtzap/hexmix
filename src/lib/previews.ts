export const sitePreviews = {
  avenlo: {
    slug: "avenlo",
    name: "Avenlo",
    url: "/render/avenlo",
    colors: { text: "#0c0a09", background: "#ffffff", primary: "#ff6467", secondary: "#fbf9f5", accent: "#db4f51" },
  },
  tervix: {
    slug: "tervix",
    name: "Tervix",
    url: "/render/tervix",
    colors: { text: "#ededec", background: "#0a0a0a", primary: "#7a9e7e", secondary: "#6bb0c0", accent: "#d4a574" },
  },
  orvian: {
    slug: "orvian",
    name: "Orvian",
    url: "/render/orvian",
    colors: { text: "#d6d6d6", background: "#161010", primary: "#e95863", secondary: "#262323", accent: "#f6a767" },
  },
  nuvexa: {
    slug: "nuvexa",
    name: "Nuvexa",
    url: "/render/nuvexa",
    colors: { text: "#1d1d1b", background: "#ffffff", primary: "#ff4f21", secondary: "#eeede6", accent: "#66c2ea" },
  },
} as const;

export const dashboardPaths={chatbot:'/dashboards/ai-chatbot',infra:'/dashboards/infra-dashboard'} as const;
export function siteIdForSlug(slug:string){return (Object.keys(sitePreviews) as (keyof typeof sitePreviews)[]).find(id=>sitePreviews[id].slug===slug);}
