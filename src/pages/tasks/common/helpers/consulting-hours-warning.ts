export interface ConsultingHoursSnapshot {
  consulting_hours_balance: number;
  consulting_hours_funded: boolean;
  consulting_hours_warn_at: number;
}

export function consultingHoursWarning(
  snapshot: ConsultingHoursSnapshot | undefined,
  locale: string
) {
  if (!snapshot || snapshot.consulting_hours_funded !== true) {
    return null;
  }

  const {
    consulting_hours_balance: balance,
    consulting_hours_warn_at: threshold,
  } = snapshot;

  if (
    !Number.isFinite(balance) ||
    !Number.isFinite(threshold) ||
    threshold < 0 ||
    balance > threshold
  ) {
    return null;
  }

  return {
    depleted: balance <= 0,
    // Never display zero for a small, positive balance.
    remaining:
      balance > 0 && balance < 0.01
        ? new Intl.NumberFormat(locale, { maximumFractionDigits: 6 }).format(
            balance
          )
        : new Intl.NumberFormat(locale, { maximumFractionDigits: 2 }).format(
            Math.max(0, balance)
          ),
  };
}
