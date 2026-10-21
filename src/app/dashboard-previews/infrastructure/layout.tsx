import localFont from 'next/font/local';
import './infrastructure.css';
const geist=localFont({src:'../../../../public/dashboard-previews/infrastructure/assets/geist.woff2',display:'swap',variable:'--infrastructure-font',weight:'100 900'});
export default function Layout({children}:{children:React.ReactNode}){return <div className={geist.variable}>{children}</div>;}
