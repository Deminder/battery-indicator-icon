// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

export const PathNodeType = {
  CLOSE: 0,
  CURVE_TO: 1,
  LINE_TO: 2,
  MOVE_TO: 3,
};

const pathNodeTypeToArgCount = {
  [PathNodeType.CLOSE]: 0,
  [PathNodeType.CURVE_TO]: 3,
  [PathNodeType.LINE_TO]: 1,
  [PathNodeType.MOVE_TO]: 1,
};

export function pathFromDescription(description) {
  // Partial implementation of clutter_path_parse_description
  // https://github.com/GNOME/mutter/blob/f1fc9e176200cd14f1b5bba4359ee54a0587f586/clutter/clutter/clutter-path.c#L564
  const charToNodeType = {
    Z: PathNodeType.CLOSE,
    z: PathNodeType.CLOSE,
    C: PathNodeType.CURVE_TO,
    L: PathNodeType.LINE_TO,
    M: PathNodeType.MOVE_TO,
  };

  const path = [];
  const segments = description.split(' ');

  while (segments.length > 0) {
    const typeChar = segments.splice(0, 1)[0].trim();
    if (!(typeChar in charToNodeType)) {
      throw new Error(`Unknown type char: ${typeChar}!`);
    }
    const type = charToNodeType[typeChar];
    const points = [];
    const pointCount = pathNodeTypeToArgCount[type];

    for (let i = 0; i < pointCount; i++) {
      const [x, y] = segments
        .splice(0, 2)
        .map(seg => Number.parseFloat(seg.trim()));
      points.push({ x, y });
    }

    path.push({ type, points });
  }
  return path;
}

export function pathStroke(path, cr) {
  const drawPathNode = {
    [PathNodeType.CLOSE]: () => cr.closePath(),
    [PathNodeType.CURVE_TO]: points => cr.curveTo(...points.slice(0, 6)),
    [PathNodeType.LINE_TO]: points => cr.lineTo(...points.slice(0, 2)),
    [PathNodeType.MOVE_TO]: points => cr.moveTo(...points.slice(0, 2)),
  };
  for (const node of path) {
    drawPathNode[node.type](node.points.flatMap(p => [p.x, p.y]));
  }
}
