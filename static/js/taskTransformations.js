import { sortByStart, splitSegment, mergeContinuousSegments, applyOffsetToSegments } from "./utils.js";

export function toAbsoluteSegments(task) {
  if (!task.segments) return [];
  return task.segments.map(segment => ({
    ...segment,
    start: task.start + (segment.relativeStart ?? 0),
    end: task.start + (segment.relativeEnd ?? 0)
  }));
}

export function wrapActiveTask(task, constantTasks) {
  if (task.type !== "active") return task;
  let absoluteSegments = toAbsoluteSegments(task);

  constantTasks
    .filter(item => item)
    .slice()
    .sort(sortByStart)
    .forEach(constant => {
      const before = [];
      const after = [];
      absoluteSegments.forEach(segment => {
        if (segment.end <= constant.start) {
          before.push(segment);
          return;
        }
        if (segment.start >= constant.end) {
          after.push(segment);
          return;
        }
        const pieces = splitSegment(segment, constant.start);
        const refined = pieces.flatMap(piece => splitSegment(piece, constant.end));
        refined.forEach(part => {
          if (part.end <= constant.start) {
            before.push(part);
          } else {
            after.push(part);
          }
        });
      });
      const offset = constant.end - constant.start;
      const shifted = applyOffsetToSegments(after, offset);
      absoluteSegments = mergeContinuousSegments([...before, ...shifted].sort(sortByStart));
    });

  const firstStart = absoluteSegments[0]?.start ?? task.start;
  const updatedTask = {
    ...task,
    start: firstStart,
    end: absoluteSegments[absoluteSegments.length - 1]?.end ?? task.end,
    duration: (absoluteSegments[absoluteSegments.length - 1]?.end ?? task.end) - firstStart,
    segments: absoluteSegments.map(segment => ({
      type: segment.type,
      name: segment.name,
      relativeStart: segment.start - firstStart,
      relativeEnd: segment.end - firstStart
    }))
  };
  return updatedTask;
}

export function mixActiveTasks(primary, secondary, forward = true) {
  const primarySegments = toAbsoluteSegments(primary);
  const secondarySegments = toAbsoluteSegments(secondary);
  const updatedSecondarySegments = [];

  secondarySegments.forEach(segment => {
    const overlaps = primarySegments.filter(
      primarySegment => !(primarySegment.end <= segment.start || primarySegment.start >= segment.end)
    );
    if (overlaps.length === 0) {
      updatedSecondarySegments.push(segment);
      return;
    }

    let workingPieces = [segment];
    overlaps.forEach(primarySegment => {
      workingPieces = workingPieces.flatMap(piece => splitSegment(piece, primarySegment.start));
      workingPieces = workingPieces.flatMap(piece => splitSegment(piece, primarySegment.end));
      workingPieces = workingPieces.map(piece => {
        if (piece.end <= primarySegment.start || piece.start >= primarySegment.end) return piece;
        return {
          ...piece,
          type: primarySegment.type,
          name: primarySegment.name
        };
      });
    });
    workingPieces.forEach(piece => updatedSecondarySegments.push(piece));
  });

  const normalizedPrimary = mergeContinuousSegments(primarySegments.sort(sortByStart));
  const normalizedSecondary = mergeContinuousSegments(updatedSecondarySegments.sort(sortByStart));

  const forwardPrimary = forward ? primary : secondary;
  const forwardSecondary = forward ? secondary : primary;

  forwardPrimary.start = normalizedPrimary[0]?.start ?? forwardPrimary.start;
  forwardPrimary.end = normalizedPrimary[normalizedPrimary.length - 1]?.end ?? forwardPrimary.end;
  forwardPrimary.segments = normalizedPrimary.map(segment => ({
    type: segment.type,
    name: segment.name,
    relativeStart: segment.start - forwardPrimary.start,
    relativeEnd: segment.end - forwardPrimary.start
  }));
  forwardPrimary.duration = forwardPrimary.end - forwardPrimary.start;

  forwardSecondary.start = normalizedSecondary[0]?.start ?? forwardSecondary.start;
  forwardSecondary.end = normalizedSecondary[normalizedSecondary.length - 1]?.end ?? forwardSecondary.end;
  forwardSecondary.segments = normalizedSecondary.map(segment => ({
    type: segment.type,
    name: segment.name,
    relativeStart: segment.start - forwardSecondary.start,
    relativeEnd: segment.end - forwardSecondary.start
  }));
  forwardSecondary.duration = forwardSecondary.end - forwardSecondary.start;

  return {
    primary: forwardPrimary,
    secondary: forwardSecondary
  };
}
