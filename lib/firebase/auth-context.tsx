"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react";
import type { User } from "firebase/auth";
import { onIdTokenChanged, signOut as firebaseSignOut } from "firebase/auth";
import { auth } from "./client";
import { isAdminClaim, type AdminClaims } from "./claims";

type AuthState = {
  user: User | null;
  claims: AdminClaims | null;
  isAdmin: boolean;
  loading: boolean;
  /** Forces a fresh ID token fetch so newly-granted claims are picked up without a re-login. */
  refreshClaims: () => Promise<AdminClaims | null>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [claims, setClaims] = useState<AdminClaims | null>(null);
  const [loading, setLoading] = useState(true);

  const refreshClaims = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) {
      setClaims(null);
      return null;
    }
    const tokenResult = await current.getIdTokenResult(true);
    const nextClaims: AdminClaims = {
      admin: tokenResult.claims.admin === true,
      role: typeof tokenResult.claims.role === "string" ? tokenResult.claims.role : undefined,
    };
    setClaims(nextClaims);
    return nextClaims;
  }, []);

  useEffect(() => {
    const unsubscribe = onIdTokenChanged(auth, async (nextUser) => {
      setUser(nextUser);
      if (!nextUser) {
        setClaims(null);
        setLoading(false);
        return;
      }
      const tokenResult = await nextUser.getIdTokenResult();
      setClaims({
        admin: tokenResult.claims.admin === true,
        role: typeof tokenResult.claims.role === "string" ? tokenResult.claims.role : undefined,
      });
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  const signOut = useCallback(async () => {
    await firebaseSignOut(auth);
  }, []);

  const value = useMemo<AuthState>(
    () => ({
      user,
      claims,
      isAdmin: isAdminClaim(claims),
      loading,
      refreshClaims,
      signOut,
    }),
    [user, claims, loading, refreshClaims, signOut],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthState {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
