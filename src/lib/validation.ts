export function projectNameError(name: string, existing: string[]): string | null {
  if (!name) return 'Enter a name.';
  if (!/^[a-z0-9](?:[a-z0-9-]{0,62}[a-z0-9])?$/.test(name)) return 'Use 1–64 lowercase letters, digits, or -.';
  if (existing.includes(name)) return 'A project with this name already exists.';
  return null;
}

export function isDomainName(domain: string): boolean {
  return /^(?=.{1,253}$)(?:[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?\.)+[a-z]{2,63}$/i.test(domain);
}
