import { useState } from "react";
import { Photo } from "../components/ui";
import { ApiError, confirmInquiry, setInquiryStatus } from "../lib/api";
import { inquiryTime, money, toWhatsAppNumber } from "../lib/format";
import { whatsappUrl } from "../lib/whatsapp";
import { coverPhoto, INQUIRY_STATUSES, type AdminItem, type InquiryRecord, type InquiryStatus } from "../types";

interface Props {
  token: string;
  inquiries: InquiryRecord[] | null;
  failed: boolean;
  retry: () => void;
  products: AdminItem[];
  reloadItems: () => void;
  onError: (err: unknown) => string;
}

/** The steps each status allows, in the order Mama takes them. The backend refuses any other. */
function nextSteps(q: InquiryRecord): { status: InquiryStatus | "confirm"; label: string }[] {
  switch (q.status) {
    case "Baru": return [{ status: "confirm", label: "Sahkan & tempah" }];
    case "Disahkan": return [{ status: "Dibayar", label: "Tandakan dibayar" }];
    case "Dibayar": return q.deliveryMethod === "post" ? [] : [{ status: "Diambil", label: "Tandakan diambil" }];
    case "Dihantar":
    case "Diambil": return [{ status: "Selesai", label: "Tandakan selesai" }];
    default: return [];
  }
}

const cancellable = (q: InquiryRecord) => ["Baru", "Disahkan", "Dibayar"].includes(q.status);

