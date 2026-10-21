export async function clickToolbarAction(page, name) {
  const button = page.getByRole('button', {name, exact: true});
  if (await button.isVisible()) return activate(button);
  await openToolsMenu(page);
  return activate(page.getByRole('menuitem', {name, exact: true}));
}

export async function openSiteSwitcher(page) {
  const trigger = page.getByRole('button', {name: /^Switch site:/});
  await trigger.waitFor({state:'visible',timeout:10000}).catch(()=>{});
  if (await trigger.isVisible()) return activate(trigger);
  await openToolsMenu(page);
  await activate(page.getByRole('menuitem', {name: 'Previews', exact: true}));
}

async function openToolsMenu(page) {
  const close = page.getByRole('button', {name: /^Close (color picker|palettes)$/});
  if (await close.isVisible()) await activate(close);
  await activate(page.getByRole('button', {name: 'More tools', exact: true}));
}

async function activate(control) {
  if (await control.evaluate(() => matchMedia('(pointer: coarse)').matches)) await control.tap();
  else await control.click();
}
