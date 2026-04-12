export function formatCurrencyValue(value?: string | number | null) {
  if (value === null || value === undefined || value === "") {
    return "GHS 0.00";
  }

  const numericValue =
    typeof value === "number" ? value : Number.parseFloat(String(value));

  if (Number.isNaN(numericValue)) {
    return String(value);
  }

  return new Intl.NumberFormat("en-GH", {
    style: "currency",
    currency: "GHS",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(numericValue);
}
