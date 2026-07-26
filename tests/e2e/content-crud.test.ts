import { expect, test } from "@playwright/test";

async function signIn(page: import("@playwright/test").Page) {
  await page.getByRole("button", { name: "Sign in", exact: true }).click();
  await page.getByPlaceholder("Enter any login").fill("local-user");
  await page.getByPlaceholder("and password").fill("local-password");
  await page.getByRole("button", { name: "Sign-in" }).click();
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page).toHaveURL("http://localhost:3100/posts/");
}

test("supports the generic content lifecycle without horizontal overflow", async ({
  page,
}, testInfo) => {
  const suffix = `${testInfo.project.name}-${Date.now()}`;
  const initialTitle = `Content ${suffix}`;
  const updatedTitle = `Updated ${suffix}`;

  await page.goto("/posts/");
  await expect(page.getByRole("heading", { name: "Content" })).toBeVisible();
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= window.innerWidth,
    ),
  ).toBe(true);

  await signIn(page);
  await page.getByRole("link", { name: "New item" }).click();
  await page.getByRole("textbox", { name: "Title" }).fill(initialTitle);
  await page
    .getByRole("textbox", { name: "Body" })
    .fill("Reusable application content");
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page).toHaveURL("http://localhost:3100/posts/");

  await page.getByRole("textbox", { name: "Search content" }).fill(suffix);
  await expect(page.getByRole("heading", { name: initialTitle })).toBeVisible();
  await page.getByRole("link", { name: `Edit ${initialTitle}` }).click();
  await expect(page.getByRole("textbox", { name: "Title" })).toHaveValue(
    initialTitle,
  );
  await page.getByRole("textbox", { name: "Title" }).fill(updatedTitle);
  await page.getByRole("button", { name: "Save item" }).click();
  await expect(page).toHaveURL("http://localhost:3100/posts/");

  await page.getByRole("textbox", { name: "Search content" }).fill(suffix);
  await expect(page.getByRole("heading", { name: updatedTitle })).toBeVisible();
  await page.getByRole("button", { name: `Delete ${updatedTitle}` }).click();
  await expect(page.getByRole("alertdialog")).toBeVisible();
  await page.getByRole("button", { name: "Delete", exact: true }).click();
  await expect(page.getByRole("heading", { name: updatedTitle })).toHaveCount(
    0,
  );
});
