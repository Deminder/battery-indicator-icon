// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

const { GObject, St, Clutter, PangoCairo } = imports.gi;
const Cairo = imports.cairo;

var BInner = {
  EMPTY: 0,
  CHARGING: 1,
  TEXT: 2,
  VTEXT: 3,
};

const CAIRO_LINE_CAP_ROUND = 1;

function circXY(radius, angle) {
  return [radius * Math.cos(angle), radius * Math.sin(angle)];
}

var BStatusStyle = {
  BOLD: 0,
  SLIM: 1,
  PLUMP: 2,
  PLAIN: 3,
  CIRCLE: 4,
  HIDE: 5,
};

function batteryIconPaint(
  cr,
  buttonPathFunc,
  buttonDraw,
  innerRectPathFunc,
  rectDraw,
  style
) {
  const drawMethod = method => {
    if (method === 'fill') {
      cr.fill();
    } else if (method === 'stroke') {
      cr.stroke();
    }
  };
  Clutter.cairo_set_source_color(cr, style.fColor);
  // Battery button: (fill) rectangle, arc or (stroke) line
  buttonPathFunc(cr, style);
  drawMethod(buttonDraw);
  // Battery body: rounded rectangle (fill plain or stroke outline)
  bodyPath(cr, style);
  cr.clipPreserve();
  cr.setLineWidth(style.strokeWidth);
  drawMethod(rectDraw);

  // Fill inner battery: (rounded) rectangle
  Clutter.cairo_set_source_color(cr, style.fillColor);
  innerRectPathFunc(cr, style);
  cr.fill();

  cr.resetClip();
}

function roundedRectPath(cr, x, y, bW, bH, r) {
  // Battery body: rounded rectangle (x,y,bW,bH)
  const cAngle = 0.5 * Math.PI;
  const aW = bW < r ? Math.asin((r - bW) / r) : 0;
  const aH = bH < r ? Math.asin((r - bH) / r) : 0;
  const rW = Math.min(r, bW - r);
  const rH = Math.min(r, bH - r);
  cr.newSubPath();
  if (aW === 0 && aH === 0) {
    // Top right
    const rr = Math.min(rW, rH);
    cr.arc(x + bW - rr, y + rr, rr, -cAngle, -aH);
  }
  if (aW === 0) {
    // Bottom right
    cr.arc(x + bW - rW, y + bH - rW, rW, aH, cAngle);
  }
  // Bottom left
  cr.arc(x + r, y + bH - r, r, cAngle + aW, 2 * cAngle - aH);
  if (aH === 0) {
    // Top left
    cr.arc(x + rH, y + rH, rH, 2 * cAngle + aH, 3 * cAngle - aW);
  }
  cr.closePath();
}

