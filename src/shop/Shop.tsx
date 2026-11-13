import { BasketIcon, Hanger } from "../components/ui";
import { config, isDemo } from "../config";
import { money } from "../lib/format";
import { useStore } from "../store";
import { BasketDrawer } from "./BasketDrawer";
import { Catalog } from "./Catalog";
import { Checkout } from "./Checkout";
import { ItemPage } from "./ItemPage";
import { ThankYou } from "./ThankYou";

const ITEM_ROUTE = "/item/";

export function Shop({ route }: { route: string }) {
  const { count, total, lines, setBasketOpen } = useStore();
  const browsing = route === "/" || route.startsWith(ITEM_ROUTE);

  return (
    <>
      {isDemo && (
        <div className="demo-note"><p className="container">Pratonton: nama, harga dan stok ini contoh sahaja sehingga kedai disambungkan ke Google Sheet.</p></div>
      )}
      <header className="site-header">
        <div className="container site-header-inner">
          <a className="wordmark" href="#/"><Hanger />{config.shopName}</a>
          <button type="button" className="basket-link" onClick={() => setBasketOpen(true)}>
            <BasketIcon /> Bakul <span className="count">{count}</span>
          </button>
        </div>
      </header>

      <main>
        {route.startsWith(ITEM_ROUTE) ? <ItemPage id={decodeURIComponent(route.slice(ITEM_ROUTE.length))} />
          : route === "/tempahan" ? <Checkout />
          : route === "/terima-kasih" ? <ThankYou />
          : <Catalog />}
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <p className="colophon">
            <strong>{config.shopName}</strong>, {config.pickupArea}.
          </p>
          <p className="colophon-links">
            <a href="#/admin">Log masuk admin</a>
          </p>
          <p className="credits" data-credits>
            Foto: <a href="https://commons.wikimedia.org/wiki/File:Wooden_coat_hangers.jpg">Mike Peel</a> (CC BY-SA 4.0, Wikimedia Commons)
          </p>
        </div>
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
