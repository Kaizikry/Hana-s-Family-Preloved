import type { ReactNode } from "react";
import { config } from "../config";
import { money } from "../lib/format";
import type { InfoPage as Page } from "../lib/route";
import { useStore } from "../store";

type Row = [string, ReactNode];

function Rows({ rows }: { rows: Row[] }) {
  return (
    <dl className="info-rows">
      {rows.map(([term, text]) => <div key={term}><dt>{term}</dt><dd>{text}</dd></div>)}
    </dl>
  );
}

function SizeGuide() {
  return (
    <>
      <h1>Panduan saiz</h1>
      <p className="page-lead">Setiap ukuran diambil dengan pakaian dibentang rata, dalam cm, lebih kurang 1 cm. Bandingkan dengan pakaian anda yang paling muat, diukur dengan cara yang sama.</p>
      <Rows rows={[
        ["Dada (ketiak ke ketiak)", "Lurus dari jahitan ketiak kiri ke jahitan ketiak kanan. Darab dua untuk lilitan dada."],
        ["Panjang", "Dari jahitan bahu yang paling tinggi hingga hujung bawah pakaian."],
        ["Bahu", "Dari jahitan bahu kiri ke jahitan bahu kanan, di bahagian belakang."],
        ["Lengan", "Dari jahitan bahu hingga hujung lengan."],
        ["Pinggang", "Lebar bahagian pinggang yang dibentang rata. Darab dua untuk lilitan pinggang."],
        ["Pinggul", "Lebar bahagian paling lebar di pinggul, dibentang rata."],
        ["Kaki dalam", "Dari celah kangkang hingga hujung kaki seluar."],
        ["Panjang tapak", "Dari tumit hingga hujung jari, di dalam kasut."],
      ]} />
    </>
  );
}

function Grades() {
  return (
    <>
      <h1>Gred keadaan</h1>
      <p className="page-lead">Setiap item diberi satu gred. Kecacatan, jika ada, sentiasa ditulis dan diambil gambar.</p>
      <Rows rows={[
        ["Baru dengan tag", "Belum pernah dipakai. Tag kedai masih ada."],
        ["Seperti baru", "Dipakai satu hingga tiga kali, tiada kesan pakai."],
        ["Baik", "Dipakai seperti biasa dan dijaga elok. Mungkin sedikit pudar atau berbulu."],
        ["Ada kecacatan", "Ada kecacatan yang dinyatakan, seperti kesan kotoran, lubang kecil atau butang tertanggal. Baca nota kecacatan sebelum membeli."],
      ]} />
    </>
  );
}

function Policy() {
  const { postageFee, holdMinutes } = useStore();
  const owner = config.ownerName;
  return (
    <>
      <h1>Polisi</h1>
      <p className="page-lead">Cara membayar, menerima dan memulangkan item.</p>
      <Rows rows={[
        ["Pembayaran", `Bayar melalui DuitNow QR atau pindahan bank selepas ${owner} sahkan item anda di WhatsApp. Untuk ambil sendiri, boleh juga bayar tunai semasa ambil. Laman ini tidak pernah meminta butiran bayaran.`],
        ["Tempahan", `Setelah ${owner} sahkan, item ditempah untuk anda selama ${holdMinutes || 30} minit. Jika belum dibayar dalam masa itu, item dibuka semula kepada pembeli lain.`],
        ["Pos", `${money(postageFee || 10)} ke seluruh Malaysia, berapa banyak item pun. ${owner} akan hantar nombor tracking melalui WhatsApp, dan akan bantu jika bungkusan hilang.`],
        ["Ambil sendiri", `Di ${config.pickupPlace}. ${config.pickupHours}.`],
        ["Dicuci", "Setiap item dicuci sebelum dipos."],
        ["Pemulangan", `Tiada pemulangan kerana saiz atau tukar fikiran. Jika item sampai dengan kecacatan yang tidak dinyatakan, hubungi ${owner} dalam 48 jam dengan video buka bungkusan untuk bayaran balik atau pemulangan.`],
        ["Privasi", `Nama, nombor telefon, negeri dan poskod anda direkod hanya untuk urus tempahan. Alamat penuh tidak disimpan; ia dihantar dalam mesej WhatsApp sahaja. Untuk semak atau padam maklumat anda, hubungi ${owner} melalui WhatsApp.`],
      ]} />
    </>
  );
}

function About() {
  return (
    <>
      <h1>Tentang kami</h1>
      <p className="page-lead">{config.shopName} ialah pakaian preloved dari almari keluarga kami di {config.pickupArea}, Terengganu.</p>
      <Rows rows={[
        ["Siapa kami", `Setiap item diambil gambar, diukur dan disenaraikan oleh keluarga kami sendiri. ${config.ownerName} menjawab setiap pertanyaan melalui WhatsApp.`],
        ["Ambil sendiri", `${config.pickupPlace}. ${config.pickupHours}.`],
        ["Cara membeli", "Pilih item, masukkan ke bakul dan hantar satu pertanyaan melalui WhatsApp. Bayar hanya selepas item disahkan."],
      ]} />
    </>
  );
}

const PAGES: Record<Page, () => ReactNode> = { saiz: SizeGuide, gred: Grades, polisi: Policy, tentang: About };

export function InfoPage({ page }: { page: Page }) {
  const Content = PAGES[page];
  return (
    <div className="page info-page">
      <a className="back" href="#/">Kembali ke katalog</a>
      <Content />
    </div>
  );
}
