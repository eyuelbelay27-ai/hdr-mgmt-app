"use client";

interface StockMaterialOption {
  id: string;
  name: string;
  unit: string;
}

/**
 * The one place a stock item is chosen app-wide (Expenses, Inventory,
 * Budget, Purchase Orders) — never a free-text input. Registering a new
 * stock item name/unit only ever happens once, in the Price Database;
 * everywhere else it's picked from this same list, so the same real item
 * never ends up split across two inventory cards over a typo.
 */
export function StockMaterialSelect({
  materials,
  name = "materialId",
  required = true,
  defaultValue,
  onChange,
  disabled,
}: {
  materials: StockMaterialOption[];
  name?: string;
  required?: boolean;
  defaultValue?: string;
  onChange?: (materialId: string) => void;
  disabled?: boolean;
}) {
  return (
    <select
      className="input"
      name={name}
      required={required}
      defaultValue={defaultValue ?? ""}
      disabled={disabled}
      onChange={(e) => onChange?.(e.target.value)}
    >
      <option value="" disabled>
        {materials.length === 0 ? "No stock items registered yet" : "Choose a stock item…"}
      </option>
      {materials.map((m) => (
        <option key={m.id} value={m.id}>
          {m.name} ({m.unit})
        </option>
      ))}
    </select>
  );
}
