"use client";

import { createContext, useContext, useSyncExternalStore } from "react";

const BuyerCartContext = createContext(null);
const CART_STORAGE_KEY = "buildmart-buyer-cart";
const EMPTY_CART = [];
const listeners = new Set();
let cartSnapshot = EMPTY_CART;
let cartLoaded = false;

function isCartItem(item) {
  return item &&
    typeof item.id === "string" &&
    typeof item.title === "string" &&
    typeof item.category === "string" &&
    typeof item.image_url === "string" &&
    Number.isSafeInteger(item.price_kobo) &&
    item.price_kobo > 0 &&
    Number.isInteger(item.quantity) &&
    item.quantity > 0 &&
    item.quantity <= 99;
}

function readSavedCart() {
  try {
    const savedCart = JSON.parse(window.localStorage.getItem(CART_STORAGE_KEY) ?? "[]");
    if (!Array.isArray(savedCart)) throw new Error("Saved cart data is not a list.");
    return savedCart.filter(isCartItem);
  } catch (error) {
    console.error("Unable to restore the saved cart", error);
    return [];
  }
}

function notifyCartChanged() {
  for (const listener of listeners) listener();
}

function getCartSnapshot() {
  return cartSnapshot;
}

function subscribeToCart(listener) {
  listeners.add(listener);
  if (!cartLoaded) {
    cartSnapshot = readSavedCart();
    cartLoaded = true;
  }

  function handleStorage(event) {
    if (event.key !== CART_STORAGE_KEY && event.key !== null) return;
    cartSnapshot = readSavedCart();
    notifyCartChanged();
  }

  window.addEventListener("storage", handleStorage);
  return () => {
    listeners.delete(listener);
    window.removeEventListener("storage", handleStorage);
  };
}

function setCart(update) {
  const nextCart = typeof update === "function" ? update(cartSnapshot) : update;
  cartSnapshot = Array.isArray(nextCart) ? nextCart.filter(isCartItem) : EMPTY_CART;
  cartLoaded = true;
  try {
    window.localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(cartSnapshot));
  } catch (error) {
    console.error("Unable to save the cart for the next visit", error);
  }
  notifyCartChanged();
}

export function BuyerCartProvider({ children }) {
  const cart = useSyncExternalStore(subscribeToCart, getCartSnapshot, () => EMPTY_CART);

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
