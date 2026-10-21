export type DemoValues = { firstName: string; lastName: string; email: string; companySize: string };
export const companySizes = ['<10', '10–50', '50–200', '200–500', '500–1000', '1000+'];
const personalDomains = new Set(['gmail.com','googlemail.com','yahoo.com','yahoo.co.uk','yahoo.co.in','yahoo.fr','yahoo.de','yahoo.es','yahoo.ca','ymail.com','rocketmail.com','hotmail.com','hotmail.co.uk','hotmail.fr','hotmail.it','outlook.com','outlook.fr','live.com','live.co.uk','msn.com','aol.com','aim.com','icloud.com','me.com','mac.com','proton.me','protonmail.com','pm.me','gmx.com','gmx.net','gmx.de','mail.com','mail.ru','inbox.com','zoho.com','yandex.com','yandex.ru','fastmail.com','hey.com','tutanota.com','tuta.io','qq.com','163.com','126.com','sina.com','foxmail.com','web.de','t-online.de','orange.fr','free.fr','laposte.net']);
export function validateDemo(values: DemoValues) {
  const errors: Partial<Record<keyof DemoValues, string>> = {};
  if (!values.firstName.trim()) errors.firstName = 'Please enter your first name.';
  if (!values.lastName.trim()) errors.lastName = 'Please enter your last name.';
  const email = values.email.trim();
  if (!email) errors.email = 'Please enter your company email.';
  else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errors.email = 'Please enter a valid email address.';
  else if (personalDomains.has(email.toLowerCase().split('@')[1])) errors.email = 'Please use your company email.';
  if (!companySizes.includes(values.companySize)) errors.companySize = 'Please select your company size.';
  else if (values.companySize === '<10') errors.companySize = 'Orvian currently works best for teams of 10 or more.';
  return errors;
}
