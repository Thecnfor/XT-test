'use client';

import { createContext, useContext, useState, ReactNode } from 'react';

type NavContextType = {
  navLeft: string;
  setNavLeft: (value: string) => void;
};

const NavContext = createContext<NavContextType | undefined>(undefined);

export function NavProvider({ children }: { children: ReactNode }) {
  const [navLeft, setNavLeft] = useState('0px');

  return (
    <NavContext.Provider value={{ navLeft, setNavLeft }}>
      {children}
    </NavContext.Provider>
  );
}

export function useNav() {
  const context = useContext(NavContext);
  if (context === undefined) {
    throw new Error('useNav must be used within a NavProvider');
  }
  return context;
}