import { randomUUID } from "node:crypto";
import { readFileSync } from "node:fs";
import { join } from "node:path";
import vm from "node:vm";

/** Runs backend/Code.gs against in-memory stand-ins for the Google services it uses. */
export function loadBackend(properties: Record<string, string> = { ADMIN_PIN: "482193", DRIVE_FOLDER_ID: "folder" }) {
  const sheets = new Map<string, unknown[][]>();
  const cache = new Map<string, string>();
  const sentEmails: { to: string; subject: string; body: string }[] = [];
  const uploads: { mime: string; bytes: Buffer; name: string }[] = [];
  const rowRewrites: string[] = [];
  const clock = { now: Date.UTC(2026, 10, 13, 2, 0, 0) };
  const lock = { failNext: false };
  let files = 0;

  const sheetApi = (name: string) => {
    const rows = sheets.get(name)!;
    return {
      getLastRow: () => rows.length,
      appendRow: (row: unknown[]) => rows.push([...row]),
      getDataRange: () => ({ getValues: () => rows.map((r) => [...r]) }),
      getRange: (row: number, column: number) => ({
        setValues: (values: unknown[][]) => {
          rows[row - 1] = [...values[0]];
          rowRewrites.push(name);
        },
        setValue: (value: unknown) => {
          rows[row - 1][column - 1] = value;
        },
      }),
      deleteRow: (row: number) => rows.splice(row - 1, 1),
    };
  };

  const context = vm.createContext({
    SpreadsheetApp: {
      getActiveSpreadsheet: () => ({
        getSheetByName: (name: string) => (sheets.has(name) ? sheetApi(name) : null),
        insertSheet: (name: string) => {
          sheets.set(name, []);
          return sheetApi(name);
        },
      }),
    },
    console: { error() {} },
    PropertiesService: {
      getScriptProperties: () => ({
        getProperty: (k: string) => properties[k] ?? null,
        setProperty: (k: string, v: string) => {
          properties[k] = v;
        },
        deleteProperty: (k: string) => {
          delete properties[k];
        },
      }),
    },
    CacheService: {
      getScriptCache: () => ({
        get: (k: string) => cache.get(k) ?? null,
        put: (k: string, v: string) => cache.set(k, v),
        remove: (k: string) => cache.delete(k),
      }),
    },
    LockService: {
      getScriptLock: () => ({
        waitLock() {
          if (lock.failNext) {
            lock.failNext = false;
            throw new Error("Lock timeout: another process was holding the lock for too long.");
          }
        },
        releaseLock() {},
      }),
    },
    MailApp: { sendEmail: (m: { to: string; subject: string; body: string }) => sentEmails.push(m) },
    Utilities: {
      getUuid: () => randomUUID(),
      base64Decode: (s: string) => Buffer.from(s, "base64"),
      newBlob: (bytes: Buffer, mime: string, name: string) => ({ bytes, mime, name }),
    },
    DriveApp: {
      Access: { ANYONE_WITH_LINK: "a" },
      Permission: { VIEW: "v" },
      getFolderById: () => ({
        createFile: (blob: { mime: string; bytes: Buffer; name: string }) => {
          uploads.push(blob);
          files += 1;
          const id = `1DriveFile${String(files).padStart(8, "0")}`;
          return { setSharing() {}, getId: () => id };
        },
      }),
    },
    ContentService: {
      MimeType: { JSON: "json" },
      createTextOutput: (text: string) => ({ text, setMimeType() { return this; } }),
    },
  });

  vm.runInContext(readFileSync(join(import.meta.dirname, "../backend/Code.gs"), "utf8"), context);
  // Code.gs reads the time through now(), so the tests can move the clock.
  (context as unknown as { now: () => number }).now = () => clock.now;
  const fn = context as unknown as { doGet: () => { text: string }; doPost: (e: unknown) => { text: string } };

  return {
    sheets,
    cache,
    properties,
    sentEmails,
    uploads,
    rowRewrites,
    lock,
    /** Moves the backend's clock forward by this many minutes. */
    advance: (minutes: number) => {
      clock.now += minutes * 60 * 1000;
    },
    get: () => JSON.parse(fn.doGet().text),
    post: (body: unknown) => JSON.parse(fn.doPost({ postData: { contents: JSON.stringify(body) } }).text),
    postRaw: (contents: string) => JSON.parse(fn.doPost({ postData: { contents } }).text),
    postEvent: (event: unknown) => JSON.parse(fn.doPost(event).text),
  };
}

/** A real JPEG header: FF D8 FF E0, then filler. */
export const JPEG = `data:image/jpeg;base64,${Buffer.from([0xff, 0xd8, 0xff, 0xe0, 0, 16, 74, 70, 73, 70, 0, 1]).toString("base64")}`;
export const PHOTO = "https://drive.google.com/thumbnail?id=1DriveFile00000001&sz=w1200";
