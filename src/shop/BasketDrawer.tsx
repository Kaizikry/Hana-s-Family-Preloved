import { Dialog } from "../components/Dialog";
import { Photo, statusText } from "../components/ui";
import { money } from "../lib/format";
import { useStore } from "../store";
import { coverPhoto } from "../types";

export function BasketDrawer() {
  const { lines, items, count, total, postageFee, remove, basketOpen, setBasketOpen } = useStore();
  const close = () => setBasketOpen(false);

  return (
    <Dialog open={basketOpen} onClose={close} label="Bakul" variant="drawer">
      <div className="drawer">
        <header className="drawer-head">
          <h2>Bakul <span className="count">{count}</span></h2>
          <button type="button" className="icon-btn" onClick={close} aria-label="Tutup bakul">×</button>
        </header>
        <p className="muted small drawer-note">Ambil sendiri tanpa caj, atau pos {money(postageFee)} ke seluruh Malaysia.</p>

        <ul className="drawer-lines">
          {lines.map(({ item, available }) => (
            <li key={item.id} className={available ? "line" : "line is-sold"}>
              <div className="line-thumb"><Photo src={coverPhoto(item)} alt={item.name} /></div>
              <div>
                <h3>{item.name}</h3>
                {available
                  ? <p className="muted small">{[item.code, item.size].filter(Boolean).join(", ")}</p>
                  : <p className="low small">{statusText(item)}, jadi tidak akan dimasukkan.</p>}
              </div>
              <div className="line-end">
                {available && <strong>{money(item.price)}</strong>}
                <button type="button" className="link-btn" onClick={() => remove(item.id)} aria-label={`Buang ${item.name}`}>Buang</button>
              </div>
            </li>
          ))}
        </ul>

        {lines.length === 0 && (
          <div className="notice drawer-empty">
            <p>Bakul anda masih kosong.</p>
            <button type="button" className="btn btn-quiet" onClick={close}>Lihat katalog</button>
          </div>
        )}

        {items.length > 0 && (
          <footer className="drawer-foot">
            <p className="total"><span>Jumlah item</span> <strong>{money(total)}</strong></p>
            <a className="btn btn-wide" href="#/tempahan" onClick={close}>Teruskan ke tempahan</a>
          </footer>
        )}
      </div>
    </Dialog>
  );
}
