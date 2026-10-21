export async function clickToolbarAction(page, name) {
  const button = page.getByRole('button', {name, exact: true});
  if (await button.isVisible()) return button.click();
  await page.getByRole('button', {name: 'More tools', exact: true}).click();
  return page.getByRole('menuitem', {name, exact: true}).click();
}