var BatteryDrawIcon = GObject.registerClass(
  {
    Properties: {
      inner: GObject.ParamSpec.int(
        'inner',
        'inner',
        'inner',
        GObject.ParamFlags.READWRITE,
        BInner.EMPTY
      ),
      percentage: GObject.ParamSpec.int(
        'percentage',
        'percentage',
        'percentage',
        GObject.ParamFlags.READWRITE,
        0
      ),
      'status-style': GObject.ParamSpec.int(
        'status-style',
        'status-style',
        'status-style',
        GObject.ParamFlags.READWRITE,
        BStatusStyle.BOLD
      ),
      vertical: GObject.ParamSpec.boolean(
        'vertical',
        'vertical',
        'vertical',
        GObject.ParamFlags.READWRITE,
        true
      ),
    },
  },
  class BatteryDrawIcon extends St.DrawingArea {
    // eslint-disable-next-line camelcase
    _init({ style_class, idolWidget }) {
      super._init({
        y_align: Clutter.ActorAlign.CENTER,
        // eslint-disable-next-line camelcase
        style_class,
      });
      this.idolWidget = idolWidget;

      // https://github.com/LineageOS/android_frameworks_base/blob/-/packages/SettingsLib/src/com/android/settingslib/graph/BatteryMeterDrawableBase.java#L158
      this._bolt_path = Clutter.Path.new_with_description(
        'M 165 0 L 887 0 L 455 368 L 1000 368 L 9 1000 L 355 475 L 0 475 z'
      );
      this._plump_bolt_path = plumpBoltPath();
      for (const signal of [
        'style-changed',
        'notify::inner',
        'notify::percentage',
        'notify::status-style',
        'notify::vertical',
      ]) {
        this.connect(signal, () => this.queue_repaint());
      }
      this.queue_repaint();
    }

    get iconColors() {
      const themeNode = this.get_theme_node();
      // Get colors from idol icon (StIcon)
      return this.idolWidget
        ? St.ThemeNode.new(
            St.ThemeContext.get_for_stage(global.stage) /* context */,
            themeNode.get_parent() /* parent_node */,
            themeNode.get_theme() /* theme */,
            this.idolWidget.constructor.$gtype /* element_type */,
            null /* element_id */,
            this.idolWidget.style_class ?? '' /* style_class */,
            themeNode.get_pseudo_classes().join(' ') /* pseudo_class */,
            this.idolWidget.style ?? '' /* inline_style */
          ).get_icon_colors()
        : themeNode.get_icon_colors();
    }

    _bold(cr, style) {
      const eps = style.strokeWidth * 0.05;
      const innerRectPath = (_, { strokeWidth }, reversed) => {
        innerPercentageRectPath(
          cr,
          strokeWidth / 2 - eps /* 0-width border */,
          0 /* cornerRadius */,
          style,
          reversed
        );
      };
      batteryIconPaint(
        cr,
        () =>
          rectangleButtonPath(cr, {
            ...style,
            bThickness: style.bThickness + eps,
          }),
        'fill',
        innerRectPath,
        'stroke',
        style
      );

      Clutter.cairo_set_source_color(cr, style.fColor);
      cr.save();
      cr.setOperator(Cairo.Operator.DEST_OUT);
      innerContentPath(cr, style);
      cr.fill();
      cr.restore();

      cr.setOperator(Cairo.Operator.OVER);
      innerRectPath(cr, style, true);
      cr.clip();
      innerContentPath(cr, style);
      cr.fill();
    }

    _slim(cr, style) {
      const border = style.strokeWidth * 1.25;
      batteryIconPaint(
        cr,
        lineButtonPath,
        'stroke',
        () => innerPercentageRectPath(cr, border, border / 2, style),
        'stroke',
        style
      );

      Clutter.cairo_set_source_color(cr, style.fColor);
      innerContentPath(cr, style);
      cr.fill();
    }

    _plump(cr, style) {
      const border = style.strokeWidth * 0.75;
      batteryIconPaint(
        cr,
        arcButtonPath,
        'fill',
        () => innerPercentageRectPath(cr, border, border / 4, style),
        'stroke',
        style
      );

      Clutter.cairo_set_source_color(cr, style.fColor);
      cr.setOperator(Cairo.Operator.DEST_OUT);
      cr.setLineCap(CAIRO_LINE_CAP_ROUND);
      const outlineWidth = plumpInnerContentPath(cr, style);
      cr.setLineWidth(outlineWidth);

      cr.strokePreserve();
      cr.setOperator(Cairo.Operator.OVER);
      cr.fill();
    }

    _plain(cr, style) {
      batteryIconPaint(
        cr,
        rectangleButtonPath,
        '',
        (_, { w, h, p, vertical }) => {
          if (vertical) {
            cr.rectangle(0, h * (1 - p), w, h * p);
          } else {
            cr.rectangle(0, 0, w * p, h);
          }
        },
        'fill',
        style
      );

      Clutter.cairo_set_source_color(cr, Clutter.Color.get_static('white'));
      cr.setOperator(Cairo.Operator.DEST_OUT);
      innerContentPath(cr, style);
      cr.fill();
    }

    _circle(cr, style) {
      const { w, h, strokeWidth, fColor, fillColor, p } = style;
      const size = h;
      const radius = (size - strokeWidth) / 2;
      const [cw, ch] = [w / 2, h / 2];
      const bColor = fColor.copy();
      bColor.alpha *= 0.5;

      cr.save();
      Clutter.cairo_set_source_color(cr, bColor);
      // Circle Background
      cr.setLineWidth(strokeWidth);
      cr.translate(cw, ch);
      cr.scale(w / size, h / size);
      cr.arc(0, 0, radius, 0, 2 * Math.PI);
      cr.stroke();

      // Circle fill foreground
      Clutter.cairo_set_source_color(cr, fillColor);
      const angleOffset = -0.5 * Math.PI;
      cr.arc(0, 0, radius, angleOffset, angleOffset + p * 2 * Math.PI);
      cr.stroke();
      cr.restore();

      Clutter.cairo_set_source_color(cr, fColor);
      innerContentPath(cr, style);
      cr.fill();
    }

    vfunc_repaint() {
      const themeNode = this.get_theme_node();
      const iconColors = this.iconColors;
      const [charging, hText, vText] = [
        BInner.CHARGING,
        BInner.TEXT,
        BInner.VTEXT,
      ].map(s => this.inner === s);
      const [bold, slim, plump, plain, circle] = [
        BStatusStyle.BOLD,
        BStatusStyle.SLIM,
        BStatusStyle.PLUMP,
        BStatusStyle.PLAIN,
        BStatusStyle.CIRCLE,
      ].map(s => this.statusStyle === s);
      const fColor =
        this.percentage > 5 || charging
          ? iconColors.foreground
          : iconColors.error;
      const bColor = fColor.copy();
      bColor.alpha *= 0.5;
      const fillColor =
        plump && charging
          ? iconColors.success
          : this.percentage > 15
          ? slim
            ? bColor
            : fColor
          : this.percentage > 5
          ? iconColors.warning
          : iconColors.error;

      // Draw battery icon
      const cr = this.get_context();

      const [w, h] = this.get_surface_size();
      const buttonRatio = plump ? 0.7 : 0.58;
      const verticalBodyWidth = w * buttonRatio;
      const horizontalBodyHeight = h;
      const verticalBattery = circle || this.vertical;
      const one = h / 16;
      const strokeWidth =
        (plump ? 5.333 : slim ? 2 : verticalBattery ? 2.46 : 4) * one;
      const cornerRadius = slim
        ? strokeWidth * 2
        : plump
        ? strokeWidth * 0.75
        : 1.5 * one;
      // Battery button width and height (vertical: V/horizontal: H)
      const bFrac = plump ? 0.176 : slim ? 0.3 : 0.44;
      const bThickness = plump
        ? strokeWidth * 0.75
        : slim
        ? strokeWidth
        : strokeWidth * 0.6;
      const fontDesc = themeNode.get_font();
      // Adjust font size to fit inside icon
      const extraHorizontalSpace = w > (plump ? 1.5 : 1.3) * h;
      const extraVerticalSpace = !verticalBattery && plain;
      const fontSizeFraction =
        (!vText && extraHorizontalSpace) || (vText && extraVerticalSpace)
          ? 9 / 8
          : (verticalBattery && slim) || (bold && !vText)
          ? 5 / 8
          : null;
      if (fontSizeFraction !== null) {
        // Note: fontSizeFraction == 1 is not identity
        fontDesc.set_size(Math.round(fontSizeFraction * fontDesc.get_size()));
      }
      const content = charging
        ? 'bolt'
        : this.percentage < 100 && (this.percentage <= 5 || hText || vText)
        ? hText || vText
          ? String(this.percentage)
          : '!'
        : '';

      const style = {
        w,
        h,
        p: this.percentage / 100,
        verticalBodyWidth,
        horizontalBodyHeight,
        fColor: plain ? bColor : fColor,
        fillColor,
        content,
        vertical: verticalBattery,
        verticalText: vText,
        strokeWidth,
        bFrac,
        cornerRadius,
        bThickness,
        fontDesc,
        boltPath: plump ? this._plump_bolt_path : this._bolt_path,
      };

      if (bold) {
        this._bold(cr, style);
      } else if (slim) {
        this._slim(cr, style);
      } else if (plump) {
        this._plump(cr, style);
      } else if (plain) {
        this._plain(cr, style);
      } else if (circle) {
        this._circle(cr, style);
      }

      // Explicitly tell Cairo to free the context memory
      // https://gjs.guide/guides/gjs/memory-management.html#cairo
      cr.$dispose();
    }
  }
);

