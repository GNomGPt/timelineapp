export const MINUTES_IN_DAY = 24 * 60;
export const MINUTE_PX = 4; // scale factor

export function timeToMinutes(value) {
  if (typeof value === "number") return value;
  if (!value) return 0;
  const [h, m] = value.split(":").map(Number);
  return h * 60 + m;
}

export function minutesToTime(mins) {
  const normalized = ((mins % MINUTES_IN_DAY) + MINUTES_IN_DAY) % MINUTES_IN_DAY;
  const h = Math.floor(normalized / 60)
    .toString()
    .padStart(2, "0");
  const m = Math.floor(normalized % 60)
    .toString()
    .padStart(2, "0");
  return `${h}:${m}`;
}

export function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

export function uuid() {
  return "xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx".replace(/[xy]/g, c => {
    const r = (Math.random() * 16) | 0;
    const v = c === "x" ? r : (r & 0x3) | 0x8;
    return v.toString(16);
  });
}

export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

export function roundToMinute(value) {
  return Math.round(value);
}

export function snapToMinute(value) {
  return Math.round(value);
}

export function sortByStart(a, b) {
  return a.start - b.start;
}

export function segmentColor(segment, task) {
  if (segment.type === "cycle") return task.color;
  if (segment.type === "rest") return task.restColor;
  if (segment.type === "break") return task.breakColor;
  return task.color;
}

export function calculateTaskSegments(task) {
  if (task.type !== "active") {
    return [
      {
        type: "constant",
        name: task.name,
        duration: task.duration,
        start: task.start,
        end: task.end
      }
    ];
  }
  let cursor = task.start;
  const segments = [];
  let cycleIndex = 0;
  let cyclesLeft = task.cycles;
  let globalIndex = 0;

  while (cyclesLeft > 0) {
    const cycleName = task.segmentNames?.cycles?.[cycleIndex] ?? `${task.name} #${cycleIndex + 1}`;
    const cycleStart = cursor;
    const cycleEnd = cursor + task.cycleDuration;
    segments.push({
      type: "cycle",
      name: cycleName,
      start: cycleStart,
      end: cycleEnd,
      index: globalIndex++
    });
    cursor = cycleEnd;
    cyclesLeft--;

    const shouldInsertBreak =
      task.breakInterval > 0 &&
      ((task.cycles - cyclesLeft) % task.breakInterval === 0) &&
      task.breakDuration > 0 &&
      cyclesLeft > 0;

    if (shouldInsertBreak) {
      const breakStart = cursor;
      const breakEnd = cursor + task.breakDuration;
      segments.push({
        type: "break",
        name: task.segmentNames?.breaks?.[(task.cycles - cyclesLeft) / task.breakInterval - 1] ?? "Перерыв",
        start: breakStart,
        end: breakEnd,
        index: globalIndex++
      });
      cursor = breakEnd;
    } else if (cyclesLeft > 0 && task.restDuration > 0) {
      const restStart = cursor;
      const restEnd = cursor + task.restDuration;
      segments.push({
        type: "rest",
        name: task.segmentNames?.rests?.[cycleIndex] ?? "Отдых",
        start: restStart,
        end: restEnd,
        index: globalIndex++
      });
      cursor = restEnd;
    }
    cycleIndex++;
  }
  return segments;
}

export function splitSegment(segment, splitPoint) {
  if (splitPoint <= segment.start || splitPoint >= segment.end) return [segment];
  const left = { ...segment, end: splitPoint };
  const right = { ...segment, start: splitPoint };
  return [left, right];
}

export function mergeContinuousSegments(segments) {
  if (segments.length === 0) return [];
  const result = [segments[0]];
  for (let i = 1; i < segments.length; i++) {
    const prev = result[result.length - 1];
    const current = segments[i];
    if (prev.type === current.type && prev.name === current.name && prev.end === current.start) {
      prev.end = current.end;
    } else {
      result.push({ ...current });
    }
  }
  return result;
}

export function applyOffsetToSegments(segments, offset) {
  return segments.map(segment => ({
    ...segment,
    start: segment.start + offset,
    end: segment.end + offset
  }));
}

export function totalDuration(segments) {
  return segments.reduce((acc, segment) => acc + (segment.end - segment.start), 0);
}
