import { useRef, useState } from "react";
import { Dialog } from "../components/Dialog";
import { Photo, statusText } from "../components/ui";
import { config } from "../config";
import { isNew } from "../lib/catalog";
import { money, toWhatsAppNumber } from "../lib/format";
import { photoAt } from "../lib/photos";
import { itemHash } from "../lib/route";
import { askMessage, whatsappUrl } from "../lib/whatsapp";
import { useStore } from "../store";
import { isAvailable, MEASUREMENTS, type Item } from "../types";

const itemLink = (id: string) => `${window.location.origin}${window.location.pathname}${itemHash(id)}`;

export function ItemPage({ id }: { id: string }) {
  const { products, status, whatsappNumber, inBag, add, setBasketOpen } = useStore();
  const item = products.find((p) => p.id === id);

  if (!item) {
    return (
      <div className="page notice">
        <p>{status === "loading" ? "Sedang memuatkan item, sekejap ya." : "Item ini tidak dijumpai. Mungkin sudah terjual lebih dua minggu lalu."}</p>
        <a className="back" href="#/">Kembali ke katalog</a>
      </div>
    );
  }

  const available = isAvailable(item);
  const measurements = MEASUREMENTS.filter(([key]) => item.measurements[key]);
  const details: [string, string][] = [
    ["Kod", item.code],
    ["Saiz", item.size],
    ["Kecacatan", item.flawNotes],
    ["Jenama", item.brand],
    ...measurements.map(([key, label]): [string, string] => [label, `${item.measurements[key]} cm`]),
  ];
  const askUrl = whatsappNumber ? whatsappUrl(toWhatsAppNumber(whatsappNumber), askMessage(config.shopName, item, itemLink(item.id))) : "";

  return (
    <div className="page">
      <a className="back" href="#/">Kembali ke katalog</a>
      <div className="plant-page">
        <Gallery photos={item.photos} name={item.name} />
        <div>
          {available && isNew(item) && <p><span className="card-tag card-tag-inline">Baru</span></p>}
          <h1>{item.name}</h1>
          {item.colour && <p className="muted">{item.colour}</p>}
          <p className="muted">{item.category}</p>
          {!available && <p className="low">{statusText(item)}</p>}
          <p className="plant-price">
            <strong>{money(item.price)}</strong> anggaran
            {item.originalPrice > item.price && <> <s>{money(item.originalPrice)}</s> harga asal</>}
          </p>
          {item.description && <p>{item.description}</p>}
          <dl className="care">
            <div><dt>Keadaan</dt><dd>{item.condition} <a className="care-link" href="#/gred">Maksud gred</a></dd></div>
            {details.filter(([, value]) => value).map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
          </dl>
          {measurements.length > 0 && <p className="muted small">Ukuran diambil dengan pakaian dibentang rata, lebih kurang 1 cm. <a href="#/saiz">Cara ukur</a></p>}
          {available && (
            <div className="add-row">
              {inBag(item.id)
                ? <button type="button" className="btn btn-quiet" onClick={() => setBasketOpen(true)}>Dalam bakul</button>
                : <button type="button" className="btn" onClick={() => { add(item.id); setBasketOpen(true); }}>Tambah ke bakul, {money(item.price)}</button>}
            </div>
          )}
          <div className="item-actions">
            {askUrl && <a className="btn btn-quiet btn-small" href={askUrl} target="_blank" rel="noreferrer">Tanya {config.ownerName}</a>}
            <ShareButton item={item} />
          </div>
          <p className="muted small">Ini pertanyaan tempahan. {config.ownerName} akan sahkan item dan harga melalui WhatsApp sebelum anda bayar.</p>
        </div>
      </div>
    </div>
  );
}

/** Swipe on a phone, thumbnails or arrow keys elsewhere, and a full-size view where pinch-zoom works. */
function Gallery({ photos, name }: { photos: string[]; name: string }) {
  const rail = useRef<HTMLDivElement>(null);
  const [active, setActive] = useState(0);
  const [zoomed, setZoomed] = useState(false);

  if (photos.length === 0) return <div className="gallery"><div className="gallery-rail"><div className="arch gallery-slide"><Photo src="" alt={name} /></div></div></div>;

  const go = (index: number) => {
    const el = rail.current;
    if (!el) return;
    // An instant jump: a smooth scroll can stall where the browser isn't drawing frames, leaving the old photo up.
    el.scrollTo({ left: index * el.clientWidth, behavior: "auto" });
    setActive(index);
  };
  const onScroll = () => {
    const el = rail.current;
    if (el && el.clientWidth) setActive(Math.min(photos.length - 1, Math.max(0, Math.round(el.scrollLeft / el.clientWidth))));
  };
  const current = photos[Math.min(active, photos.length - 1)];

  return (
    <div className="gallery">
      <div className="gallery-rail" ref={rail} tabIndex={photos.length > 1 ? 0 : -1} aria-label={`Foto ${name}`} onScroll={onScroll}>
        {photos.map((src, i) => (
          <div key={`${i}-${src.slice(-24)}`} className="arch gallery-slide">
            <Photo src={photoAt(src, 1200)} alt={photos.length > 1 ? `${name}, foto ${i + 1} daripada ${photos.length}` : name} />
          </div>
        ))}
      </div>
      <div className="gallery-foot">
        {photos.length > 1 && (
          <div className="gallery-thumbs">
            {photos.map((src, i) => (
              <button key={`${i}-${src.slice(-24)}`} type="button" aria-label={`Foto ${i + 1}`} aria-current={active === i} onClick={() => go(i)}>
                <Photo src={photoAt(src, 400)} alt="" />
              </button>
            ))}
          </div>
        )}
        <button type="button" className="link-btn" onClick={() => setZoomed(true)}>Lihat foto besar</button>
      </div>
      <Dialog open={zoomed} onClose={() => setZoomed(false)} label={`Foto besar ${name}`}>
        <div className="zoom">
          <header className="drawer-head">
            <p className="muted small">{photos.length > 1 ? `Foto ${active + 1} daripada ${photos.length}` : name}</p>
            <button type="button" className="icon-btn" onClick={() => setZoomed(false)} aria-label="Tutup">×</button>
          </header>
          <img src={photoAt(current, 2000)} alt={name} />
        </div>
      </Dialog>
    </div>
  );
}

/** The phone's own share sheet where there is one; otherwise the link is copied. */
function ShareButton({ item }: { item: Item }) {
  const [message, setMessage] = useState("");
  const url = itemLink(item.id);

  const share = async () => {
    setMessage("");
    const data = { title: `${item.code} ${item.name}`, text: `${item.name}, ${money(item.price)}`, url };
    try {
      if (navigator.share && (!navigator.canShare || navigator.canShare(data))) {
        await navigator.share(data);
        return;
      }
      await navigator.clipboard.writeText(url);
      setMessage("Pautan disalin.");
    } catch (err) {
      // Closing the share sheet is not a failure.
      if (err instanceof DOMException && err.name === "AbortError") return;
      setMessage(`Salin pautan ini: ${url}`);
    }
  };

  return (
    <>
      <button type="button" className="btn btn-quiet btn-small" onClick={share}>Kongsi</button>
      {message && <p className="muted small share-note" role="status">{message}</p>}
    </>
  );
}
