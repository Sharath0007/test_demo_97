const { test, expect } = require('../../fixtures/walker_fixture.js');
import testData from '../../test-data.json';

test("Test case id: TC-0120 - sign in with email and navigate to Product Items  @regression", async ({ page }) => {
  await page.goto(testData.url);
  await page.waitForLoadState('domcontentloaded');

  const signInWithEmailButton = page.getByRole('button', { name: 'Sign in with Email' });
  await expect(signInWithEmailButton).toBeEnabled();
  await signInWithEmailButton.click();

  const emailInput = page.locator("xpath=//input[@name='email']");
  await expect(emailInput).toBeEditable();
  await emailInput.fill(testData.email);

  const passwordInput = page.locator("xpath=//input[@name='password']");
  await expect(passwordInput).toBeEditable();
  await passwordInput.fill(testData.password);

  const signInWithEmailButtonAfterFill = page.getByRole('button', { name: 'Sign in with Email' });
  await expect(signInWithEmailButtonAfterFill).toBeEnabled();
  await signInWithEmailButtonAfterFill.click();

  const itemsSidebarButton = page.locator("xpath=//nav[@data-cy='sidebarDesktop']//button[contains(concat(' ', normalize-space(@class), ' '), ' overflow-hidden ') and normalize-space(.)='Items']");
  await expect(itemsSidebarButton).toBeEnabled();
  await itemsSidebarButton.click();

  const productItemsLink = page.getByRole('link', { name: 'Product Items' });
  await expect(productItemsLink).toBeEnabled();
  await productItemsLink.click();

});
