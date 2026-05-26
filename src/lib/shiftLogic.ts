import { parse, differenceInMinutes, isValid } from 'date-fns';

/**
 * 06:00 AM - 02:00 PM (Morning Shift)
 * 08:00 AM - 05:00 PM (Regular Day Shift)
 * 02:00 PM - 10:00 PM (Afternoon Shift)
 * 10:00 PM - 06:00 AM (Night Shift)
 */
const SHIFTS = [
  { name: 'Morning', start: '06:00', end: '14:00', startMins: 360, endMins: 840 },
  { name: 'Regular', start: '08:00', end: '17:00', startMins: 480, endMins: 1020 },
  { name: 'Afternoon', start: '14:00', end: '22:00', startMins: 840, endMins: 1320 },
  { name: 'Night', start: '22:00', end: '06:00', startMins: 1320, endMins: 360, overnight: true },
];

function timeToMins(timeStr: string): number {
  const [h, m] = timeStr.split(':').map(Number);
  return h * 60 + m;
}

export function detectShiftAndCalculateDiscrepancies(timeIn: string | null, timeOut: string | null) {
  let tardiness = 0;
  let undertime = 0;
  let detectedShift = 'Unknown';

  if (!timeIn) return { tardiness, undertime, detectedShift };
  const inMins = timeToMins(timeIn);

  // Find closest shift start to timeIn
  let closestShift = SHIFTS[0];
  let minDiff = Infinity;

  for (const shift of SHIFTS) {
    let diff = Math.abs(shift.startMins - inMins);
    // Handle midnight wrap-around for night shift closeness
    if (diff > 720) diff = 1440 - diff; 

    if (diff < minDiff) {
      minDiff = diff;
      closestShift = shift;
    }
  }

  detectedShift = closestShift.name;

  // Calculate Tardiness (if they clock in AFTER shift start)
  if (inMins > closestShift.startMins) {
    let diff = inMins - closestShift.startMins;
    if (diff < 720) { // arbitrary threshold to avoid wrap-around falsitives
      tardiness = diff;
    }
  } else if (closestShift.overnight && inMins < 360) {
     // If night shift, and they clocked in after midnight (e.g. 01:00 AM), they are very late
     // Start is 22:00 (1320). 24:00 is 1440. 
     tardiness = (1440 - closestShift.startMins) + inMins;
  }

  // Calculate Undertime (if they clock out BEFORE shift end)
  if (timeOut) {
    const outMins = timeToMins(timeOut);
    if (!closestShift.overnight) {
      if (outMins < closestShift.endMins) {
        undertime = closestShift.endMins - outMins;
      }
    } else {
      // Night shift ends at 06:00 (360). 
      // If they clock out before midnight (e.g. 23:00 / 1380)
      if (outMins > closestShift.startMins) {
        undertime = (1440 - outMins) + closestShift.endMins;
      } else if (outMins < closestShift.endMins) {
        // Clocked out after midnight but before 06:00
        undertime = closestShift.endMins - outMins;
      }
    }
  }

  return { tardiness, undertime, detectedShift };
}
