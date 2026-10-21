export interface DecomposableUnit {
  level: number;
  label: string;
  qty_in_parent: number;
}

/**
 * Decompose une quantite exprimee en unite de base (Niveau 1) en un texte
 * du type "2 Carton(s) + 3 Paquet(s) + 4 Piece(s)", en utilisant TOUS les
 * niveaux definis pour le produit (pas seulement le niveau parent immediat).
 */
export function decomposeStock(baseQty: number, units: DecomposableUnit[]): string {
  const sorted = [...units].sort((a, b) => b.level - a.level);
  const level1 = sorted.find(u => u.level === 1);
  if (!level1 || sorted.length <= 1) {
    return `${baseQty} ${level1?.label || 'unite(s)'}`;
  }

  // Facteur cumule vers la base, pour chaque niveau (produit des qty_in_parent
  // de ce niveau jusqu'au niveau 1).
  const factors = new Map<number, number>();
  for (const u of [...sorted].sort((a, b) => a.level - b.level)) {
    if (u.level === 1) {
      factors.set(1, 1);
    } else {
      const parentFactor = factors.get(u.level - 1) || 1;
      factors.set(u.level, u.qty_in_parent * parentFactor);
    }
  }

  let remaining = baseQty;
  const parts: string[] = [];
  for (const u of sorted) {
    if (u.level === 1) continue;
    const factor = factors.get(u.level) || 1;
    const count = Math.floor(remaining / factor);
    remaining -= count * factor;
    if (count > 0) parts.push(`${count} ${u.label}`);
  }
  parts.push(`${remaining} ${level1.label}`);

  return parts.join(' + ');
}