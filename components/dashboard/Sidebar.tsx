"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  LayoutDashboard,
  ShieldCheck,
  TrendingUp,
  Send,
  LogOut,
} from "lucide-react";
import { ConnectKitButton } from "connectkit";
import { createClient } from "@/lib/supabase/client";
import { useRouter } from "next/navigation";

const navItems = [
  { href: "/portfolio", label: "Portfolio", icon: LayoutDashboard },
  { href: "/satoshi-test", label: "Satoshi-Test", icon: ShieldCheck },
  { href: "/staking", label: "Staking", icon: TrendingUp },
  { href: "/send", label: "Senden", icon: Send },
];

export function Sidebar() {
  const pathname = usePathname();
  const router = useRouter();

  async function handleLogout() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  return (
    <aside className="w-64 shrink-0 h-screen sticky top-0 flex flex-col glass border-r border-white/5 px-4 py-6">
      {/* Logo */}
      <div className="mb-8 px-2">
        <span className="text-xl font-bold">
          <span className="text-primary">DO</span>
          <span className="text-foreground"> Crypto</span>
        </span>
        <p className="text-muted-foreground text-xs mt-0.5">Testnet Banking</p>
      </div>

      {/* Nav */}
      <nav className="flex-1 space-y-1">
        {navItems.map(({ href, label, icon: Icon }) => {
          const active = pathname === href;
          return (
            <Link key={href} href={href}>
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

      {/* Bottom section */}
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
    </aside>
  );
}
