import {
  Building2,
  Factory,
  Zap,
  Hospital,
  ShoppingBag,
  Plane,
  Hammer,
  Server,
  Droplet,
  Trees,
  Truck,
  Wheat,
  Cpu,
  Banknote,
  GraduationCap,
  HeartPulse,
  Hotel,
  Mountain,
  Ship,
  Wrench,
  Building,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

export type SectorIconKey =
  | 'building2'
  | 'factory'
  | 'zap'
  | 'hospital'
  | 'shopping_bag'
  | 'plane'
  | 'hammer'
  | 'server'
  | 'droplet'
  | 'trees'
  | 'truck'
  | 'wheat'
  | 'cpu'
  | 'banknote'
  | 'graduation_cap'
  | 'heart_pulse'
  | 'hotel'
  | 'mountain'
  | 'ship'
  | 'wrench'
  | 'building';

export const SECTOR_ICONS: { key: SectorIconKey; label: string; Icon: LucideIcon }[] = [
  { key: 'building2', label: 'Real estate', Icon: Building2 },
  { key: 'building', label: 'Construction', Icon: Building },
  { key: 'factory', label: 'Industrial', Icon: Factory },
  { key: 'zap', label: 'Energy & utilities', Icon: Zap },
  { key: 'droplet', label: 'Oil, gas & water', Icon: Droplet },
  { key: 'server', label: 'Data centers', Icon: Server },
  { key: 'cpu', label: 'Technology', Icon: Cpu },
  { key: 'truck', label: 'Logistics', Icon: Truck },
  { key: 'ship', label: 'Maritime / shipping', Icon: Ship },
  { key: 'plane', label: 'Aviation', Icon: Plane },
  { key: 'hospital', label: 'Healthcare facility', Icon: Hospital },
  { key: 'heart_pulse', label: 'Healthcare services', Icon: HeartPulse },
  { key: 'shopping_bag', label: 'Retail & consumer', Icon: ShoppingBag },
  { key: 'hotel', label: 'Hospitality', Icon: Hotel },
  { key: 'wheat', label: 'Agriculture', Icon: Wheat },
  { key: 'trees', label: 'Environment', Icon: Trees },
  { key: 'mountain', label: 'Mining & resources', Icon: Mountain },
  { key: 'hammer', label: 'Heavy industry', Icon: Hammer },
  { key: 'wrench', label: 'Industrial services', Icon: Wrench },
  { key: 'banknote', label: 'Financial services', Icon: Banknote },
  { key: 'graduation_cap', label: 'Education', Icon: GraduationCap },
];

const ICON_MAP: Record<string, LucideIcon> = Object.fromEntries(
  SECTOR_ICONS.map(({ key, Icon }) => [key, Icon]),
);

export function resolveSectorIcon(key: string | undefined | null): LucideIcon {
  if (!key) return Building2;
  return ICON_MAP[key] ?? Building2;
}
