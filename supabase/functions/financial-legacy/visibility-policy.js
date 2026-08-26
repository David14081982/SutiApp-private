export const BUSINESS_TIME_ZONE = 'America/Hermosillo';

export function businessDateParts(now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const parts = new Intl.DateTimeFormat('en-CA', {
    timeZone, year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(now).reduce((out, part) => {
    if (part.type !== 'literal') out[part.type] = Number(part.value);
    return out;
  }, {});
  return { year: parts.year, month: parts.month, day: parts.day };
}

export function visibilityWindow(now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const { year, month, day } = businessDateParts(now, timeZone);
  const lower = new Date(Date.UTC(year, month - 1, day));
  // Current calendar month plus the following four calendar months, inclusive.
  const upper = new Date(Date.UTC(year, month + 4, 0));
  return { lower, upper, lowerISO: lower.toISOString().slice(0, 10), upperISO: upper.toISOString().slice(0, 10) };
}

export function evaluateVisibility(eventDateISO, requestedMode, now = new Date(), timeZone = BUSINESS_TIME_ZONE) {
  const visibilityMode = String(requestedMode || '').trim().toUpperCase() || 'AUTO';
  if (!['AUTO', 'MOSTRAR', 'OCULTAR'].includes(visibilityMode)) throw new Error('FINANCIAL_CRITERIA_VISIBILITY_INVALID');
  const window = visibilityWindow(now, timeZone);
  const eventDate = eventDateISO ? new Date(eventDateISO + 'T00:00:00Z') : null;
  if (eventDate && Number.isNaN(eventDate.getTime())) throw new Error('FINANCIAL_CRITERIA_DATE_INVALID');
  const automaticVisible = !eventDate || (eventDate >= window.lower && eventDate <= window.upper);
  const effectiveVisible = visibilityMode === 'MOSTRAR' ? true : visibilityMode === 'OCULTAR' ? false : automaticVisible;
  const status = effectiveVisible ? 'AVAILABLE' : eventDate && eventDate > window.upper ? 'SCHEDULED' : 'UNAVAILABLE';
  return {
    visibilityMode,
    automaticVisibility: automaticVisible ? 'VISIBLE' : 'HIDDEN',
    effectiveVisibility: effectiveVisible ? 'VISIBLE' : 'HIDDEN',
    status,
    windowStart: window.lowerISO,
    windowEnd: window.upperISO,
    permanent: !eventDate,
  };
}
