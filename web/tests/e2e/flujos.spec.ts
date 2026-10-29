import { expect, test } from "@playwright/test";

// Pruebas funcionales de punta a punta sobre la aplicación compilada (npm run build).

test.describe("HU-12 · panel de stock (SCRUM-22)", () => {
  test("muestra lo registrado, lo detectado y la diferencia", async ({ page }) => {
    await page.goto("/dashboard");
    const resumen = page.getByRole("region", { name: "Resumen de stock" });
    await expect(resumen.getByText("Según el sistema")).toBeVisible();
    await expect(resumen.getByText("Según la cámara")).toBeVisible();
    await expect(resumen.getByText("Diferencia")).toBeVisible();
  });

  test("abre la foto de evidencia de un movimiento", async ({ page }) => {
    await page.goto("/dashboard");
    const lista = page.getByRole("region", { name: "Últimos movimientos" });
    await lista.getByRole("button").first().click();
    await expect(page.getByRole("dialog")).toBeVisible();
  });
});

test.describe("HU-13 · línea de tiempo con galería (SCRUM-23)", () => {
  test("lista los movimientos agrupados por día con hora, sentido y zona", async ({ page }) => {
    await page.goto("/movimientos");
    await expect(page.getByRole("heading", { name: "Línea de tiempo de movimientos" })).toBeVisible();
    await expect(page.getByRole("heading", { level: 2 }).first()).toContainText("movimientos");
    const primero = page.locator("ol ol > li button").first();
    await expect(primero).toContainText(/\d{1,2}:\d{2}/);
    await expect(primero).toContainText(/Entrada|Salida/);
    await expect(primero).toContainText(/Zona/);
  });

  test("el filtro de sentido deja solo entradas", async ({ page }) => {
    await page.goto("/movimientos");
    await expect(page.locator("ol ol > li").first()).toBeVisible();
    const t0 = Date.now();
    await page.getByLabel("Sentido").selectOption("entrada");
    await expect(page.getByText(/· ↑ 0 salidas/)).toBeVisible();
    expect(Date.now() - t0).toBeLessThan(2000);
    await expect(page.locator("ol ol > li button", { hasText: "Salida ·" })).toHaveCount(0);
  });

  test("la galería se recorre con el teclado y se cierra con Escape", async ({ page }) => {
    await page.goto("/movimientos");
    await page.locator("ol ol > li button").first().click();
    const galeria = page.getByRole("dialog", { name: "Galería de evidencias" });
    await expect(galeria).toBeVisible();
    await expect(galeria.getByText(/^1 de \d+$/)).toBeVisible();
    await page.keyboard.press("ArrowRight");
    await expect(galeria.getByText(/^2 de \d+$/)).toBeVisible();
    await page.keyboard.press("ArrowLeft");
    await expect(galeria.getByText(/^1 de \d+$/)).toBeVisible();
    await page.keyboard.press("Escape");
    await expect(galeria).toBeHidden();
  });
});