function plumpInnerContentPath(
  cr,
  {
    w,
    h,
    content,
    strokeWidth,
    vertical,
    verticalText,
    horizontalBodyHeight,
    bThickness,
    fontDesc,
    boltPath,
  }
) {
  const vertButtonAdjust = vertical ? -bThickness : 0;
  const horzButtonAdjust = vertical ? 0 : bThickness;

  const heightRatio = (vertical ? h - bThickness : horizontalBodyHeight) / h;
  const boltHeight = h * (1.1 * heightRatio);
  let outlineScale = 1;
  if (content === 'bolt') {
    outlineScale = chargingBoltPath(
      cr,
      w,
      h,
      boltPath,
      boltHeight,
      boltHeight,
      horzButtonAdjust,
      vertButtonAdjust,
      1,
      1
    );
  } else if (content) {
    innerTextPath(
      cr,
      w,
      h,
      content,
      fontDesc,
      horzButtonAdjust,
      vertButtonAdjust,
      verticalText,
      vertical /* flipped */
    );
  }
  return strokeWidth / (3 * outlineScale);
}

function innerContentPath(
  cr,
  { w, h, content, bThickness, vertical, verticalText, fontDesc, boltPath }
) {
  const boltHeight = h * (vertical ? 0.55 : 0.65);
  const horzButtonAdjust = vertical ? 0 : bThickness;
  if (content === 'bolt') {
    chargingBoltPath(
      cr,
      w,
      h,
      boltPath,
      boltHeight * 0.7333,
      boltHeight,
      horzButtonAdjust,
      0,
      0.9,
      vertical ? 0.9 : 1
    );
  } else if (content) {
    innerTextPath(
      cr,
      w,
      h,
      content,
      fontDesc,
      horzButtonAdjust,
      0,
      verticalText,
      vertical /* flipped */
    );
  }
}

