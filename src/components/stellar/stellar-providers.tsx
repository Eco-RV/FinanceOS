"use client";

/**
 * Wallet de Stellar (2.9.0): Cavos (correo/Google) + extensiones (Stellar
 * Wallets Kit) detrás de un solo `useWallet()`. Este módulo toca `window`:
 * se carga solo en el navegador con `next/dynamic` (`StellarShell`).
 */

import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { CavosProvider, useCavos } from "@cavos/kit/react";
import { KitEventType, type Networks, StellarWalletsKit } from "@creit.tech/stellar-wallets-kit";
import { defaultModules } from "@creit.tech/stellar-wallets-kit/modules/utils";
import {
  CAVOS_APP_SALT,
  cavosAppId,
  cavosEnvironment,
  isCavosConfigured,
  networkPassphrase,
} from "@/lib/stellar/env";
import { fetchBalances, type SignTransactionFn, type WalletBalances } from "@/infrastructure/stellar/horizon";
import { CavosContext, type CavosState, useCavosState, WalletContext, type WalletConnector } from "./wallet-context";

StellarWalletsKit.init({ network: networkPassphrase as Networks, modules: defaultModules() });

const extensionSign: SignTransactionFn = (xdr, opts) => StellarWalletsKit.signTransaction(xdr, opts);

export default function StellarProviders({ children }: { children: ReactNode }) {
  return (
    <CavosRoot>
      <WalletProvider>{children}</WalletProvider>
    </CavosRoot>
  );
}

function CavosRoot({ children }: { children: ReactNode }) {
  if (!isCavosConfigured) return children;
  return (
    <CavosProvider
      config={{
        appId: cavosAppId,
        environment: cavosEnvironment,
        chains: ["stellar"],
        defaultChain: "stellar",
        network: "testnet",
        appSalt: CAVOS_APP_SALT,
        // Una cadena + restaurar con passkey: no pide configurar recuperación social.
        deviceApproval: "passkey",
        redirectUri: window.location.origin,
      }}
      modal={{ appName: "Finance OS", providers: ["email", "google"], primaryColor: "#7b61ff" }}
    >
      <CavosBridge>{children}</CavosBridge>
    </CavosProvider>
  );
}

function CavosBridge({ children }: { children: ReactNode }) {
  const cavos = useCavos();
  const wallet = cavos.wallet?.chain === "stellar" ? cavos.wallet : null;
  const { needsDeviceApproval, hasPasskey } = cavos.walletStatus;

  const value = useMemo<CavosState>(
    () => ({
      isLoading: cavos.isLoading,
      isAuthenticated: cavos.isAuthenticated,
      address: wallet?.address,
      email: cavos.user?.email,
      needsDeviceApproval,
      error: cavos.authError,
      signIn: cavos.openModal,
      signOut: cavos.logout,
      approveDevice: cavos.approveDeviceWithPasskey,
      addPasskey: cavos.passkeySupported && !hasPasskey ? cavos.enrollPasskeyDefault : undefined,
      // signXdr firma transacciones clásicas y las autorizaciones Soroban de esta
      // cuenta, sin enviarlas (lo mismo que una extensión).
      signTransaction: wallet
        ? async (xdr) => ({ signedTxXdr: await wallet.signXdr(xdr), signerAddress: wallet.address })
        : undefined,
    }),
    [cavos, wallet, needsDeviceApproval, hasPasskey],
  );

  return <CavosContext value={value}>{children}</CavosContext>;
}

const NO_BALANCES: WalletBalances = { exists: false, xlm: null, usdc: null };

function WalletProvider({ children }: { children: ReactNode }) {
  const cavos = useCavosState();
  const [balances, setBalances] = useState<WalletBalances>(NO_BALANCES);
  const [extensionAddress, setExtensionAddress] = useState<string>();
  const [extensionReady, setExtensionReady] = useState(false);

  // Una sesión de Cavos que puede firmar en este dispositivo gana sobre la extensión.
  const cavosSign = cavos?.signTransaction;
  const cavosActive = Boolean(cavos?.address && cavosSign && !cavos.needsDeviceApproval);
  const connector: WalletConnector | undefined = cavosActive
    ? "cavos"
    : extensionAddress
      ? "extension"
      : undefined;
  const address = cavosActive ? cavos?.address : extensionAddress;
  const signTransaction: SignTransactionFn = cavosActive && cavosSign ? cavosSign : extensionSign;

  const updateBalances = useCallback(async () => {
    if (address) setBalances(await fetchBalances(address));
  }, [address]);

  // Saldos de la dirección activa (al conectar o cambiar de wallet).
  useEffect(() => {
    if (!address) return;
    let alive = true;
    void fetchBalances(address).then((b) => {
      if (alive) setBalances(b);
    });
    return () => {
      alive = false;
    };
  }, [address]);

  // La extensión avisa al conectar, al restaurar la sesión y al desconectar.
  useEffect(() => {
    const stopState = StellarWalletsKit.on(KitEventType.STATE_UPDATED, (event) => {
      setExtensionAddress(event.payload.address || undefined);
      setExtensionReady(true);
    });
    const stopDisconnect = StellarWalletsKit.on(KitEventType.DISCONNECT, () => {
      setExtensionAddress(undefined);
    });
    const t = setTimeout(() => setExtensionReady(true), 1500);
    return () => {
      stopState();
      stopDisconnect();
      clearTimeout(t);
    };
  }, []);

  const connectExtension = useCallback(async () => {
    const { address: a } = await StellarWalletsKit.authModal();
    setExtensionAddress(a);
  }, []);

  const disconnect = useCallback(async () => {
    if (connector === "cavos") cavos?.signOut();
    else if (connector === "extension") await StellarWalletsKit.disconnect();
  }, [connector, cavos]);

  const value = useMemo(
    () => ({
      address,
      connector,
      balances: address ? balances : NO_BALANCES,
      isPending: !extensionReady || Boolean(cavos?.isLoading),
      signTransaction,
      updateBalances,
      connectExtension,
      disconnect,
    }),
    [address, connector, balances, extensionReady, cavos?.isLoading, signTransaction, updateBalances, connectExtension, disconnect],
  );

  return <WalletContext value={value}>{children}</WalletContext>;
}
