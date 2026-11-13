import { Photo, statusText } from "../components/ui";
import { config } from "../config";
import { money } from "../lib/format";
import { useStore } from "../store";
import { coverPhoto, isAvailable, MEASUREMENTS } from "../types";

export function ItemPage({ id }: { id: string }) {
  const { products, status, inBag, add, setBasketOpen } = useStore();
  const item = products.find((p) => p.id === id);

  if (!item) {
    return (
      <div className="page notice">
        <p>{status === "loading" ? "Sedang memuatkan item, sekejap ya." : "Item ini tidak dijumpai."}</p>
        <a className="back" href="#/">Kembali ke katalog</a>
      </div>
    );
  }

  const available = isAvailable(item);
  const details: [string, string][] = [
    ["Kod", item.code],
    ["Saiz", item.size],
    ["Keadaan", item.condition],
    ["Kecacatan", item.flawNotes],
    ["Jenama", item.brand],
    ...MEASUREMENTS.filter(([key]) => item.measurements[key]).map(([key, label]): [string, string] => [label, `${item.measurements[key]} cm`]),
  ];

  return (
    <div className="page">
      <a className="back" href="#/">Kembali ke katalog</a>
      <div className="plant-page">
        <div className="arch"><Photo src={coverPhoto(item)} alt={item.name} /></div>
        <div>
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
            {details.filter(([, value]) => value).map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
          </dl>
          {available && (
            <div className="add-row">
              {inBag(item.id)
                ? <button type="button" className="btn btn-quiet" onClick={() => setBasketOpen(true)}>Dalam bakul</button>
                : <button type="button" className="btn" onClick={() => { add(item.id); setBasketOpen(true); }}>Tambah ke bakul, {money(item.price)}</button>}
            </div>
          )}
          <p className="muted small">Ini pertanyaan tempahan. {config.ownerName} akan sahkan item dan harga melalui WhatsApp sebelum anda bayar.</p>
        </div>
      </div>
    </div>
  );
}
