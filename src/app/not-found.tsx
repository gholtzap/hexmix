import Link from 'next/link';
export default function NotFound() {
  return <main className="route-recovery"><h1>Choose a page to continue</h1><p>This address has no page. Your color tools and previews are available below.</p><nav aria-label="Continue browsing"><Link href="/">Browse all previews</Link><Link href="/editor">Open color editor</Link><Link href="/dashboards/infrastructure">Open dashboard</Link></nav></main>;
}
