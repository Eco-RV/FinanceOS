import type { ComponentType } from "react";
import {
  Baby,
  Banknote,
  Bike,
  BookOpen,
  Briefcase,
  Bus,
  Car,
  Coffee,
  CreditCard,
  Droplets,
  Dumbbell,
  Film,
  Fuel,
  Gamepad2,
  Gift,
  GraduationCap,
  HandCoins,
  HeartPulse,
  House,
  Landmark,
  Laptop,
  Music,
  PawPrint,
  Percent,
  PiggyBank,
  Pill,
  Pizza,
  Plane,
  Popcorn,
  Receipt,
  Repeat,
  Salad,
  Scissors,
  Shield,
  Shirt,
  ShoppingBag,
  ShoppingCart,
  Smartphone,
  Sofa,
  Sparkles,
  Store,
  Tag,
  TrendingUp,
  Tv,
  Users,
  Utensils,
  Wifi,
  Wrench,
  Zap,
} from "lucide-react";
import type { CategoryIconKey } from "@/lib/category-icon-keys";
import { cn } from "@/lib/utils";

type IconType = ComponentType<{ className?: string }>;

/** Kit de íconos de categoría (2.5.0): trazo de lucide, mismo estilo que la app. */
export const CATEGORY_ICONS: Record<CategoryIconKey, IconType> = {
  utensils: Utensils,
  coffee: Coffee,
  pizza: Pizza,
  salad: Salad,
  "shopping-cart": ShoppingCart,
  "shopping-bag": ShoppingBag,
  store: Store,
  car: Car,
  fuel: Fuel,
  bus: Bus,
  bike: Bike,
  plane: Plane,
  home: House,
  sofa: Sofa,
  zap: Zap,
  droplets: Droplets,
  wifi: Wifi,
  smartphone: Smartphone,
  tv: Tv,
  "heart-pulse": HeartPulse,
  pill: Pill,
  dumbbell: Dumbbell,
  "graduation-cap": GraduationCap,
  "book-open": BookOpen,
  film: Film,
  popcorn: Popcorn,
  gamepad: Gamepad2,
  music: Music,
  repeat: Repeat,
  shirt: Shirt,
  sparkles: Sparkles,
  scissors: Scissors,
  gift: Gift,
  "paw-print": PawPrint,
  baby: Baby,
  users: Users,
  wrench: Wrench,
  shield: Shield,
  receipt: Receipt,
  landmark: Landmark,
  "credit-card": CreditCard,
  "piggy-bank": PiggyBank,
  briefcase: Briefcase,
  laptop: Laptop,
  "hand-coins": HandCoins,
  percent: Percent,
  "trending-up": TrendingUp,
  banknote: Banknote,
  tag: Tag,
};

/** Tintes suaves para la burbuja del ícono (estable por clave). */
const TINTS = [
  "bg-chart-1/15 text-chart-1",
  "bg-chart-2/15 text-chart-2",
  "bg-chart-3/15 text-chart-3",
  "bg-chart-4/20 text-chart-4",
  "bg-chart-5/15 text-chart-5",
];

function tintFor(key: string): string {
  let h = 0;
  for (const ch of key) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return TINTS[h % TINTS.length];
}

export function CategoryIcon({
  icon,
  className,
}: {
  icon: CategoryIconKey;
  className?: string;
}) {
  const Icon = CATEGORY_ICONS[icon] ?? Tag;
  return <Icon className={className} />;
}

/** Ícono dentro de una burbuja de color (listas, selector, gráfico). */
export function CategoryBadge({
  icon,
  size = "md",
  className,
}: {
  icon: CategoryIconKey;
  size?: "sm" | "md" | "lg";
  className?: string;
}) {
  return (
    <span
      className={cn(
        "grid shrink-0 place-items-center rounded-xl",
        tintFor(icon),
        size === "sm" && "size-7 rounded-lg [&_svg]:size-3.5",
        size === "md" && "size-9 [&_svg]:size-[18px]",
        size === "lg" && "size-11 [&_svg]:size-5",
        className,
      )}
    >
      <CategoryIcon icon={icon} />
    </span>
  );
}
