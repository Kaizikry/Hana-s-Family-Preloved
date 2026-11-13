import { useState } from "react";
import { Dialog } from "../components/Dialog";
import { Photo, statusText } from "../components/ui";
import { deleteItem, saveItem, setItemStatus } from "../lib/api";
import { money } from "../lib/format";
import { coverPhoto, type AdminItem, type Item, type ItemDraft } from "../types";
import { ItemForm } from "./ItemForm";

const isLocked = (item: Item) => item.status === "Reserved" || item.status === "Sold";

interface Props {
  token: string;
  /** Every item, drafts and hidden ones included, from the admin-only list. */
  products: AdminItem[];
  setProducts: (update: (list: AdminItem[]) => AdminItem[]) => void;
  status: "loading" | "ready" | "error";
  reload: () => void;
  onError: (err: unknown) => string;
}

export function Inventory({ token, products, setProducts, status, reload, onError }: Props) {
  const [editing, setEditing] = useState<AdminItem | "new" | null>(null);
  const [deleting, setDeleting] = useState<AdminItem | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  // A save never changes who holds an item, so the hold details carry over.
  const upsert = (saved: Item) =>
    setProducts((list) => (list.some((p) => p.id === saved.id)
      ? list.map((p) => (p.id === saved.id ? { ...p, ...saved } : p))
      : [...list, { ...saved, reservedFor: "", holdUntil: "" }]));

  const run = async (key: string, action: () => Promise<void>) => {
    setBusy(key);
    setError("");
    try {
      await action();
    } catch (err) {
      setError(onError(err));
    } finally {
      setBusy("");
    }
  };

  // On sale and off sale; held and sold items only change through their inquiry.
  const toggle = (item: AdminItem) =>
    run(item.id, async () => {
      const next = item.status === "Available" ? "Disembunyi" : "Available";
      await setItemStatus(token, item.id, next);
      setProducts((list) => list.map((p) => (p.id === item.id ? { ...p, status: next } : p)));
    });

  const save = async (draft: ItemDraft, newPhoto?: string) => {
    upsert(await saveItem(token, draft, newPhoto));
    setEditing(null);
  };

  const remove = () =>
    run("delete", async () => {
      await deleteItem(token, deleting!.id);
      setProducts((list) => list.filter((p) => p.id !== deleting!.id));
      setDeleting(null);
    });

  const onSale = products.filter((p) => p.status === "Available").length;
  const held = products.filter((p) => p.status === "Reserved").length;

  return (
    <main className="admin-page">
      <div className="admin-head">
        <div>
          <h1>Inventori</h1>
          <p className="muted">{products.length} item, {onSale} dijual, {held} ditempah</p>
        </div>
        <button type="button" className="btn" onClick={() => setEditing("new")}>Tambah item</button>
      </div>

      {error && <p className="error-box" role="alert">{error}</p>}
      {status === "loading" && products.length === 0 && <p className="notice" role="status">Sedang memuatkan item…</p>}
      {status === "error" && (
        <div className="notice" role="alert">
          <p>Senarai item tidak dapat dimuatkan.</p>
          <button type="button" className="btn" onClick={reload}>Cuba lagi</button>
        </div>
      )}
      {status === "ready" && products.length === 0 && (
        <div className="notice">
          <p>Belum ada item. Tekan Tambah item untuk senaraikan yang pertama.</p>
        </div>
      )}

      <ul className="stock-list">
        {products.map((item) => (
          <li key={item.id} className="stock-row">
            <div className="stock-thumb"><Photo src={coverPhoto(item)} alt={item.name} /></div>
            <div className="stock-name">
              <h3>{item.name}</h3>
              <p className="muted small">{item.code}, {item.category}</p>
            </div>
            <p className="stock-num"><small>Harga</small>{money(item.price)}</p>
            <p className="stock-num"><small>Saiz</small>{item.size || "Tiada"}</p>
            {isLocked(item)
              ? <p className="switch">{statusText(item)}</p>
              : (
                <button
                  type="button"
                  role="switch"
                  aria-checked={item.status === "Available"}
                  aria-label={`${item.name} dijual`}
                  className="switch"
                  disabled={busy === item.id}
                  onClick={() => toggle(item)}
                >
                  <i /> {item.status === "Available" ? "Dijual" : statusText(item)}
                </button>
              )}
            <div className="stock-actions">
              <button type="button" className="link-btn" onClick={() => setEditing(item)} aria-label={`Edit ${item.name}`}>Edit</button>
              {!isLocked(item) && <button type="button" className="link-btn" onClick={() => setDeleting(item)} aria-label={`Padam ${item.name}`}>Padam</button>}
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} label={editing === "new" ? "Tambah item" : "Edit item"}>
        {editing !== null && <ItemForm item={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSave={save} onError={onError} />}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} label="Padam item">
        {deleting && (
          <div className="confirm">
            <h2>Padam {deleting.code} {deleting.name}?</h2>
            <p>Item ini akan hilang dari kedai dan dari Google Sheet. Kodnya tidak akan digunakan semula. Kalau mungkin dijual semula nanti, sembunyikan sahaja.</p>
            <div className="form-actions">
              <button type="button" className="btn btn-quiet" onClick={() => setDeleting(null)}>Batal</button>
              <button type="button" className="btn" disabled={busy === "delete"} onClick={remove}>{busy === "delete" ? "Sedang memadam…" : "Padam item"}</button>
            </div>
          </div>
        )}
      </Dialog>
    </main>
  );
}
