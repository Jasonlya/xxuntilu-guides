'use client';

import { createContext, useContext, useMemo, useState } from 'react';

interface NavContextValue {
  navOpen: boolean;
  setNavOpen: (open: boolean) => void;
}

const NavContext = createContext<NavContextValue>({ navOpen: false, setNavOpen: () => {} });

export function NavProvider({ children }: { children: React.ReactNode }) {
  const [navOpen, setNavOpen] = useState(false);
  const value = useMemo(() => ({ navOpen, setNavOpen }), [navOpen]);
  return <NavContext.Provider value={value}>{children}</NavContext.Provider>;
}

export function useNav() {
  return useContext(NavContext);
}
