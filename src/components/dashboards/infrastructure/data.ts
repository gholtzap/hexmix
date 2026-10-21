export interface Project {
  team?: string;
  runtime?: string;
  repository?: string;
  name: string;
  domain: string;
  commit: string;
  time: string;
  gradient: string;
  score: number;
  connected: boolean;
  production: boolean;
  favorite?: boolean;
  v0?: boolean;
}
export function projectRepository(project: Project) { return project.repository || `design-studio/${project.name}`; }
export const projectGradients = Array.from({length:14},(_,index)=>`/dashboard-previews/infrastructure/gradients/gradient-${String(index+1).padStart(2,'0')}.png`);
export const projects: Project[] = [
  {name:'acme-web',domain:'acme-web.example.com',commit:'Connect Git Repository',time:'28m ago',gradient:projectGradients[8],score:17,connected:false,production:true},
  {name:'atlas-commerce',domain:'atlas.example.com',commit:'Update the product collection page (#10)',time:'1d ago',gradient:projectGradients[1],score:50,connected:true,production:true},
  {name:'studio-portfolio',domain:'studio-portfolio.example.com',commit:'No Production Deployment',time:'Oct 12',gradient:projectGradients[5],score:50,connected:false,production:false},
  {name:'orbit',domain:'orbit.example.com',commit:'Improve the project search experience (#86)',time:'Oct 12',gradient:projectGradients[9],score:50,connected:true,production:true},
  {name:'personal-site',domain:'jamie.example.com',commit:'Update the project gallery',time:'Oct 11',gradient:projectGradients[10],score:0,connected:true,production:true},
  {name:'postbox',domain:'postbox.example.com',commit:'Add a new email template',time:'Oct 11',gradient:projectGradients[4],score:50,connected:true,production:true},
  {name:'garden',domain:'garden.example.com',commit:'Connect Git Repository',time:'Oct 11',gradient:projectGradients[12],score:0,connected:false,production:true},
  {name:'folio',domain:'folio.example.com',commit:'Add UI checks to the build (#39)',time:'Oct 10',gradient:projectGradients[13],score:50,connected:true,production:true},
  {name:'canvas',domain:'canvas.example.com',commit:'Add UI checks (#1)',time:'Oct 10',gradient:projectGradients[2],score:33,connected:true,production:false,v0:true},
  {name:'tiny-robots',domain:'tiny-robots.example.com',commit:'Add UI checks (#1)',time:'Oct 10',gradient:projectGradients[3],score:33,connected:true,production:true,v0:true},
  {name:'field-notes',domain:'field-notes.example.com',commit:'No Production Deployment',time:'Oct 3',gradient:projectGradients[6],score:50,connected:false,production:false},
  {name:'daylight',domain:'daylight.example.com',commit:'No Production Deployment',time:'Oct 3',gradient:projectGradients[0],score:50,connected:false,production:false},
  {name:'paperplane',domain:'paperplane.example.com',commit:'Update navigation',time:'Oct 2',gradient:projectGradients[11],score:50,connected:true,production:true},
  {name:'weekender',domain:'weekender.example.com',commit:'Add the home page',time:'Oct 1',gradient:projectGradients[7],score:50,connected:true,production:true},
];
export const previews = [
  {title:'Update the product collection page',project:'atlas-commerce',id:'CinkE3LJA'},
  {title:'Wait for sign-in before loading shared plans',project:'atlas-commerce',id:'G4rBFZJJH'},
  {title:'Fix account storage and preserve weekly plans',project:'atlas-commerce',id:'DwNhc2AaS'},
  {title:'Update the studio portfolio',project:'studio-portfolio',id:'5ywy2ZXD8'},
  {title:'Improve the project search experience',project:'orbit',id:'AnnoLLCA4'},
  {title:'Add a new project gallery',project:'personal-site',id:'7Hbs2zocB'},
  {title:'Update the home page layout',project:'folio',id:'C2g6pukHd'},
];
