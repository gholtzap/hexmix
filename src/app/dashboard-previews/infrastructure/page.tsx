import {isPageId} from '@/components/dashboards/infrastructure/pages/registry';
import InfrastructureDashboard from '@/components/dashboards/infrastructure/InfrastructureDashboard';
export const metadata={title:'Infrastructure · Local preview'};
export default async function Page({searchParams}:{searchParams:Promise<{page?:string}>}){const {page}=await searchParams;return <InfrastructureDashboard initialPage={isPageId(page)?page:'projects'}/>;}
