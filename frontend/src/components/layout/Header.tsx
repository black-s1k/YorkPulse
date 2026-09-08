"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import {
  Menu,
  X,
  Shield,
  ShoppingBag,
  Users,
  MessageCircle,
  User,
  LogOut,
  Plus,
  GraduationCap,
  Briefcase,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useAuthStore } from "@/stores/auth";
import { useUIStore } from "@/stores/ui";
import { useLogout } from "@/hooks/useAuth";
import { cn } from "@/lib/utils";

const navItems = [
  { href: "/vault", label: "The Vault", icon: Shield },
  { href: "/marketplace", label: "Marketplace", icon: ShoppingBag },
  { href: "/quests", label: "Side Quests", icon: Users },
  { href: "/gigs", label: "Quick Gigs", icon: Briefcase },
  { href: "/courses", label: "Link Up", icon: GraduationCap },
  { href: "/messages", label: "Messages", icon: MessageCircle },
];

export function Header() {
  const pathname = usePathname();
  const { user, isAuthenticated } = useAuthStore();
  const { isMobileMenuOpen, toggleMobileMenu, closeMobileMenu, openCreateModal } = useUIStore();
  const logout = useLogout();

  const getInitials = (name: string) => {
    return name
      .split(" ")
      .map((n) => n[0])
      .join("")
      .toUpperCase()
      .slice(0, 2);
  };

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-primary shadow-md">
      <div className="container mx-auto px-4">
        <div className="flex items-center justify-between h-16">
          {/* Logo */}
          <Link href="/" className="flex items-center gap-2.5" onClick={closeMobileMenu}>
            <div className="w-8 h-8 rounded-md bg-white flex items-center justify-center">
              <span className="text-primary font-bold text-sm leading-none">YP</span>
            </div>
            <span className="font-semibold text-lg text-white hidden sm:block tracking-tight">
              YorkPulse
            </span>
          </Link>

          {/* Desktop Navigation */}
          <nav className="hidden md:flex items-center gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={cn(
                    "flex items-center gap-2 px-4 py-2 rounded-md text-sm font-medium transition-colors",
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:text-white hover:bg-white/15"
                  )}
                >
                  <item.icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>

          {/* Right Section */}
          <div className="flex items-center gap-2">
            {isAuthenticated ? (
              <>
                {/* Create Button */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      size="sm"
                      className="hidden sm:flex gap-2 bg-white text-primary hover:bg-white/90 font-semibold shadow-none"
                    >
                      <Plus className="w-4 h-4" />
                      Create
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-48">
                    <DropdownMenuItem onClick={() => openCreateModal("vault")}>
                      <Shield className="w-4 h-4 mr-2" />
                      Vault Post
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openCreateModal("marketplace")}>
                      <ShoppingBag className="w-4 h-4 mr-2" />
                      Listing
                    </DropdownMenuItem>
                    <DropdownMenuItem onClick={() => openCreateModal("quest")}>
                      <Users className="w-4 h-4 mr-2" />
                      Side Quest
                    </DropdownMenuItem>
                    <DropdownMenuItem asChild>
                      <Link href="/gigs/create">
                        <Briefcase className="w-4 h-4 mr-2" />
                        Quick Gig
                      </Link>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>

                {/* User Menu */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="rounded-full hover:bg-white/20 text-white"
                    >
                      <Avatar className="w-8 h-8">
                        <AvatarImage src={user?.avatar_url || undefined} />
                        <AvatarFallback className="bg-white/20 text-white text-xs font-semibold">
                          {user?.name ? getInitials(user.name) : "?"}
                        </AvatarFallback>
                      </Avatar>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56">
                    <div className="px-2 py-1.5">
                      <p className="font-medium text-sm">{user?.name || "User"}</p>
                      <p className="text-xs text-gray-500">{user?.email}</p>
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem asChild>
                      <Link href="/profile">
                        <User className="w-4 h-4 mr-2" />
                        Profile
                      </Link>
                    </DropdownMenuItem>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onClick={logout} className="text-red-600">
                      <LogOut className="w-4 h-4 mr-2" />
                      Sign Out
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </>
            ) : (
              <div className="flex items-center gap-2">
                <Button
                  variant="ghost"
                  size="sm"
                  className="text-white hover:bg-white/20 hover:text-white"
                  asChild
                >
                  <Link href="/auth/login">Sign In</Link>
                </Button>
                <Button
                  size="sm"
                  className="bg-white text-primary hover:bg-white/90 font-semibold shadow-none"
                  asChild
                >
                  <Link href="/auth/signup">Get Started</Link>
                </Button>
              </div>
            )}

            {/* Mobile Menu Toggle */}
            <Button
              variant="ghost"
              size="icon"
              className="md:hidden text-white hover:bg-white/20"
              onClick={toggleMobileMenu}
            >
              {isMobileMenuOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </Button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      {isMobileMenuOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          exit={{ opacity: 0, y: -8 }}
          transition={{ duration: 0.2 }}
          className="md:hidden bg-york-red-dark border-t border-white/20"
        >
          <nav className="container mx-auto px-4 py-3 flex flex-col gap-0.5">
            {navItems.map((item) => {
              const isActive = pathname.startsWith(item.href);
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  onClick={closeMobileMenu}
                  className={cn(
                    "flex items-center gap-3 px-4 py-3 rounded-md transition-colors text-sm font-medium",
                    isActive
                      ? "bg-white/20 text-white"
                      : "text-white/80 hover:text-white hover:bg-white/15"
                  )}
                >
                  <item.icon className="w-5 h-5" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </nav>
        </motion.div>
      )}
    </header>
  );
}
