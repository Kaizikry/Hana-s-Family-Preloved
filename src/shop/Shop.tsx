import { BasketIcon, Hanger } from "../components/ui";
import { config, isDemo } from "../config";
import { money } from "../lib/format";
import { useStore } from "../store";
import { BasketDrawer } from "./BasketDrawer";
import { Catalog } from "./Catalog";
import { Checkout } from "./Checkout";
import { PlantPage } from "./PlantPage";
import { ThankYou } from "./ThankYou";

const ITEM_ROUTE = "/item/";

export function Shop({ route }: { route: string }) {
  const { count, total, lines, setBasketOpen } = useStore();
  const browsing = route === "/" || route.startsWith(ITEM_ROUTE);

  return (
    <>
      {isDemo && (
        <p className="demo-note">Pratonton: nama, harga dan stok ini contoh sahaja sehingga kedai disambungkan ke Google Sheet.</p>
      )}
      <header className="site-header">
        <a className="wordmark" href="#/"><Hanger />{config.shopName}</a>
        <button type="button" className="basket-link" onClick={() => setBasketOpen(true)}>
          <BasketIcon /> Bakul <span className="count">{count}</span>
        </button>
      </header>

      <main>
        {route.startsWith(ITEM_ROUTE) ? <PlantPage id={decodeURIComponent(route.slice(ITEM_ROUTE.length))} />
          : route === "/tempahan" ? <Checkout />
          : route === "/terima-kasih" ? <ThankYou />
          : <Catalog />}
      </main>

      <footer className="site-footer">
        <span>{config.shopName} · {config.pickupArea}</span>
        <a href="#/admin">Log masuk admin</a>
      </footer>

      {browsing && lines.length > 0 && (
        <button type="button" className="basket-float" onClick={() => setBasketOpen(true)}>
          <BasketIcon /> {count} item <strong>{money(total)}</strong>
        </button>
      )}
      <BasketDrawer />
    </>
  );
}
