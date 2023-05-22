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

const CAIRO_LINE_CAP_BUTT = 0;
const CAIRO_LINE_CAP_ROUND = 1;
const CAIRO_LINE_CAP_SQUARE = 2;

function roundLineCap(cr) {
  cr.setLineCap(CAIRO_LINE_CAP_ROUND);
}
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
      const p = this.percentage / 100;
      const cr = this.get_context();

      const [w, h] = this.get_surface_size();
      const buttonRatio = plump ? 0.7 : 0.58;
      const verticalBodyWidth = w * buttonRatio;
      const horizontalBodyHeight = plump
        ? Math.min(h, (verticalBodyWidth * 6) / 7)
        : h;
      const verticalBattery = circle || this.vertical;
      const one = h / 16;
      const strokeWidth =
        (plump
          ? Math.min(1, verticalBodyWidth / h) * 5.333
          : slim
          ? 2
          : verticalBattery
          ? 2.46
          : 4) * one;
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
      const [bWidthV, bHeightV] = [verticalBodyWidth * bFrac, bThickness];
      const [bWidthH, bHeightH] = [bThickness, horizontalBodyHeight * bFrac];
      let bgSource = null;
      let boldEmptyMask = null;

      cr.save();
      // Use background color
      Clutter.cairo_set_source_color(cr, bColor);
      if (bold || slim || plump || plain) {
        cr.pushGroup();
        // Battery button: rectangle
        // Battery body: rounded rectangle
        if (verticalBattery) {
          if (plain) {
            cr.rectangle((w - bWidthV) / 2, 0, bWidthV, bHeightV);
          }
          roundedRectPath(
            cr,
            (w - verticalBodyWidth) / 2,
            bHeightV,
            verticalBodyWidth,
            h - bHeightV,
            cornerRadius
          );
        } else {
          if (plain) {
            cr.rectangle(w - bWidthH, (h - bHeightH) / 2, bWidthH, bHeightH);
          }
          roundedRectPath(
            cr,
            0,
            (h - horizontalBodyHeight) / 2,
            w - bWidthH,
            horizontalBodyHeight,
            cornerRadius
          );
        }
        cr.fillPreserve();
        bgSource = cr.popGroup();

        if (bold || slim || plump) {
          cr.clipPreserve();
          // Outline battery
          Clutter.cairo_set_source_color(cr, fColor);
          cr.setLineWidth(strokeWidth);
          cr.stroke();

          cr.restore();
          // Draw battery button
          Clutter.cairo_set_source_color(cr, fColor);
          const eps = one / 4;
          if (bold) {
            cr.setOperator(Cairo.Operator.SOURCE);
            // Fill battery button
            if (verticalBattery) {
              cr.rectangle((w - bWidthV) / 2, 0, bWidthV, bHeightV + eps);
            } else {
              cr.rectangle(
                w - bWidthH - eps,
                (h - bHeightH) / 2,
                bWidthH + eps,
                bHeightH
              );
            }
            cr.fill();
          } else if (slim) {
            // Draw battery button line
            // Round line cap
            const slimThickness = strokeWidth / 2;
            cr.setLineWidth(slimThickness);
            roundLineCap(cr);
            if (verticalBattery) {
              cr.moveTo((w - bWidthV + slimThickness) / 2, slimThickness / 2);
              cr.lineTo((w + bWidthV - slimThickness) / 2, slimThickness / 2);
            } else {
              cr.moveTo(
                w - slimThickness / 2,
                (h - bHeightH + slimThickness) / 2
              );
              cr.lineTo(
                w - slimThickness / 2,
                (h + bHeightH - slimThickness) / 2
              );
            }
            cr.stroke();
          } else if (plump) {
            // Draw battery button arc
            if (verticalBattery) {
              const capRadius = bHeightV - strokeWidth / 4;
              cr.arc(w / 2, capRadius, capRadius, Math.PI, 2 * Math.PI);
            } else {
              const capRadius = bWidthH - strokeWidth / 4;
              cr.arc(
                w - capRadius,
                h / 2,
                capRadius,
                -Math.PI / 2,
                Math.PI / 2
              );
            }
            cr.fill();
          }

          // Fill inner battery
          Clutter.cairo_set_source_color(cr, fillColor);
          const border = slim
            ? strokeWidth * 1.25
            : plump
            ? strokeWidth * 0.75
            : strokeWidth / 2 - eps;
          const innerFillRect =
            slim || plump
              ? (...rect) =>
                  roundedRectPath(cr, ...rect, plump ? border / 4 : border / 2)
              : (...rect) => cr.rectangle(...rect);
          const drawRect = verticalBattery
            ? reversed => {
                const ih = h - bHeightV - border * 2;
                const [x, y] = [(w - verticalBodyWidth) / 2, bHeightV];
                innerFillRect(
                  x + border,
                  y + border + (reversed ? 0 : ih * (1 - p)),
                  verticalBodyWidth - border * 2,
                  ih * (reversed ? 1 - p : p)
                );
              }
            : reversed => {
                const iw = w - bWidthH - border * 2;
                const y = (h - horizontalBodyHeight) / 2;
                innerFillRect(
                  border + (reversed ? iw * p : 0),
                  y + border,
                  iw * (reversed ? 1 - p : p),
                  horizontalBodyHeight - border * 2
                );
              };

          drawRect();
          cr.fill();

          cr.setOperator(Cairo.Operator.OVER);
          Clutter.cairo_set_source_color(cr, Clutter.Color.get_static('white'));
          if (bold) {
            cr.pushGroup();
            drawRect(true);
            cr.fill();
            boldEmptyMask = cr.popGroup();
          }
        } else {
          // Fill battery (plain)
          Clutter.cairo_set_source_color(cr, fillColor);
          cr.clip();
          if (verticalBattery) {
            cr.rectangle(0, h * (1 - p), w, h * p);
          } else {
            cr.rectangle(0, 0, w * p, h);
          }
          cr.fill();
        }
      } else if (circle) {
        const size = h;
        const radius = (size - strokeWidth) / 2;
        const [cw, ch] = [w / 2, h / 2];
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
      }
      cr.restore();
      cr.pushGroup();
      Clutter.cairo_set_source_color(cr, fColor);
      const vertButtonAdjust = verticalBattery && plump ? -bHeightV : 0;
      const horzButtonAdjust = verticalBattery ? 0 : bWidthH;

      if (charging) {
        // Show charging bolt
        const boltHeight =
          h *
          (plump
            ? (1.1 * horizontalBodyHeight) / h
            : verticalBattery
            ? 0.55
            : 0.65);
        const boltAspect = plump ? 1 : 0.7333;
        const boltWidth = boltHeight * boltAspect;
        const vertBoltAdjust = !plump && verticalBattery ? 0.9 : 1;
        const horzBoltAdjust = plump ? 1 : 0.9;
        cr.translate(
          (w - horzButtonAdjust - boltWidth * horzBoltAdjust) / 2.0,
          (h - vertButtonAdjust - boltHeight * vertBoltAdjust) / 2.0
        );
        cr.scale(boltWidth / 1000, boltHeight / 1000);
        if (plump) {
          this._plump_bolt_path.to_cairo_path(cr);
        } else {
          this._bolt_path.to_cairo_path(cr);
        }
        cr.fill();
      } else if (
        this.percentage < 100 &&
        (this.percentage <= 5 || hText || vText)
      ) {
        // Show inner percentage text
        const layout = PangoCairo.create_layout(cr);
        layout.set_text(hText || vText ? String(this.percentage) : '!', -1);
        const desc = themeNode.get_font();
        // Adjust font size to fit inside icon
        const extraHorizontalSpace = w > 1.5 * h;
        const extraVerticalSpace = !verticalBattery && plain;
        const fontSizeFraction =
          (!vText && extraHorizontalSpace) || (vText && extraVerticalSpace)
            ? 9 / 8
            : (verticalBattery && slim) || (bold && !vText)
            ? 5 / 8
            : null;
        if (fontSizeFraction !== null) {
          // Note: fontSizeFraction == 1 is not identity
          desc.set_size(Math.round(fontSizeFraction * desc.get_size()));
        }
        layout.set_font_description(desc);
        layout.set_alignment(1);
        PangoCairo.update_layout(cr, layout);

        const textCenter = lo => {
          const [ir, lr] = lo.get_pixel_extents();
          return [-lr.x - lr.width / 2.0, -lr.y - ir.y - ir.height / 2.0];
        };
        // Move to center
        cr.translate(
          (w - horzButtonAdjust) / 2.0,
          (h - vertButtonAdjust) / 2.0
        );
        // Rotate text
        if (this.inner === BInner.VTEXT) {
          cr.rotate((verticalBattery ? -1 : 1) * 0.5 * Math.PI);
        }
        const [tx, ty] = textCenter(layout);
        // Move to (x,y) = (0,0)
        cr.translate(tx, ty);

        PangoCairo.show_layout(cr, layout);
      }
      const innerSource = cr.popGroup();
      if (plain) {
        cr.setSource(bgSource);
        cr.setOperator(Cairo.Operator.DEST_OVER);
        cr.paint();
      }
      if (plump) {
        // Outline: Dilate bolt by rotating translations
        const outline = strokeWidth / 8;
        cr.setOperator(Cairo.Operator.DEST_OUT);
        const angles = 15;
        for (let a = 0; a < angles; a++) {
          const [x, y] = circXY(outline, (2 * Math.PI * a) / angles);
          cr.translate(x, y);
          cr.setSource(innerSource);
          cr.paint();
          cr.translate(-x, -y);
        }
      }
      cr.setSource(innerSource);
      cr.setOperator(
        bold || plain ? Cairo.Operator.DEST_OUT : Cairo.Operator.OVER
      );
      cr.paint();

      if (boldEmptyMask !== null) {
        cr.setOperator(Cairo.Operator.OVER);
        cr.setSource(innerSource);
        cr.mask(boldEmptyMask);
      }
      // Explicitly tell Cairo to free the context memory
      // https://gjs.guide/guides/gjs/memory-management.html#cairo
      cr.$dispose();
    }
  }
);

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