export function Inquiries({ token, inquiries, failed, retry, products, reloadItems, onError }: Props) {
  const [filter, setFilter] = useState<InquiryStatus | "Semua">("Semua");
  const [busyId, setBusyId] = useState("");
  const [error, setError] = useState("");
  const [tracking, setTracking] = useState<Record<string, string>>({});
  const [cancelling, setCancelling] = useState("");
  // Matched by id, not name, so look-alike items with similar names can't be mixed up.
  const itemById = new Map(products.map((p) => [p.id, p]));

  const newestFirst = [...(inquiries ?? [])].sort((a, b) => b.timestamp.localeCompare(a.timestamp));
  const shown = newestFirst.filter((q) => filter === "Semua" || q.status === filter);
  const countOf = (status: InquiryStatus) => newestFirst.filter((q) => q.status === status).length;

  const act = async (q: InquiryRecord, step: InquiryStatus | "confirm") => {
    setBusyId(q.inquiryId);
    setError("");
    try {
      if (step === "confirm") await confirmInquiry(token, q.inquiryId);
      else await setInquiryStatus(token, q.inquiryId, step, step === "Dihantar" ? tracking[q.inquiryId]?.trim() : undefined);
      setCancelling("");
    } catch (err) {
      const codes = err instanceof ApiError && err.unavailable.length ? ` (${err.unavailable.join(", ")})` : "";
      setError(`${onError(err)}${codes}`);
    } finally {
      setBusyId("");
      // Both lists change: the inquiry's status and the items' holds.
      retry();
      reloadItems();
    }
  };

  return (
    <main className="admin-page">
      <h1>Pertanyaan</h1>
      <p className="muted">Sahkan untuk tempah item selama 30 minit. Tandakan dibayar untuk kekalkan tempahan.</p>

      <div className="tabs" role="group" aria-label="Status pertanyaan">
        <button type="button" aria-pressed={filter === "Semua"} onClick={() => setFilter("Semua")}>Semua {newestFirst.length}</button>
        {INQUIRY_STATUSES.map((s) => (
          <button key={s} type="button" aria-pressed={filter === s} onClick={() => setFilter(s)}>{s} {countOf(s)}</button>
        ))}
      </div>

      {error && <p className="error-box" role="alert">{error}</p>}
      {failed && (
        <div className="notice" role="alert">
          <p>Pertanyaan tidak dapat dimuatkan.</p>
          <button type="button" className="btn" onClick={retry}>Cuba lagi</button>
        </div>
      )}
      {!failed && !inquiries && <p className="notice" role="status">Sedang memuatkan pertanyaan…</p>}
      {inquiries && shown.length === 0 && (
        <p className="notice">
          {filter === "Semua" ? "Belum ada pertanyaan. Pertanyaan pelanggan akan muncul di sini sebaik sahaja mereka menghantar borang tempahan." : `Tiada pertanyaan berstatus ${filter}.`}
        </p>
      )}

      <ul className="inquiries">
        {shown.map((q) => {
          const holdEnds = q.status === "Disahkan" && q.holdUntil ? Date.parse(q.holdUntil) : 0;
          const expired = holdEnds > 0 && holdEnds <= Date.now();
          const busy = busyId === q.inquiryId;
          const trackingText = `Salam ${q.customerName}, barang anda (${q.inquiryId}) dah dipos. No. tracking: ${q.trackingNo}. Terima kasih!`;
          return (
            <li key={q.inquiryId} className="inquiry">
              <header>
                <h3>{q.customerName}</h3>
                <span className={`status status-${q.status}`}>{q.status}</span>
                <time className="muted small">{inquiryTime(q.timestamp)}</time>
              </header>
              <p className="muted small">{q.customerPhone}, {q.inquiryId}</p>
              <p><strong>{q.deliveryMethod === "post" ? `Pos ke ${q.postState} ${q.postcode}` : `Ambil sendiri: ${q.pickupPreference}`}</strong></p>
              {holdEnds > 0 && (
                <p className={expired ? "low small" : "small"}>
                  {expired ? "Tempoh tempahan sudah tamat. Item boleh diambil pembeli lain." : `Ditempah sehingga ${inquiryTime(q.holdUntil)}`}
                </p>
              )}
              {q.trackingNo && <p className="small">Tracking: {q.trackingNo}</p>}
              <ul className="inquiry-items">
                {q.items.map((line) => {
                  const item = itemById.get(line.id);
                  const dropped = q.confirmed.length > 0 && !q.confirmed.includes(line.id);
                  return (
                    <li key={line.id}>
                      <span className="item-thumb">{item ? <Photo src={coverPhoto(item)} alt={item.name} /> : <span className="photo-empty">Sudah dipadam</span>}</span>
                      <span>
                        <strong>{line.code} {line.name}</strong> {money(line.price)}
                        {dropped && <span className="muted small"> (tidak ditempah)</span>}
                      </span>
                    </li>
                  );
                })}
              </ul>
              {q.notes && <blockquote>{q.notes}</blockquote>}
              <p className="total"><span>Item {money(q.itemsTotal)}{q.postage ? `, pos ${money(q.postage)}` : ""}</span> <strong>{money(q.total)}</strong></p>

              {q.status === "Dibayar" && q.deliveryMethod === "post" && (
                <div className="tracking-row">
                  <label className="field">
                    <span>No. tracking</span>
                    <input value={tracking[q.inquiryId] ?? ""} maxLength={40} placeholder="cth. ER123456789MY" onChange={(e) => setTracking((t) => ({ ...t, [q.inquiryId]: e.target.value }))} />
                  </label>
                  <button type="button" className="btn btn-small" disabled={busy || !(tracking[q.inquiryId] ?? "").trim()} onClick={() => act(q, "Dihantar")}>Tandakan dihantar</button>
                </div>
              )}

              <div className="form-actions">
                {nextSteps(q).map((step) => (
                  <button key={step.status} type="button" className="btn btn-small" disabled={busy} onClick={() => act(q, step.status)}>{step.label}</button>
                ))}
                {cancellable(q) && (cancelling === q.inquiryId
                  ? <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => act(q, "Batal")}>Pasti batal?</button>
                  : <button type="button" className="btn btn-quiet btn-small" disabled={busy} onClick={() => setCancelling(q.inquiryId)}>Batal</button>)}
                {q.status === "Dihantar" && q.trackingNo
                  ? <a className="btn btn-quiet btn-small" href={whatsappUrl(toWhatsAppNumber(q.customerPhone), trackingText)} target="_blank" rel="noreferrer">Hantar tracking</a>
                  : <a className="btn btn-quiet btn-small" href={whatsappUrl(toWhatsAppNumber(q.customerPhone), `Salam ${q.customerName}, `)} target="_blank" rel="noreferrer">Balas</a>}
              </div>
            </li>
          );
        })}
      </ul>
    </main>
  );
}
