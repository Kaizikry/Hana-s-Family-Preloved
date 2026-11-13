import { BasketIcon, Hanger } from "../components/ui";
import { config, isDemo } from "../config";
import { money, toWhatsAppNumber } from "../lib/format";
import type { Route } from "../lib/route";
import { generalMessage, whatsappUrl } from "../lib/whatsapp";
import { useStore } from "../store";
import { BasketDrawer } from "./BasketDrawer";
import { Catalog } from "./Catalog";
import { Checkout } from "./Checkout";
import { InfoPage } from "./InfoPages";
import { ItemPage } from "./ItemPage";
import { ThankYou } from "./ThankYou";

const PAGE_LINKS = [
  ["#/saiz", "Panduan saiz"],
  ["#/gred", "Gred keadaan"],
  ["#/polisi", "Polisi"],
  ["#/tentang", "Tentang kami"],
] as const;

export function Shop({ route, query }: { route: Route; query: string }) {
  const { count, total, lines, whatsappNumber, setBasketOpen } = useStore();
  const browsing = route.name === "catalog" || route.name === "item";
  const askUrl = whatsappNumber ? whatsappUrl(toWhatsAppNumber(whatsappNumber), generalMessage(config.shopName)) : "";

  return (
    <>
      {isDemo && (
        <div className="demo-note"><p className="container">Pratonton: nama, harga dan stok ini contoh sahaja sehingga kedai disambungkan ke Google Sheet.</p></div>
      )}
      <header className="site-header">
        <div className="container site-header-inner">
          <a className="wordmark" href="#/"><Hanger />{config.shopName}</a>
          <div className="nav-actions">
            {askUrl && <a className="basket-link" href={askUrl} target="_blank" rel="noreferrer" aria-label={`Tanya ${config.ownerName} di WhatsApp`}>Tanya<span className="nav-owner"> {config.ownerName}</span></a>}
            <button type="button" className="basket-link" aria-label={`Bakul, ${count} item`} onClick={() => setBasketOpen(true)}>
              <BasketIcon /> <span className="nav-word">Bakul</span> <span className="count">{count}</span>
            </button>
          </div>
        </div>
      </header>

      <main>
        {route.name === "item" ? <ItemPage id={route.id} />
          : route.name === "checkout" ? <Checkout />
          : route.name === "thanks" ? <ThankYou />
          : route.name === "info" ? <InfoPage page={route.page} />
          : <Catalog query={query} />}
      </main>

      <footer className="site-footer">
        <div className="container site-footer-inner">
          <p className="colophon">
            <strong>{config.shopName}</strong>, {config.pickupArea}.
          </p>
          <nav className="colophon-links" aria-label="Maklumat kedai">
            {PAGE_LINKS.map(([href, label]) => <a key={href} href={href}>{label}</a>)}
            <a href="#/admin">Log masuk admin</a>
          </nav>
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