function chargingBoltPath(
  cr,
  w,
  h,
  boltPath,
  boltWidth,
  boltHeight,
  horzButtonAdjust,
  vertButtonAdjust,
  horzBoltAdjust,
  vertBoltAdjust
) {
  cr.translate(
    (w - horzButtonAdjust - boltWidth * horzBoltAdjust) / 2.0,
    (h - vertButtonAdjust - boltHeight * vertBoltAdjust) / 2.0
  );
  cr.scale(boltWidth / 1000, boltHeight / 1000);
  boltPath.to_cairo_path(cr);
  return boltHeight / 1000;
}

function innerTextPath(
  cr,
  w,
  h,
  text,
  fontDesc,
  horzButtonAdjust,
  vertButtonAdjust,
  vertical,
  flipped
) {
  // Show inner percentage text
  const layout = PangoCairo.create_layout(cr);
  layout.set_text(text, -1);
  layout.set_font_description(fontDesc);
  layout.set_alignment(1);
  PangoCairo.update_layout(cr, layout);

  const textCenter = lo => {
    const [ir, lr] = lo.get_pixel_extents();
    return [-lr.x - lr.width / 2.0, -lr.y - ir.y - ir.height / 2.0];
  };
  // Move to center
  cr.translate((w - horzButtonAdjust) / 2.0, (h - vertButtonAdjust) / 2.0);
  // Rotate text
  if (vertical) {
    cr.rotate((flipped ? -1 : 1) * 0.5 * Math.PI);
  }
  const [tx, ty] = textCenter(layout);
  // Move to (x,y) = (0,0)
  cr.translate(tx, ty);

  PangoCairo.layout_path(cr, layout);
}
function bodyPath(
  cr,
  {
    w,
    h,
    verticalBodyWidth,
    horizontalBodyHeight,
    cornerRadius,
    bThickness,
    vertical,
  }
) {
  if (vertical) {
    roundedRectPath(
      cr,
      (w - verticalBodyWidth) / 2,
      bThickness,
      verticalBodyWidth,
      h - bThickness,
      cornerRadius
    );
  } else {
    roundedRectPath(
      cr,
      0,
      (h - horizontalBodyHeight) / 2,
      w - bThickness,
      horizontalBodyHeight,
      cornerRadius
    );
  }
}

function innerPercentageRectPath(
  cr,
  border,
  cornerRadius,
  { w, h, p, verticalBodyWidth, horizontalBodyHeight, bThickness, vertical },
  reversed = false
) {
  const innerFillRect = cornerRadius
    ? (...rect) => roundedRectPath(cr, ...rect, cornerRadius)
    : (...rect) => cr.rectangle(...rect);
  if (vertical) {
    const ih = h - bThickness - border * 2;
    const [x, y] = [(w - verticalBodyWidth) / 2, bThickness];
    innerFillRect(
      x + border,
      y + border + (reversed ? 0 : ih * (1 - p)),
      verticalBodyWidth - border * 2,
      ih * (reversed ? 1 - p : p)
    );
  } else {
    const iw = w - bThickness - border * 2;
    const y = (h - horizontalBodyHeight) / 2;
    innerFillRect(
      border + (reversed ? iw * p : 0),
      y + border,
      iw * (reversed ? 1 - p : p),
      horizontalBodyHeight - border * 2
    );
  }
}

/*
  BATTERY CHARGING BOLTS
*/

