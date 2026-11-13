import { useEffect, useRef, useState, type FormEvent, type ReactNode } from "react";
import { Choices, Field } from "../components/ui";
import { config } from "../config";
import { ApiError, submitInquiry, type Submitted } from "../lib/api";
import { isValidPhone, money, pickupDays, toWhatsAppNumber } from "../lib/format";
import { session, writeJson } from "../lib/storage";
import { buildMessage, whatsappUrl } from "../lib/whatsapp";
import { useStore } from "../store";
import { STATES, type DeliveryMethod, type InquiryInput } from "../types";
import { SENT_KEY } from "./ThankYou";

const LOG_TIMEOUT_MS = 4000;
const EMPTY = { name: "", phone: "", method: "", day: "", time: "", state: "", postcode: "", address: "", notes: "" };
type Form = typeof EMPTY;
const TIME_OPTIONS = config.pickupWindows.map((value) => ({ value, label: <b>{value}</b> }));

function validate(form: Form) {
  return {
    ...(!form.name.trim() && { name: "Sila isi nama anda." }),
    ...(!isValidPhone(form.phone) && { phone: "Sila isi nombor telefon yang betul, cth. 012-345 6789." }),
    ...(!form.method && { method: "Sila pilih ambil sendiri atau pos." }),
    ...(form.method === "pickup" && !form.day && { day: "Sila pilih hari ambil." }),
    ...(form.method === "pickup" && !form.time && { time: "Sila pilih masa ambil." }),
    ...(form.method === "post" && !STATES.includes(form.state) && { state: "Sila pilih negeri." }),
    ...(form.method === "post" && !/^\d{5}$/.test(form.postcode.trim()) && { postcode: "Poskod mesti 5 digit." }),
    ...(form.method === "post" && form.address.trim().length < 10 && { address: "Sila isi alamat penuh." }),
  };
}

type Outcome = { ok: Submitted } | { error: unknown } | { timeout: true };

