import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { fetchShop } from "./lib/api";
import { local, readJson, writeJson } from "./lib/storage";
import { isAvailable, type Item } from "./types";

const BAG_KEY = "preloved.bag";

/** A saved bag is only ever a list of ids; anything else in storage is ignored. */
function readBag(): string[] {
  const saved = readJson<unknown>(local, BAG_KEY);
  return Array.isArray(saved) ? [...new Set(saved.filter((id): id is string => typeof id === "string"))].slice(0, 30) : [];
}

function useStoreValue() {
  const [products, setProducts] = useState<Item[]>([]);
  const [whatsappNumber, setWhatsappNumber] = useState("");
  const [postageFee, setPostageFee] = useState(0);
  const [holdMinutes, setHoldMinutes] = useState(0);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [bag, setBag] = useState<string[]>(readBag);
  const [basketOpen, setBasketOpen] = useState(false);

  const reload = useCallback(() => {
    setStatus("loading");
    return fetchShop()
      .then((shop) => {
        setProducts(shop.items);
        setWhatsappNumber(shop.whatsappNumber);
        setPostageFee(shop.postageFee);
        setHoldMinutes(shop.holdMinutes);
        setStatus("ready");
      })
      .catch(() => setStatus("error"));
  }, []);
  useEffect(() => {
    reload();
  }, [reload]);

  useEffect(() => {
    writeJson(local, BAG_KEY, bag);
  }, [bag]);

  const add = useCallback((id: string) => setBag((b) => (b.includes(id) ? b : [...b, id])), []);
  const remove = useCallback((id: string) => setBag((b) => b.filter((x) => x !== id)), []);
  const clearBasket = useCallback(() => setBag([]), []);

  // Statuses come from the catalogue, so an item reserved since it went in the bag shows as gone.
  const lines = useMemo(
    () => bag.map((id) => products.find((p) => p.id === id)).filter((item): item is Item => !!item).map((item) => ({ item, available: isAvailable(item) })),
    [products, bag],
  );
  const items = useMemo(() => lines.filter((line) => line.available).map((line) => line.item), [lines]);

  return {
    products, setProducts, whatsappNumber, postageFee, holdMinutes, status, reload,
    lines, items, add, remove, clearBasket, basketOpen, setBasketOpen,
    inBag: (id: string) => bag.includes(id),
    count: items.length,
    total: Math.round(items.reduce((sum, item) => sum + item.price, 0) * 100) / 100,
  };
}

const StoreContext = createContext<ReturnType<typeof useStoreValue> | null>(null);

export function StoreProvider({ children }: { children: ReactNode }) {
  return <StoreContext.Provider value={useStoreValue()}>{children}</StoreContext.Provider>;
}

export const useStore = () => useContext(StoreContext)!;