function plumpBoltPath(size = 1000, diagonalAngle = (Math.PI * 70) / 180) {
  const neg = ([x, y]) => [-x, -y];
  const add = ([x, y], [x2, y2]) => [x + x2, y + y2];

  const size2 = size / 2;
  const bodyRadius = 0.1 * size;
  const bezierRadius = bodyRadius * 0.9;
  const bezierRadius2 = bezierRadius * 0.618;
  // Top left corner (bx, by)
  const [bx, by] = circXY(bodyRadius, diagonalAngle);
  // Radius from center to 0
  const borderDist = size2 / (by / bodyRadius);
  const bxy2 = circXY(borderDist - bezierRadius * 2, diagonalAngle);
  const bxy3 = circXY(borderDist - bezierRadius2 * 2, diagonalAngle);

  const cornerAngle = 2 * diagonalAngle - Math.PI / 2;
  const [px, py] = circXY(2 * bodyRadius, 2 * diagonalAngle);
  const pxy = [px, py];
  const borderDist2 = Math.sin(diagonalAngle) * borderDist;
  // Reach cusp from (px,py)
  const topCusp = add(pxy, circXY(borderDist2 - bezierRadius * 2, cornerAngle));
  const topCusp2 = add(
    pxy,
    circXY(borderDist2 - bezierRadius2 * 2, cornerAngle)
  );
  // Reach valley from (px,py)
  const valleyDist = (py + by) / Math.sin(cornerAngle);
  const leftValley = add(pxy, circXY(-valleyDist + bezierRadius, cornerAngle));
  const leftValley2 = add(
    pxy,
    circXY(-valleyDist + bezierRadius2, cornerAngle)
  );
  const deepLeftCorner = add(pxy, circXY(-valleyDist, cornerAngle));
  const leftCorner = add([bezierRadius, 0], deepLeftCorner);
  const leftCorner2 = add([bezierRadius2, 0], deepLeftCorner);

  const p = new Clutter.Path();
  const center = ([x, y]) => [x + size / 2, -y + size / 2];

  const bxy = [bx, by];
  p.add_move_to(...center(bxy));
  p.add_line_to(...center(bxy2));
  p.add_curve_to(...center(bxy3), ...center(topCusp2), ...center(topCusp));
  p.add_line_to(...center(leftValley));
  p.add_curve_to(
    ...center(leftValley2),
    ...center(leftCorner2),
    ...center(leftCorner)
  );
  p.add_line_to(...center(neg(bxy)));
  p.add_line_to(...center(neg(bxy2)));
  p.add_curve_to(
    ...center(neg(bxy3)),
    ...center(neg(topCusp2)),
    ...center(neg(topCusp))
  );
  p.add_line_to(...center(neg(leftValley)));
  p.add_curve_to(
    ...center(neg(leftValley2)),
    ...center(neg(leftCorner2)),
    ...center(neg(leftCorner))
  );
  p.add_close();
  return p;
}

/*
  BATTERY BUTTONS
*/

function rectangleButtonPath(
  cr,
  { w, h, horizontalBodyHeight, verticalBodyWidth, bFrac, bThickness, vertical }
) {
  const [bWidthV, bHeightH] = [
    verticalBodyWidth * bFrac,
    horizontalBodyHeight * bFrac,
  ];
  if (vertical) {
    cr.rectangle((w - bWidthV) / 2, 0, bWidthV, bThickness);
  } else {
    cr.rectangle(w - bThickness, (h - bHeightH) / 2, bThickness, bHeightH);
  }
}

function lineButtonPath(
  cr,
  {
    w,
    h,
    horizontalBodyHeight,
    verticalBodyWidth,
    strokeWidth,
    bFrac,
    vertical,
  }
) {
  const [bWidthV, bHeightH] = [
    verticalBodyWidth * bFrac,
    horizontalBodyHeight * bFrac,
  ];
  const slimThickness = strokeWidth / 2;
  cr.setLineWidth(slimThickness);
  cr.setLineCap(CAIRO_LINE_CAP_ROUND);
  if (vertical) {
    cr.moveTo((w - bWidthV + slimThickness) / 2, slimThickness / 2);
    cr.lineTo((w + bWidthV - slimThickness) / 2, slimThickness / 2);
  } else {
    cr.moveTo(w - slimThickness / 2, (h - bHeightH + slimThickness) / 2);
    cr.lineTo(w - slimThickness / 2, (h + bHeightH - slimThickness) / 2);
  }
}

function arcButtonPath(cr, { w, h, strokeWidth, bThickness, vertical }) {
  // Draw battery button arc
  if (vertical) {
    const capRadius = bThickness - strokeWidth / 4;
    cr.arc(w / 2, capRadius, capRadius, Math.PI, 2 * Math.PI);
  } else {
    const capRadius = bThickness - strokeWidth / 4;
    cr.arc(w - capRadius, h / 2, capRadius, -Math.PI / 2, Math.PI / 2);
  }
}
