import { test, expect, type Page } from '@playwright/test';
async function login(page: Page, email = 'staff@example.test') {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill(email);
  await page.getByLabel('Password', { exact: true }).fill('Test-password-2026!');
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page).toHaveURL(email.startsWith('admin') ? '/admin' : '/pos');
}
async function post(page: Page, path: string, body: unknown, method = 'POST') {
  return page.evaluate(
    async ({ path, body, method }) => {
      const r = await fetch(path, {
        method,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      return { status: r.status, data: await r.json() };
    },
    { path, body, method },
  );
}
// Use the actual browser cookie jar: Chrome allows Secure cookies on trustworthy
// loopback origins, whereas Playwright's standalone HTTP client does not.
async function get(page: Page, path: string) {
  return page.evaluate(async (path) => {
    const response = await fetch(path, { cache: 'no-store' });
    return { status: response.status, data: await response.json() };
  }, path);
}
test('staff login, cart edits, save, print cancellation, next bill and reprint', async ({
  page,
  context,
}, testInfo) => {
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await login(page);
  const authCookies = (await context.cookies()).filter((c) => c.name === 'waaat-session');
  expect(authCookies.length).toBeGreaterThan(0);
  expect(authCookies.every((c) => c.httpOnly && c.sameSite === 'Lax')).toBe(true);
  const product = page.getByRole('button', { name: /Teachers 30 ml/ });
  await product.click();
  await product.click();
  await page.screenshot({ path: testInfo.outputPath('cashier-desktop.png'), fullPage: true });
  await expect(page.locator('.cart-panel .total')).toContainText('₹798');
  await page.getByRole('button', { name: 'Decrease Teachers' }).click();
  await expect(page.locator('.cart-panel .total')).toContainText('₹399');
  await page.getByRole('button', { name: 'Increase Teachers' }).click();
  await page.getByRole('button', { name: 'UPI', exact: true }).click();
  await page.reload();
  await expect(page.locator('.cart-panel .total')).toContainText('₹798');
  const popupPromise = page.waitForEvent('popup');
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  const popup = await popupPromise;
  await expect(page.getByRole('status')).toContainText('created');
  await expect(page.locator('.cart-panel .total')).toContainText('₹0');
  await expect(popup.locator('.receipt')).toContainText('WAAAT THE EVENTS');
  await expect(popup.locator('.receipt')).toContainText('₹798');
  await expect(popup.locator('.receipt')).toContainText('PLEASE DRINK RESPONSIBLY');
  await expect(popup.locator('.receipt')).toBeVisible();
  await popup.screenshot({ path: testInfo.outputPath('receipt.png'), fullPage: true });
  await popup.emulateMedia({ media: 'print' });
  await expect(popup.locator('.receipt-actions')).toBeHidden();
  await popup.close();
  await page.getByRole('link', { name: 'Reprint', exact: true }).click();
  await expect(page.locator('tbody tr').first()).toContainText('COMPLETED');
  await page.locator('tbody tr').first().getByRole('link', { name: 'View', exact: true }).click();
  await expect(page.locator('main')).toContainText('₹798');
  await expect(page.getByRole('button', { name: 'Void bill', exact: true })).toHaveCount(0);
});
test('uncertain network outcome and refresh retry recover one saved bill', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await login(page);
  await page.getByRole('button', { name: /Teachers 30 ml/ }).click();
  await page.getByRole('button', { name: 'CASH', exact: true }).click();
  let key: string | undefined;
  await page.route(
    '**/api/bills',
    async (route) => {
      if (route.request().method() === 'POST') {
        key = route.request().postDataJSON().idempotencyKey;
        await route.fetch();
        await route.abort('failed');
      } else await route.continue();
    },
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  await expect(page.getByRole('status')).toContainText('unconfirmed');
  await expect(page.getByRole('button', { name: 'Increase Teachers' })).toBeDisabled();
  await page.reload();
  await expect(page.getByRole('button', { name: 'Retry / confirm saved bill' })).toBeEnabled();
  const responsePromise = page.waitForResponse(
    (r) => r.url().endsWith('/api/bills') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Retry / confirm saved bill' }).click();
  const response = await responsePromise;
  expect(response.request().postDataJSON().idempotencyKey).toBe(key);
  await expect(page.getByRole('status')).toContainText('created');
  const saved = (await response.json()).bill;
  const history = await get(page, '/api/bills');
  expect(history.data.bills.filter((b: { id: string }) => b.id === saved.id)).toHaveLength(1);
});
test('validation keeps cart; forged totals rejected; duplicate HTTP submissions return same bill', async ({
  page,
}) => {
  await login(page);
  await page.getByRole('button', { name: /Teachers 30 ml/ }).click();
  await page.getByRole('button', { name: 'CARD', exact: true }).click();
  await page.route(
    '**/api/bills',
    (r) =>
      r.fulfill({
        status: 422,
        contentType: 'application/json',
        body: JSON.stringify({ error: 'Product is unavailable' }),
      }),
    { times: 1 },
  );
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  await expect(page.getByRole('status')).toContainText('cart has been kept');
  await expect(page.getByRole('button', { name: 'Increase Teachers' })).toBeEnabled();
  const menu = (await get(page, '/api/menu')).data;
  const input = {
    idempotencyKey: crypto.randomUUID(),
    paymentMethod: 'CARD',
    items: [{ productId: menu.categories[0].products[0].id, quantity: 1 }],
  };
  expect((await post(page, '/api/bills', { ...input, totalPaise: 1 })).status).toBe(422);
  const a = await post(page, '/api/bills', input),
    b = await post(page, '/api/bills', input);
  expect(a.status).toBe(200);
  expect(a.data.bill.id).toBe(b.data.bill.id);
});
test('STAFF denied every ADMIN API and page; ownership and unauthenticated access enforced', async ({
  page,
  browser,
}) => {
  await login(page);
  for (const path of [
    '/api/reports/daily?date=2026-09-25',
    '/api/admin/menu',
    '/api/admin/users',
    '/api/admin/settings',
    '/api/admin/audit',
  ])
    expect((await get(page, path)).status).toBe(403);
  for (const path of [
    '/api/admin/products',
    '/api/admin/categories',
    '/api/admin/users',
    `/api/bills/${crypto.randomUUID()}/void`,
  ])
    expect((await post(page, path, {})).status).toBe(403);
  await page.goto('/admin');
  await expect(page).toHaveURL('/access-denied');
  const context = await browser.newContext(),
    other = await context.newPage();
  await login(other, 'other@example.test');
  expect((await get(other, '/api/bills')).data.bills).toEqual([]);
  await context.close();
  await page.getByRole('button', { name: 'Sign out' }).click();
  await expect(page).toHaveURL('/login');
  expect((await get(page, '/api/menu')).status).toBe(401);
});
test('ADMIN menu price edit, saved snapshots, void, reports, users, branding and audit', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await login(page, 'admin@example.test');
  await page.getByRole('link', { name: 'Billing', exact: true }).click();
  await page.getByRole('button', { name: 'Cocktails', exact: true }).click();
  await page.getByRole('button', { name: /^Mojito/ }).click();
  await page.getByRole('button', { name: 'CASH', exact: true }).click();
  const saveResponse = page.waitForResponse(
    (r) => r.url().endsWith('/api/bills') && r.request().method() === 'POST',
  );
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  const bill = (await (await saveResponse).json()).bill;
  await page.getByRole('link', { name: 'Menu', exact: true }).click();
  await page.getByLabel('Find a product').fill('Mojito');
  await page.getByRole('button', { name: 'Edit', exact: true }).click();
  await page.getByLabel('Price (₹)').fill('349');
  await page.getByRole('button', { name: 'Save product' }).click();
  await expect(page.getByRole('status')).toContainText('Product saved');
  await page.goto(`/bills/${bill.id}`);
  await expect(page.locator('.total')).toContainText('₹299');
  await page.getByLabel('Reason').fill('Wrong items entered');
  await page.getByRole('button', { name: 'Void bill', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Voided', exact: true })).toBeVisible();
  await page.goto('/admin/reports');
  const date = await page.locator('input[type=date]').inputValue();
  const report = (await get(page, `/api/reports/daily?date=${date}`)).data;
  expect(report.voidCount).toBeGreaterThan(0);
  expect(BigInt(report.completedSalesPaise)).toBe(
    Object.values(report.paymentBreakdown as Record<string, string>).reduce(
      (s, v) => s + BigInt(v),
      0n,
    ),
  );
  await page.goto('/admin/settings/users');
  await page.getByLabel('Name', { exact: true }).first().fill('New Cashier');
  await page.getByLabel('Email', { exact: true }).fill('new@example.test');
  await page.getByLabel('Initial password').fill('New-password-2026!');
  await page.getByRole('button', { name: 'Create staff' }).click();
  await expect(page.getByRole('status')).toContainText('Staff account created');
  const row = page.locator('.user-row').filter({ hasText: 'new@example.test' });
  await row.getByLabel('Role').selectOption('ADMIN');
  const roleChange = page.waitForResponse(
    (r) => r.url().includes('/api/admin/users/') && r.request().method() === 'PATCH',
  );
  await row.getByRole('button', { name: 'Save user' }).click();
  expect((await roleChange).status()).toBe(200);
  await expect(row.getByLabel('Role')).toHaveValue('ADMIN');
  expect(
    (
      await (
        await get(page, '/api/admin/users')
      ).data.users.find((u: { email: string }) => u.email === 'new@example.test')
    ).role,
  ).toBe('ADMIN');
  await page.goto('/admin/settings');
  await page.getByLabel('Business display name').fill('WAAAT THE EVENTS');
  await page.getByRole('button', { name: 'Save settings' }).click();
  await expect(page.getByRole('status')).toContainText('Settings saved');
  await page.goto('/admin/audit');
  await expect(page.locator('tbody')).toContainText('PRODUCT_PRICE_CHANGED');
  await expect(page.locator('tbody')).toContainText('BILL_VOIDED');
  await expect(page.locator('tbody')).toContainText('USER_ROLE_CHANGED');
});

test('print failure and repeated clicks leave exactly one completed, reprintable bill', async ({
  page,
  context,
}) => {
  await context.addInitScript(() => {
    window.print = () => {
      throw new Error('Printer unavailable');
    };
  });
  await login(page);
  await page.getByRole('button', { name: /Teachers 30 ml/ }).click();
  await page.getByRole('button', { name: 'CARD', exact: true }).click();
  let requests = 0;
  page.on('request', (r) => {
    if (r.url().endsWith('/api/bills') && r.method() === 'POST') requests++;
  });
  const popupPromise = page.waitForEvent('popup');
  await page
    .getByRole('button', { name: 'Save & Print →' })
    .evaluate((button: HTMLButtonElement) => {
      button.click();
      button.click();
      button.click();
    });
  const popup = await popupPromise;
  await expect(page.getByRole('status')).toContainText('created');
  await expect(popup.getByRole('status')).toContainText('bill is saved');
  expect(requests).toBe(1);
  const id = new URL(popup.url()).pathname.split('/')[2];
  const result = (await get(page, `/api/bills/${id}`)).data;
  expect(result.bill.status).toBe('COMPLETED');
  await popup.getByRole('button', { name: 'Print receipt' }).click();
  expect((await get(page, `/api/bills/${id}`)).data.bill.id).toBe(id);
  await popup.close();
  await page.evaluate(() => {
    window.open = () => {
      throw new Error('Popup policy blocked window.open');
    };
  });
  await page.getByRole('button', { name: /Teachers 30 ml/ }).click();
  await page.getByRole('button', { name: 'CASH', exact: true }).click();
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  await expect(page.getByRole('status')).toContainText('Use Print receipt below');
  expect(requests).toBe(2);
});

test('stale product and expired session preserve cart and recover after sign-in', async ({
  page,
  browser,
  context,
}) => {
  await context.addInitScript(() => {
    window.print = () => {};
  });
  await login(page);
  await page.getByRole('button', { name: /Teachers 30 ml/ }).click();
  await page.getByRole('button', { name: 'CASH', exact: true }).click();
  const menu = (await get(page, '/api/menu')).data;
  const productId = menu.categories
    .flatMap((c: { products: { id: string; name: string }[] }) => c.products)
    .find((p: { name: string }) => p.name === 'Teachers').id;
  const adminContext = await browser.newContext(),
    admin = await adminContext.newPage();
  await login(admin, 'admin@example.test');
  expect(
    (await post(admin, `/api/admin/products/${productId}`, { active: false }, 'PATCH')).status,
  ).toBe(200);
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  await expect(page.getByRole('status')).toContainText('Product is unavailable');
  await expect(page.locator('.cart-panel .total')).toContainText('₹399');
  expect(
    (await post(admin, `/api/admin/products/${productId}`, { active: true }, 'PATCH')).status,
  ).toBe(200);
  await adminContext.close();
  await context.clearCookies();
  await page.getByRole('button', { name: 'Save & Print →' }).click();
  await expect(page.getByRole('status')).toContainText('sign in again');
  await login(page);
  await page.getByRole('button', { name: 'Retry / confirm saved bill' }).click();
  await expect(page.getByRole('status')).toContainText('created');
});

test('menu quarantine and category configuration require explicit admin confirmation', async ({
  page,
}) => {
  await login(page, 'admin@example.test');
  const menu = (await get(page, '/api/admin/menu')).data;
  const seasonal = menu.products.find((p: { name: string }) => p.name === 'Pepper Crab');
  expect(
    (await post(page, `/api/admin/products/${seasonal.id}`, { active: true }, 'PATCH')).status,
  ).toBe(422);
  expect(
    (
      await post(
        page,
        `/api/admin/products/${seasonal.id}`,
        { price_paise: '45000', active: true },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  const unresolved = menu.products.find(
    (p: { needs_confirmation: boolean }) => p.needs_confirmation,
  );
  expect(
    (await post(page, `/api/admin/products/${unresolved.id}`, { active: true }, 'PATCH')).status,
  ).toBe(422);
  expect(
    (
      await post(
        page,
        `/api/admin/products/${unresolved.id}`,
        { needs_confirmation: false, active: true },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  const category = await post(page, '/api/admin/categories', {
    name: 'Event specials',
    group_type: 'FOOD',
    sort_order: 100,
    active: true,
  });
  expect(category.status).toBe(200);
  const product = await post(page, '/api/admin/products', {
    name: 'Event plate',
    category_id: category.data.record.id,
    price_paise: '15000',
    unit_label: '1 serving',
    active: true,
    needs_confirmation: false,
    sort_order: 1,
  });
  expect(product.status).toBe(200);
  expect(
    (
      await post(
        page,
        `/api/admin/categories/${category.data.record.id}`,
        { active: false },
        'PATCH',
      )
    ).status,
  ).toBe(200);
  const sale = await post(page, '/api/bills', {
    idempotencyKey: crypto.randomUUID(),
    paymentMethod: 'CASH',
    items: [{ productId: product.data.record.id, quantity: 1 }],
  });
  expect(sale.status).toBe(422);
});

test('invalid credentials and cross-origin writes are rejected', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email', { exact: true }).fill('staff@example.test');
  await page.getByLabel('Password', { exact: true }).fill('Incorrect password');
  await page.getByRole('button', { name: 'Sign in →' }).click();
  await expect(page.getByRole('alert').filter({ hasText: 'Could not sign in' })).toBeVisible();
  const denied = await page.request.post('/api/auth/login', {
    headers: { origin: 'https://attacker.example' },
    data: { email: 'staff@example.test', password: 'Test-password-2026!' },
  });
  expect(denied.status()).toBe(403);
});
