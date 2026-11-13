import { useState, type FormEvent } from "react";
import { Choices, Field, Photo } from "../components/ui";
import { config } from "../config";
import { compressImage } from "../lib/image";
import { CATEGORIES, CONDITIONS, coverPhoto, FLAWED, LISTER_STATUSES, MEASUREMENTS, type Item, type ItemDraft, type ListerStatus, type MeasurementKey } from "../types";

const STATUS_LABELS: Record<ListerStatus, string> = { Available: "Dijual", Draf: "Draf", Disembunyi: "Sembunyi" };
const STATUS_OPTIONS = LISTER_STATUSES.map((value) => ({ value, label: STATUS_LABELS[value] }));

interface Props {
  item: Item | null;
  onSave: (draft: ItemDraft, newPhoto?: string) => Promise<void>;
  onCancel: () => void;
  onError: (err: unknown) => string;
}

const toText = (n: number | undefined) => (n ? String(n) : "");

export function ItemForm({ item, onSave, onCancel, onError }: Props) {
  const [form, setForm] = useState({
    name: item?.name ?? "",
    colour: item?.colour ?? "",
    category: item?.category ?? "",
    brand: item?.brand ?? "",
    size: item?.size ?? "",
    condition: item?.condition ?? "",
    flawNotes: item?.flawNotes ?? "",
    price: item ? String(item.price) : "",
    originalPrice: toText(item?.originalPrice),
    description: item?.description ?? "",
  });
  const [measurements, setMeasurements] = useState<Record<MeasurementKey, string>>(
    () => Object.fromEntries(MEASUREMENTS.map(([key]) => [key, toText(item?.measurements[key])])) as Record<MeasurementKey, string>,
  );
  // A held or sold item keeps its status whatever is picked here; the backend enforces that too.
  const lockedStatus = item && (item.status === "Reserved" || item.status === "Sold");
  const [status, setStatus] = useState<ListerStatus>(item && !lockedStatus ? (item.status as ListerStatus) : "Available");
  const [photo, setPhoto] = useState<string>();
  const [photoError, setPhotoError] = useState("");
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [saveError, setSaveError] = useState("");
  const [saving, setSaving] = useState(false);

  const input = (field: keyof typeof form) => ({
    value: form[field],
    onChange: (e: { target: { value: string } }) => setForm((f) => ({ ...f, [field]: e.target.value })),
  });

  const pickPhoto = async (file?: File) => {
    if (!file) return;
    setPhotoError("");
    try {
      setPhoto(await compressImage(file));
    } catch (err) {
      setPhotoError((err as Error).message);
    }
  };

  const submit = async (e: FormEvent) => {
    e.preventDefault();
    const price = Number(form.price);
    const originalPrice = form.originalPrice.trim() ? Number(form.originalPrice) : 0;
    const badMeasurement = MEASUREMENTS.some(([key]) => measurements[key].trim() && !(Number(measurements[key]) > 0 && Number(measurements[key]) <= 500));
    const found = {
      ...(!form.name.trim() && { name: "Isi nama item." }),
      ...(!form.category && { category: "Pilih kategori." }),
      ...(!form.condition && { condition: "Pilih keadaan." }),
      ...(form.condition === FLAWED && !form.flawNotes.trim() && { flawNotes: "Terangkan kecacatan, cth. satu butang tertanggal." }),
      ...((form.price.trim() === "" || !(price >= 0) || price > 100000) && { price: "Isi harga, cth. 25." }),
      ...(!(originalPrice >= 0) && { originalPrice: "Isi harga asal atau biarkan kosong." }),
      ...(badMeasurement && { measurements: "Ukuran mesti nombor dalam cm, cth. 48." }),
    };
    setErrors(found);
    if (Object.keys(found).length) return;

    setSaving(true);
    setSaveError("");
    try {
      await onSave({
        ...form,
        id: item?.id,
        name: form.name.trim(),
        flawNotes: form.condition === FLAWED ? form.flawNotes.trim() : "",
        price,
        originalPrice,
        measurements: Object.fromEntries(MEASUREMENTS.filter(([key]) => measurements[key].trim()).map(([key]) => [key, Number(measurements[key])])),
        photos: item?.photos ?? [],
        status,
      }, photo);
    } catch (err) {
      setSaveError(onError(err));
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="plant-form" onSubmit={submit} noValidate>
      <header className="drawer-head">
        <h2>{item ? `Edit ${item.code}` : "Tambah item"}</h2>
        <button type="button" className="icon-btn" onClick={onCancel} aria-label="Tutup">×</button>
      </header>

      <label className="photo-pick">
        <div className="arch"><Photo src={photo ?? (item ? coverPhoto(item) : "")} alt={form.name} /></div>
        <div>
          <strong>{item?.photos.length ? "Tukar foto utama" : "Muat naik foto"}</strong>
          <p className="muted small">Dari galeri atau kamera telefon. Foto dikecilkan secara automatik sebelum dimuat naik.</p>
          {photoError && <p className="low small" role="alert">{photoError}</p>}
        </div>
        <input type="file" accept="image/*" className="sr-only" onChange={(e) => pickPhoto(e.target.files?.[0])} />
      </label>

      <div className="field-row">
        <Field label="Nama item" error={errors.name}><input maxLength={120} {...input("name")} /></Field>
        <Field label="Warna"><input maxLength={60} placeholder="cth. Biru laut" {...input("colour")} /></Field>
      </div>
      <div className="field-row">
        <Field label="Kategori" error={errors.category}>
          <select {...input("category")}>
            <option value="" disabled>Pilih kategori</option>
            {CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
        <Field label="Keadaan" error={errors.condition}>
          <select {...input("condition")}>
            <option value="" disabled>Pilih keadaan</option>
            {CONDITIONS.map((c) => <option key={c}>{c}</option>)}
          </select>
        </Field>
      </div>
      {form.condition === FLAWED && (
        <Field label="Kecacatan" error={errors.flawNotes}><input maxLength={500} placeholder="cth. Satu butang di lengan kiri tertanggal" {...input("flawNotes")} /></Field>
      )}
      <div className="field-row">
        <Field label="Saiz"><input maxLength={40} placeholder="cth. M, EU 41, Free Size" {...input("size")} /></Field>
        <Field label="Jenama (pilihan)"><input maxLength={60} placeholder="cth. Uniqlo" {...input("brand")} /></Field>
      </div>
      <div className="field-row">
        <Field label={`Harga (${config.currency})`} error={errors.price}><input inputMode="decimal" {...input("price")} /></Field>
        <Field label={`Harga asal (${config.currency}, pilihan)`} error={errors.originalPrice}><input inputMode="decimal" {...input("originalPrice")} /></Field>
      </div>

      <fieldset className={`field${errors.measurements ? " has-error" : ""}`}>
        <legend>Ukuran dalam cm (isi yang berkenaan)</legend>
        <div className="measure-grid">
          {MEASUREMENTS.map(([key, label]) => (
            <label key={key} className="field">
              <span>{label}</span>
              <input inputMode="decimal" value={measurements[key]} onChange={(e) => setMeasurements((m) => ({ ...m, [key]: e.target.value }))} />
            </label>
          ))}
        </div>
        {errors.measurements && <em>{errors.measurements}</em>}
      </fieldset>

      <Field label="Penerangan"><textarea rows={3} maxLength={1000} {...input("description")} /></Field>
      {lockedStatus
        ? <p className="muted small">Item ini {item.status === "Sold" ? "sudah terjual" : "sedang ditempah"}, jadi statusnya tidak boleh ditukar di sini.</p>
        : <Choices label="Status" name="status" options={STATUS_OPTIONS} value={status} onChange={setStatus} />}

      {saveError && <p className="error-box" role="alert">{saveError}</p>}
      <div className="form-actions">
        <button type="button" className="btn btn-quiet" onClick={onCancel}>Batal</button>
        <button type="submit" className="btn" disabled={saving}>{saving ? "Sedang menyimpan…" : "Simpan"}</button>
      </div>
    </form>
  );
}
