"use client";

import { createContext, useContext, useState } from "react";

const BuyerCartContext = createContext(null);

export function BuyerCartProvider({ children }) {
  const [cart, setCart] = useState([]);

  return (
    <BuyerCartContext.Provider value={{ cart, setCart }}>
      {children}
    </BuyerCartContext.Provider>
  );
}

export function useBuyerCart() {
  const context = useContext(BuyerCartContext);
  if (!context) throw new Error("The marketplace must be rendered inside BuyerCartProvider.");
  return context;
}
