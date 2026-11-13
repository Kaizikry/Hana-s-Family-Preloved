import { useMemo, useState } from "react";
import { Photo, statusText } from "../components/ui";
import { config } from "../config";
import { money } from "../lib/format";
import { useStore } from "../store";
import { CATEGORIES, coverPhoto, isAvailable, type Item } from "../types";

// A library stand-in until there is a photo of the family's own clothes.
const HERO_PHOTO = "images/photos/wooden-coat-hangers-1920.jpg";
const CATALOG_ID = "katalog";

// A button, not a link: a "#katalog" href would be read as a route by the hash router.
function showCatalog() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(CATALOG_ID)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function Catalog() {
  const { products, status, reload } = useStore();
  const [category, setCategory] = useState("Semua");
  const [query, setQuery] = useState("");

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter(
      (p: Item) => (category === "Semua" || p.category === category) && (!q || `${p.name} ${p.colour} ${p.brand} ${p.code}`.toLowerCase().includes(q)),
    );
  }, [products, category, query]);

  const usedCategories = CATEGORIES.filter((c) => products.some((p: Item) => p.category === c));

  return (
    <>
      <section className="hero">
        <div className="container hero-inner">
          <figure className="hero-photo" data-slot="hero" data-alt="Pakaian keluarga sendiri, tergantung atau berlipat, dalam cahaya siang">
            <img src={HERO_PHOTO} width={1920} height={1986} alt="Penyangkut baju kayu bertindan di atas rak kayu" fetchPriority="high" />
          </figure>
          <div className="hero-text">
            <h1>Dari almari kami, sedia untuk almari anda.</h1>
            <div className="hero-side">
              <p className="lead">Pilih pakaian, masukkan ke bakul, dan hantar satu pertanyaan terus ke WhatsApp {config.ownerName}.</p>
              <button type="button" className="btn btn-primary" onClick={showCatalog}>Lihat pakaian</button>
            </div>
          </div>
        </div>
      </section>

      <div className="pickup-band">
        <p className="container pickup-band-inner">
          <strong>Ambil sendiri di {config.pickupArea}</strong>
          <span>{config.pickupHours}</span>
        </p>
      </div>

      <section className="catalog" id={CATALOG_ID} aria-label="Katalog pakaian">
        <div className="container">
          <div className="catalog-head">
            <h2>Katalog pakaian</h2>
            <div className="catalog-tools">
              <p>Semua harga ialah anggaran. {config.ownerName} akan sahkan stok dan harga melalui WhatsApp.</p>
              <input type="search" aria-label="Cari item" placeholder="Cari nama, warna atau kod…" value={query} onChange={(e) => setQuery(e.target.value)} />
            </div>
          </div>

          {usedCategories.length > 1 && (
            <div className="tabs" role="group" aria-label="Kategori">
              {["Semua", ...usedCategories].map((name) => (
                <button key={name} type="button" aria-pressed={category === name} onClick={() => setCategory(name)}>{name}</button>
              ))}
            </div>
          )}

          {status === "loading" && products.length === 0 && <p className="notice" role="status">Sedang memuatkan item, sekejap ya.</p>}

          {status === "error" && (
            <div className="notice" role="alert">
              <p>Senarai item tidak dapat dimuatkan. Semak sambungan internet anda dan cuba lagi.</p>
              <button type="button" className="btn" onClick={reload}>Cuba lagi</button>
            </div>
          )}

          {status === "ready" && products.length === 0 && <p className="notice">Belum ada item disenaraikan. Sila datang semula nanti.</p>}

          {products.length > 0 && shown.length === 0 && (
            <div className="notice">
              <p>Tiada item dengan nama itu.</p>
              <button type="button" className="btn btn-quiet" onClick={() => { setQuery(""); setCategory("Semua"); }}>Lihat semua item</button>
            </div>
          )}

          <ul className="plant-grid">
            {shown.map((item) => <li key={item.id}><ItemCard item={item} /></li>)}
          </ul>
        </div>
      </section>
    </>
  );
}

function ItemCard({ item }: { item: Item }) {
  const { inBag, add, setBasketOpen } = useStore();
  const href = `#/item/${encodeURIComponent(item.id)}`;
  const available = isAvailable(item);

  return (
    <article className={available ? "plant-card" : "plant-card is-sold"}>
      <a className="arch" href={href} tabIndex={-1} aria-hidden="true"><Photo src={coverPhoto(item)} alt={item.name} /></a>
      <div className="plant-card-title">
        <h3><a href={href}>{item.name}</a></h3>
        <strong>{money(item.price)}</strong>
      </div>
      <p className="muted">{[item.size, item.colour].filter(Boolean).join(", ")}</p>
      <div className="plant-card-foot">
        <span className={available ? "muted" : "low"}>{available ? item.code : statusText(item)}</span>
        {available && (inBag(item.id)
          ? <button type="button" className="btn btn-quiet btn-small" onClick={() => setBasketOpen(true)}>Dalam bakul</button>
          : <button type="button" className="btn btn-quiet btn-small" onClick={() => add(item.id)} aria-label={`Tambah ${item.name}`}>Tambah</button>)}
      </div>
    </article>
  );
}