export function Checkout() {
  const { items, count, total, postageFee, whatsappNumber, clearBasket, setBasketOpen, reload, refresh } = useStore();
  // Re-checked on arrival, so the summary never offers an item that went to someone else meanwhile.
  useEffect(() => {
    refresh();
  }, [refresh]);
  const [form, setForm] = useState(EMPTY);
  const [errors, setErrors] = useState<Partial<Form>>({});
  const [sending, setSending] = useState(false);
  const [taken, setTaken] = useState("");
  const formRef = useRef<HTMLFormElement>(null);
  // Worked out on each render, because a tab left open overnight would otherwise keep yesterday's dates.
  const dayOptions = pickupDays().map((d) => ({ value: d.value, label: <><b>{d.label}</b><small>{d.date}</small></> }));
  const methodOptions: { value: DeliveryMethod; label: ReactNode }[] = [
    { value: "pickup", label: <><b>Ambil sendiri</b><small>Tanpa caj</small></> },
    { value: "post", label: <><b>Pos</b><small>{money(postageFee)}</small></> },
  ];
  const postage = form.method === "post" ? postageFee : 0;

  const update = (field: keyof Form) => (value: string) => {
    setForm((f) => ({ ...f, [field]: value }));
    setErrors((e) => ({ ...e, [field]: undefined }));
  };

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const found = validate(form);
    setErrors(found);
    setTaken("");
    const firstError = Object.keys(found)[0];
    if (firstError) {
      formRef.current?.querySelector<HTMLElement>(`[name="${firstError}"]`)?.focus();
      return;
    }

    const method = form.method as DeliveryMethod;
    const input: InquiryInput = {
      customerName: form.name.trim(),
      customerPhone: form.phone.trim(),
      deliveryMethod: method,
      pickupPreference: method === "pickup" ? `${form.day}, ${form.time}` : "",
      postState: method === "post" ? form.state : "",
      postcode: method === "post" ? form.postcode.trim() : "",
      notes: form.notes.trim(),
      itemIds: items.map((item) => item.id),
    };

    setSending(true);
    // The log only gets a short head start, so a slow connection never keeps the buyer from WhatsApp.
    const outcome: Outcome = await Promise.race([
      submitInquiry(input).then((ok) => ({ ok }), (error) => ({ error })),
      new Promise<Outcome>((resolve) => setTimeout(() => resolve({ timeout: true }), LOG_TIMEOUT_MS)),
    ]);

    // An item reserved by someone else since it went in the bag: say so, rather than send a request Mama must refuse.
    if ("error" in outcome && outcome.error instanceof ApiError && outcome.error.code === "UNAVAILABLE") {
      const gone = items.filter((item) => outcome.error instanceof ApiError && outcome.error.unavailable.includes(item.id)).map((item) => item.name);
      setTaken(`${gone.join(", ") || "Ada item"} baru sahaja ditempah atau tiada lagi. Buang dari bakul dan cuba lagi.`);
      setSending(false);
      reload();
      return;
    }
    if ("error" in outcome) console.warn("Inquiry was not logged:", outcome.error);

    const logged = "ok" in outcome ? outcome.ok : undefined;
    const message = buildMessage(config.shopName, {
      input,
      items,
      itemsTotal: logged?.itemsTotal ?? total,
      postage: logged?.postage ?? postage,
      total: logged?.total ?? Math.round((total + postage) * 100) / 100,
      address: method === "post" ? form.address : "",
    }, logged?.inquiryId);
    const url = whatsappNumber ? whatsappUrl(toWhatsAppNumber(whatsappNumber), message) : null;
    writeJson(session, SENT_KEY, { name: input.customerName, inquiryId: logged?.inquiryId, message, url });
    clearBasket();
    window.location.hash = "/terima-kasih";
    // Same-tab navigation, because popup blockers stop new tabs opened after an await.
    if (url) window.location.assign(url);
  };

  if (items.length === 0) {
    return (
      <div className="page notice">
        <p>Bakul anda masih kosong.</p>
        <a className="btn btn-quiet" href="#/">Lihat katalog</a>
      </div>
    );
  }

  return (
    <div className="page">
      <button type="button" className="back" onClick={() => setBasketOpen(true)}>Kembali ke bakul</button>
      <h1>Butiran tempahan</h1>
      <p className="page-lead">Isi maklumat di bawah. Pertanyaan anda akan direkod, kemudian WhatsApp dibuka dengan senarai item yang dipilih.</p>

      <form className="checkout" onSubmit={submit} noValidate ref={formRef}>
        <div className="checkout-fields">
          <div className="field-row">
            <Field label="Nama" error={errors.name}>
              <input name="name" autoComplete="name" maxLength={80} placeholder="cth. Nurul Aisyah" value={form.name} onChange={(e) => update("name")(e.target.value)} />
            </Field>
            <Field label="No. telefon" error={errors.phone}>
              <input name="phone" type="tel" autoComplete="tel" maxLength={40} placeholder="012-345 6789" value={form.phone} onChange={(e) => update("phone")(e.target.value)} />
            </Field>
          </div>

          <Choices label="Cara terima" name="method" options={methodOptions} value={form.method} error={errors.method} onChange={update("method")} />

          {form.method === "pickup" && (
            <>
              <Choices label="Hari ambil" name="day" options={dayOptions} value={form.day} error={errors.day} onChange={update("day")} />
              <Choices label="Masa ambil" name="time" options={TIME_OPTIONS} value={form.time} error={errors.time} onChange={update("time")} />
            </>
          )}

          {form.method === "post" && (
            <>
              <div className="field-row">
                <Field label="Negeri" error={errors.state}>
                  <select name="state" autoComplete="address-level1" value={form.state} onChange={(e) => update("state")(e.target.value)}>
                    <option value="" disabled>Pilih negeri</option>
                    {STATES.map((s) => <option key={s}>{s}</option>)}
                  </select>
                </Field>
                <Field label="Poskod" error={errors.postcode}>
                  <input name="postcode" inputMode="numeric" autoComplete="postal-code" maxLength={5} placeholder="cth. 40150" value={form.postcode} onChange={(e) => update("postcode")(e.target.value.replace(/\D/g, ""))} />
                </Field>
              </div>
              <Field label="Alamat penuh" error={errors.address}>
                <textarea name="address" rows={3} autoComplete="street-address" maxLength={300} placeholder="No. rumah, jalan, taman, bandar" value={form.address} onChange={(e) => update("address")(e.target.value)} />
              </Field>
            </>
          )}

          <Field label="Nota atau soalan (pilihan)">
            <textarea name="notes" rows={3} maxLength={1000} placeholder="cth. Boleh hantar gambar tag jenama?" value={form.notes} onChange={(e) => update("notes")(e.target.value)} />
          </Field>
        </div>

        <aside className="summary">
          <h2>Bakul anda <small>{count} item</small></h2>
          <ul>
            {items.map((item) => <li key={item.id}><span>{item.code} {item.name}</span> <strong>{money(item.price)}</strong></li>)}
            {form.method === "post" && <li><span>Pos</span> <strong>{money(postage)}</strong></li>}
          </ul>
          <p className="total"><span>Jumlah anggaran</span> <strong>{money(total + postage)}</strong></p>
          {form.method === "pickup" && <p className="small">Ambil sendiri di {config.pickupPlace}{form.day && `, ${form.day}`}{form.time && `, ${form.time}`}</p>}
          {taken && <p className="error-box" role="alert">{taken}</p>}
          <button type="submit" className="btn btn-wide" disabled={sending}>
            {sending ? "Sedang merekod…" : "Hantar Pertanyaan via WhatsApp"}
          </button>
          <p className="muted small">Harga anggaran. {config.ownerName} akan sahkan item dan jumlah akhir melalui WhatsApp sebelum anda bayar.</p>
          <p className="muted small">Nama, nombor telefon, negeri dan poskod anda direkod dan hanya digunakan oleh {config.ownerName} untuk urus tempahan ini. Alamat penuh hanya dihantar dalam mesej WhatsApp dan tidak disimpan. Untuk semak atau padam maklumat anda, hubungi {config.ownerName} melalui WhatsApp.</p>
        </aside>
      </form>
    </div>
  );
}
