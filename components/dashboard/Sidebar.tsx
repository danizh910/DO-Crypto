"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Send,
  QrCode,
  Receipt,
  Settings,
  LogOut,
  Menu,
  X,
} from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";
import { useState } from "react";

const navItems = [
  { href: "/portfolio",     label: "Portfolio",      icon: LayoutDashboard },
  { href: "/transactions",  label: "Transaktionen",  icon: Receipt },
  { href: "/send",          label: "Senden",         icon: Send },
  { href: "/receive",       label: "Empfangen",      icon: QrCode },
  { href: "/staking",       label: "Staking",        icon: TrendingUp },
  { href: "/satoshi-test",  label: "Satoshi-Test",   icon: ShieldCheck },
  { href: "/settings",      label: "Einstellungen",  icon: Settings },
];

function NavContent({ onClose }: { onClose?: () => void }) {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
    onClose?.();
  }

  return (
    <>
      {/* Logo */}
      <div className="mb-8 px-2 flex items-center justify-between">
        <div>
          <span className="text-xl font-bold">
            <span className="text-primary">DO</span>
            <span className="text-foreground"> Crypto</span>
          </span>
          <p className="text-muted-foreground text-xs mt-0.5">Testnet Banking</p>
        </div>
        {onClose && (
          <button onClick={onClose} className="text-muted-foreground hover:text-foreground transition-colors md:hidden">
            <X className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href} onClick={onClose}>
              <motion.div
                whileHover={{ x: 2 }}
                className={`flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm transition-colors ${
                  active
                    ? "bg-primary/10 text-primary font-medium"
                    : "text-muted-foreground hover:text-foreground hover:bg-white/5"
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                {label}
                {active && (
                  <motion.div
                    layoutId="sidebar-indicator"
                    className="ml-auto w-1 h-4 rounded-full bg-primary"
                  />
                )}
              </motion.div>
            </Link>
          );
        })}
      </nav>

      {/* Bottom */}
      <div className="space-y-3 pt-4 border-t border-white/5">
        <div className="flex justify-center">
          <ConnectKitButton />
        </div>
        <button
          onClick={handleLogout}
          className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm text-muted-foreground hover:text-destructive hover:bg-white/5 transition-colors"
        >
          <LogOut className="w-4 h-4" />
          Abmelden
        </button>
      </div>
    </>
  );
}

export function Sidebar() {
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <>
      {/* Mobile top bar */}
      <div className="md:hidden fixed top-0 left-0 right-0 z-40 flex items-center justify-between px-4 py-3 glass border-b border-white/5">
        <span className="text-base font-bold">
          <span className="text-primary">DO</span>
          <span className="text-foreground"> Crypto</span>
        </span>
        <button
          onClick={() => setMobileOpen(true)}
          className="text-muted-foreground hover:text-foreground transition-colors"
        >
          <Menu className="w-5 h-5" />
        </button>
      </div>

      {/* Mobile overlay */}
      <AnimatePresence>
        {mobileOpen && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 z-40 bg-black/60 md:hidden"
              onClick={() => setMobileOpen(false)}
            />
            <motion.aside
              initial={{ x: -280 }}
              animate={{ x: 0 }}
              exit={{ x: -280 }}
              transition={{ type: "spring", stiffness: 300, damping: 30 }}
              className="fixed left-0 top-0 bottom-0 z-50 w-64 flex flex-col glass border-r border-white/5 px-4 py-6 md:hidden"
            >
              <NavContent onClose={() => setMobileOpen(false)} />
            </motion.aside>
          </>
        )}
      </AnimatePresence>

      {/* Desktop sidebar */}
      <aside className="hidden md:flex w-64 shrink-0 h-screen sticky top-0 flex-col glass border-r border-white/5 px-4 py-6">
        <NavContent />
      </aside>
    </>
  );
}
