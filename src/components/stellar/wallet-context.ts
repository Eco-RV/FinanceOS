"use client";

import { createContext, use } from "react";
import type { SignTransactionFn, WalletBalances } from "@/infrastructure/stellar/horizon";

/**
 * Estado de Cavos que necesita el resto de la app, sin depender del SDK.
 * `null` cuando no hay App ID de Cavos.
 */
export interface CavosState {
  isLoading: boolean;
  isAuthenticated: boolean;
  /** Dirección `G…` de la wallet (se conoce antes de que exista en la red). */
  address?: string;
  email?: string;
  /** Sesión iniciada en un navegador que todavía no tiene la llave. */
  needsDeviceApproval: boolean;
  error: string | null;
  signIn: () => void;
  signOut: () => void;
  approveDevice: () => Promise<void>;
  addPasskey?: () => Promise<void>;
  signTransaction?: SignTransactionFn;
}

export const CavosContext = createContext<CavosState | null>(null);
export const useCavosState = () => use(CavosContext);

/** "cavos" = correo/Google · "extension" = Freighter, xBull… */
export type WalletConnector = "cavos" | "extension";

export interface WalletContextType {
  address?: string;
  connector?: WalletConnector;
  balances: WalletBalances;
  isPending: boolean;
  /** Única forma de firmar (Cavos o extensión): las pantallas nunca importan los SDK. */
  signTransaction: SignTransactionFn;
  updateBalances: () => Promise<void>;
  connectExtension: () => Promise<void>;
  disconnect: () => Promise<void>;
}

export const WalletContext = createContext<WalletContextType | null>(null);

/** La wallet conectada. Solo dentro de `StellarProviders` (pestaña Constelación). */
export function useWallet(): WalletContextType {
  const ctx = use(WalletContext);
  if (!ctx) throw new Error("useWallet debe usarse dentro de StellarProviders");
  return ctx;
}
