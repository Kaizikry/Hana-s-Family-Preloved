import { useEffect, useMemo, useState } from "react";
import { Photo, statusText } from "../components/ui";
import { config } from "../config";
import { applyFilters, DEFAULT_FILTERS, filtersToQuery, isFiltered, isNew, parseFilters, PRICE_RANGES, sizesOf, SORTS, type Filters } from "../lib/catalog";
import { money } from "../lib/format";
import { photoAt } from "../lib/photos";
import { itemHash } from "../lib/route";
import { useStore } from "../store";
import { CATEGORIES, CONDITIONS, coverPhoto, isAvailable, type Item } from "../types";

// A library stand-in until there is a photo of the family's own clothes.
const HERO_PHOTO = "images/photos/wooden-coat-hangers-1920.jpg";
const CATALOG_ID = "katalog";

// A button, not a link: a "#katalog" href would be read as a route by the hash router.
function showCatalog() {
  const reduce = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  document.getElementById(CATALOG_ID)?.scrollIntoView({ behavior: reduce ? "auto" : "smooth", block: "start" });
}

export function Catalog({ query }: { query: string }) {
  const { products, status, reload } = useStore();
  // The address holds the filters. They are read against the catalogue, so a size is only
  // accepted once the items it belongs to have loaded.
  const [rawQuery, setRawQuery] = useState(query);
  useEffect(() => setRawQuery(query), [query]);
  const filters = useMemo(() => parseFilters(rawQuery, products), [rawQuery, products]);

  const setFilters = (patch: Partial<Filters>) => {
    const next = filtersToQuery({ ...filters, ...patch });
    setRawQuery(next);
    // replaceState, not a hash change: filtering must not jump the page back to the top.
    window.history.replaceState(null, "", `#/${next ? `?${next}` : ""}`);
  };

  const shown = useMemo(() => applyFilters(products, filters), [products, filters]);
  const usedCategories = CATEGORIES.filter((c) => products.some((p) => p.category === c));
  const sizes = useMemo(() => sizesOf(products), [products]);
  const usedConditions = CONDITIONS.filter((c) => products.some((p) => p.condition === c));

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
              <p>Semua harga ialah anggaran. {config.ownerName} akan sahkan item dan harga melalui WhatsApp.</p>
              <input type="search" aria-label="Cari item" maxLength={60} placeholder="Cari nama, warna atau kod…" value={filters.q} onChange={(e) => setFilters({ q: e.target.value })} />
            </div>
          </div>

          {usedCategories.length > 1 && (
            <div className="tabs" role="group" aria-label="Kategori">
              {["", ...usedCategories].map((name) => (
                <button key={name || "semua"} type="button" aria-pressed={filters.category === name} onClick={() => setFilters({ category: name })}>{name || "Semua"}</button>
              ))}
            </div>
          )}

          {products.length > 0 && (
            <div className="filter-bar">
              <label className="field">
                <span>Saiz</span>
                <select value={filters.size} onChange={(e) => setFilters({ size: e.target.value })}>
                  <option value="">Semua saiz</option>
                  {sizes.map((s) => <option key={s}>{s}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Keadaan</span>
                <select value={filters.condition} onChange={(e) => setFilters({ condition: e.target.value })}>
                  <option value="">Semua keadaan</option>
                  {usedConditions.map((c) => <option key={c}>{c}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Harga</span>
                <select value={filters.price} onChange={(e) => setFilters({ price: e.target.value })}>
                  <option value="">Semua harga</option>
                  {PRICE_RANGES.map((r) => <option key={r.value} value={r.value}>{r.label}</option>)}
                </select>
              </label>
              <label className="field">
                <span>Susun</span>
                <select value={filters.sort} onChange={(e) => setFilters({ sort: e.target.value as Filters["sort"] })}>
                  {SORTS.map((s) => <option key={s.value} value={s.value}>{s.label}</option>)}
                </select>
              </label>
              <p className="filter-count" role="status">
                {shown.length} item
                {isFiltered(filters) && <button type="button" className="link-btn" onClick={() => setFilters({ ...DEFAULT_FILTERS, sort: filters.sort })}>Kosongkan penapis</button>}
              </p>
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
              <p>Tiada item yang sepadan dengan penapis ini.</p>
              <button type="button" className="btn btn-quiet" onClick={() => setFilters(DEFAULT_FILTERS)}>Lihat semua item</button>
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
  const href = itemHash(item.id);
  const available = isAvailable(item);
  const tag = available ? (isNew(item) ? "Baru" : "") : statusText(item);

  return (
    <article className={available ? "plant-card" : "plant-card is-sold"}>
      <a className="arch" href={href} tabIndex={-1} aria-hidden="true">
        <Photo src={photoAt(coverPhoto(item), 400)} alt={item.name} />
        {tag && <span className={available ? "card-tag" : "card-tag card-tag-quiet"}>{tag}</span>}
      </a>
      <div className="plant-card-title">
        <h3><a href={href}>{item.name}</a></h3>
        <strong>{money(item.price)}</strong>
      </div>
      <p className="muted">{[item.size, item.colour].filter(Boolean).join(", ")}{item.originalPrice > item.price && <> <s>{money(item.originalPrice)}</s></>}</p>
      <div className="plant-card-foot">
        <span className={available ? "muted" : "low"}>{available ? item.code : `${item.code}, ${statusText(item).toLowerCase()}`}</span>
        {available && (inBag(item.id)
          ? <button type="button" className="btn btn-quiet btn-small" onClick={() => setBasketOpen(true)}>Dalam bakul</button>
          : <button type="button" className="btn btn-quiet btn-small" onClick={() => add(item.id)} aria-label={`Tambah ${item.name}`}>Tambah</button>)}
      </div>
    </article>
  );
}
