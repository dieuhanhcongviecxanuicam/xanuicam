export function roundToNearestMinutes(date, minutes = 15) {
  const ms = 1000 * 60 * minutes;
  return new Date(Math.ceil(date.getTime() / ms) * ms);
}

export function snapToNearestMinutes(date, minutes = 15) {
  const ms = 1000 * 60 * minutes;
  return new Date(Math.round(date.getTime() / ms) * ms);
}
