import { useEffect, useState } from "react";
import { Admin } from "./admin/Admin";
import { config } from "./config";
import { parseHash } from "./lib/route";
import { Shop } from "./shop/Shop";
import { StoreProvider } from "./store";

const current = () => parseHash(window.location.hash);

/** Hash routes, because a static host can't serve an SPA fallback for real paths. */
export function App() {
  const [{ route, query }, setLocation] = useState(current);

  useEffect(() => {
    const onChange = () => {
      setLocation(current());
      window.scrollTo(0, 0);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);

  const isAdmin = route.name === "admin";

  useEffect(() => {
    document.title = isAdmin ? `Admin, ${config.shopName}` : config.shopName;
  }, [isAdmin]);

  return <StoreProvider>{isAdmin ? <Admin /> : <Shop route={route} query={query} />}</StoreProvider>;
}
