/**
 * Receive Check Status Calculator
 * Core Business Logic according to specifications
 */

/**
 * คำนวณ status และ difference ของสินค้าแต่ละชิ้น
 * difference = received - roQty
 * - difference === 0 (received === roQty) -> OK
 * - difference < 0 (received < roQty) -> SHORT
 * - difference > 0 (received > roQty) -> OVER
 * - received === null || received === undefined -> WAITING
 */
export function getReceiveItemStatus(roQty, received) {
  const safeRoQty = Number(roQty) || 0;

  if (received === null || received === undefined || received === '') {
    return {
      status: 'WAITING',
      difference: -safeRoQty,
      isDifference: safeRoQty > 0,
      label: 'Waiting',
      badgeColor: 'bg-slate-100 text-slate-600 border-slate-200 dark:bg-slate-800 dark:text-slate-400 dark:border-slate-700'
    };
  }

  const safeReceived = Number(received) || 0;
  const diff = safeReceived - safeRoQty;

  if (diff === 0) {
    return {
      status: 'OK',
      difference: 0,
      isDifference: false,
      label: 'Matched (OK)',
      badgeColor: 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800'
    };
  } else if (diff < 0) {
    return {
      status: 'SHORT',
      difference: diff,
      isDifference: true,
      label: `Short ${Math.abs(diff)}`,
      badgeColor: 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800'
    };
  } else {
    return {
      status: 'OVER',
      difference: diff,
      isDifference: true,
      label: `Over +${diff}`,
      badgeColor: 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800'
    };
  }
}

/**
 * Calculate overall status of the RO
 */
export function getROOverallStatus(items = []) {
  if (!items || items.length === 0) {
    return {
      status: 'WAITING',
      label: 'Waiting',
      badgeClass: 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700',
      totalRoQty: 0,
      totalReceived: 0,
      okCount: 0,
      shortCount: 0,
      overCount: 0,
      waitingCount: 0
    };
  }

  let totalRoQty = 0;
  let totalReceived = 0;
  let okCount = 0;
  let shortCount = 0;
  let overCount = 0;
  let waitingCount = 0;
  let hasAnyInput = false;

  items.forEach(item => {
    const roQty = Number(item.roQty) || 0;
    const received = item.received;
    totalRoQty += roQty;

    if (received !== null && received !== undefined && received !== '') {
      hasAnyInput = true;
      const recVal = Number(received) || 0;
      totalReceived += recVal;

      const diff = recVal - roQty;
      if (diff === 0) okCount++;
      else if (diff < 0) shortCount++;
      else overCount++;
    } else {
      waitingCount++;
    }
  });

  let status = 'WAITING';
  let label = 'Waiting';
  let badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';

  if (!hasAnyInput) {
    status = 'WAITING';
    label = 'Waiting';
    badgeClass = 'bg-slate-100 text-slate-700 border-slate-200 dark:bg-slate-800 dark:text-slate-300 dark:border-slate-700';
  } else if (waitingCount > 0) {
    status = 'CHECKING';
    label = 'Checking';
    badgeClass = 'bg-blue-50 text-blue-700 border-blue-200 dark:bg-blue-950/40 dark:text-blue-400 dark:border-blue-800';
  } else {
    if (shortCount === 0 && overCount === 0) {
      status = 'COMPLETED';
      label = 'Completed (OK)';
      badgeClass = 'bg-emerald-50 text-emerald-700 border-emerald-200 dark:bg-emerald-950/40 dark:text-emerald-400 dark:border-emerald-800';
    } else if (shortCount > 0 && overCount === 0) {
      status = 'SHORT';
      label = `Short (${shortCount} items)`;
      badgeClass = 'bg-rose-50 text-rose-700 border-rose-200 dark:bg-rose-950/40 dark:text-rose-400 dark:border-rose-800';
    } else if (overCount > 0 && shortCount === 0) {
      status = 'OVER';
      label = `Over (${overCount} items)`;
      badgeClass = 'bg-amber-50 text-amber-700 border-amber-200 dark:bg-amber-950/40 dark:text-amber-400 dark:border-amber-800';
    } else {
      status = 'DIFFERENCE';
      label = `Difference (Short/Over)`;
      badgeClass = 'bg-purple-50 text-purple-700 border-purple-200 dark:bg-purple-950/40 dark:text-purple-400 dark:border-purple-800';
    }
  }

  return {
    status,
    label,
    badgeClass,
    totalRoQty,
    totalReceived,
    okCount,
    shortCount,
    overCount,
    waitingCount
  };
}
