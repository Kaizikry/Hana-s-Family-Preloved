import { useState } from "react";
import { Dialog } from "../components/Dialog";
import { Photo } from "../components/ui";
import { deletePlant, savePlant } from "../lib/api";
import { money } from "../lib/format";
import { useStore } from "../store";
import { inStock, type Plant, type PlantDraft } from "../types";
import { PlantForm } from "./PlantForm";

export function Inventory({ token, onError }: { token: string; onError: (err: unknown) => string }) {
  const { plants, setPlants, status, reload } = useStore();
  const [editing, setEditing] = useState<Plant | "new" | null>(null);
  const [deleting, setDeleting] = useState<Plant | null>(null);
  const [busy, setBusy] = useState("");
  const [error, setError] = useState("");

  const upsert = (saved: Plant) =>
    setPlants((list) => (list.some((p) => p.id === saved.id) ? list.map((p) => (p.id === saved.id ? saved : p)) : [...list, saved]));

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

  const toggle = (plant: Plant) => {
    // Switching on with nothing in stock can't work, so ask for the new count instead.
    if (!inStock(plant) && plant.stock <= 0) return setEditing(plant);
    const next: Plant = { ...plant, status: plant.status === "Sold Out" ? "Available" : "Sold Out" };
    return run(plant.id, async () => upsert(await savePlant(token, next)));
  };

  const save = async (draft: PlantDraft) => {
    upsert(await savePlant(token, draft));
    setEditing(null);
  };

  const remove = () =>
    run("delete", async () => {
      await deletePlant(token, deleting!.id);
      setPlants((list) => list.filter((p) => p.id !== deleting!.id));
      setDeleting(null);
    });

  const available = plants.filter(inStock).length;

  return (
    <main className="admin-page">
      <div className="admin-head">
        <div>
          <h1>Inventori</h1>
          <p className="muted">{plants.length} item, {available} ada stok, {plants.length - available} habis dijual</p>
        </div>
        <button type="button" className="btn" onClick={() => setEditing("new")}>Tambah item</button>
      </div>

      {error && <p className="error-box" role="alert">{error}</p>}
      {status === "loading" && plants.length === 0 && <p className="notice" role="status">Sedang memuatkan item…</p>}
      {status === "error" && (
        <div className="notice" role="alert">
          <p>Senarai item tidak dapat dimuatkan.</p>
          <button type="button" className="btn" onClick={reload}>Cuba lagi</button>
        </div>
      )}
      {status === "ready" && plants.length === 0 && (
        <div className="notice">
          <p>Belum ada item. Tekan Tambah item untuk senaraikan yang pertama.</p>
        </div>
      )}

      <ul className="stock-list">
        {plants.map((plant) => (
          <li key={plant.id} className="stock-row">
            <div className="stock-thumb"><Photo plant={plant} /></div>
            <div className="stock-name">
              <h3>{plant.name}</h3>
              <p className="muted small">{plant.category} · {plant.id}</p>
            </div>
            <p className="stock-num"><small>Harga</small>{money(plant.price)}</p>
            <p className="stock-num"><small>Stok</small>{plant.stock}</p>
            <button
              type="button"
              role="switch"
              aria-checked={inStock(plant)}
              aria-label={`${plant.name} ada stok`}
              className="switch"
              disabled={busy === plant.id}
              onClick={() => toggle(plant)}
            >
              <i /> {inStock(plant) ? "Ada stok" : "Habis dijual"}
            </button>
            <div className="stock-actions">
              <button type="button" className="link-btn" onClick={() => setEditing(plant)} aria-label={`Edit ${plant.name}`}>Edit</button>
              <button type="button" className="link-btn" onClick={() => setDeleting(plant)} aria-label={`Padam ${plant.name}`}>Padam</button>
            </div>
          </li>
        ))}
      </ul>

      <Dialog open={editing !== null} onClose={() => setEditing(null)} label={editing === "new" ? "Tambah item" : "Edit item"}>
        {editing !== null && <PlantForm plant={editing === "new" ? null : editing} onCancel={() => setEditing(null)} onSave={save} onError={onError} />}
      </Dialog>

      <Dialog open={deleting !== null} onClose={() => setDeleting(null)} label="Padam item">
        {deleting && (
          <div className="confirm">
            <h2>Padam {deleting.name}?</h2>
            <p>Item ini akan hilang dari kedai dan dari Google Sheet. Kalau mungkin dijual semula nanti, tandakan habis dijual sahaja.</p>
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
