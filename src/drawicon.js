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

var BStatusStyle = {
  BOLD: 0,
  SLIM: 1,
  PLAIN: 2,
  CIRCLE: 3,
  HIDE: 4,
};

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
    _init(locationClass) {
      super._init({
        y_align: Clutter.ActorAlign.CENTER,
        style_class: locationClass,
      });

      // https://github.com/LineageOS/android_frameworks_base/blob/-/packages/SettingsLib/src/com/android/settingslib/graph/BatteryMeterDrawableBase.java#L158
      this._bolt_path = Clutter.Path.new_with_description(
        'M 165 0 L 887 0 L 455 368 L 1000 368 L 9 1000 L 355 475 L 0 475 z'
      );
      for (const signal of [
        'notify::inner',
        'style-changed',
        'notify::percentage',
        'notify::status-style',
        'notify::vertical',
      ]) {
        this.connect(signal, () => this.queue_repaint());
      }
      this.queue_repaint();
    }

    vfunc_repaint() {
      const p = this.percentage / 100;
      const cr = this.get_context();
      const themeNode = this.get_theme_node();

      const [w, h] = this.get_surface_size();
      const verticalBattery =
        this.statusStyle === BStatusStyle.CIRCLE || this.vertical;
      const size = verticalBattery ? h : w;
      const strokeWidth = size / 6.5;
      const one = h / 16;

      const slim = this.statusStyle === BStatusStyle.SLIM;
      const fColor = themeNode.get_foreground_color();
      const bColor = fColor.darken().darken();
      const fillColor =
        this.percentage > 15
          ? slim
            ? bColor
            : fColor
          : themeNode.get_icon_colors().warning;
      cr.save();
      const verticalBodyWidth = w * 0.58;
      const horizontalBodyHeight = h;
      const cornerRadius = slim ? strokeWidth : 1.5 * one;
      const slimThinkness = strokeWidth / 4;
      const buttonLengthFrac = slim ? 0.3 : 0.44;
      // Battery button width and height (vertical: V/horizontal: H)
      const [bWidthV, bHeightV] = [
        verticalBodyWidth * buttonLengthFrac,
        slim ? slimThinkness * 2 : h * 0.1,
      ];
      const [bWidthH, bHeightH] = [
        slim ? slimThinkness * 2 : w * 0.1,
        horizontalBodyHeight * buttonLengthFrac,
      ];
      let bgSource = null;
      // Use background color
      Clutter.cairo_set_source_color(cr, bColor);
      if (
        this.statusStyle === BStatusStyle.BOLD ||
        slim ||
        this.statusStyle === BStatusStyle.PLAIN
      ) {
        const roundedRect = (x, y, bW, bH, r) => {
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
        };
        cr.pushGroup();
        // Battery button: rectangle
        // Battery body: rounded rectangle
        if (verticalBattery) {
          cr.rectangle((w - bWidthV) / 2, 0, bWidthV, bHeightV);
          roundedRect(
            (w - verticalBodyWidth) / 2,
            bHeightV,
            verticalBodyWidth,
            h - bHeightV,
            cornerRadius
          );
        } else {
          cr.rectangle(w - bWidthH, (h - bHeightH) / 2, bWidthH, bHeightH);
          roundedRect(
            0,
            (h - horizontalBodyHeight) / 2,
            w - bWidthH,
            horizontalBodyHeight,
            cornerRadius
          );
        }
        cr.fillPreserve();
        bgSource = cr.popGroup();

        if (this.statusStyle === BStatusStyle.BOLD || slim) {
          cr.clipPreserve();
          // Outline battery
          Clutter.cairo_set_source_color(cr, fColor);
          cr.setLineWidth(slim ? slimThinkness * 2 : strokeWidth);
          cr.stroke();

          const eps = one / 4;
          if (slim) {
            // Clear button stroke
            cr.setOperator(Cairo.Operator.CLEAR);
            if (verticalBattery) {
              cr.rectangle(0, 0, w, bHeightV);
            } else {
              cr.rectangle(w - bWidthH, 0, bWidthH, h);
            }
            cr.fill();

            // Draw battery button line
            cr.setOperator(Cairo.Operator.OVER);
            // Round line cap
            cr.setLineWidth(slimThinkness);
            cr.setLineCap(1);
            if (verticalBattery) {
              cr.moveTo((w - bWidthV + slimThinkness) / 2, slimThinkness / 2);
              cr.lineTo((w + bWidthV - slimThinkness) / 2, slimThinkness / 2);
            } else {
              cr.moveTo(
                w - slimThinkness / 2,
                (h - bHeightH + slimThinkness) / 2
              );
              cr.lineTo(
                w - slimThinkness / 2,
                (h + bHeightH - slimThinkness) / 2
              );
            }
            cr.stroke();
          } else {
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
          }

          // Fill inner battery
          Clutter.cairo_set_source_color(cr, fillColor);
          const border = slim ? slimThinkness * 2.5 : strokeWidth / 2 - eps;
          const innerFillRect = slim
            ? (...rect) => roundedRect(...rect, border/2)
            : (...rect) => cr.rectangle(...rect);
          if (verticalBattery) {
            const ih = h - bHeightV - border * 2;
            const [x, y] = [(w - verticalBodyWidth) / 2, bHeightV];
            innerFillRect(
              x + border,
              y + border + ih * (1 - p),
              verticalBodyWidth - border * 2,
              ih * p
            );
          } else {
            const iw = w - bWidthH - border * 2;
            innerFillRect(
              border,
              border,
              iw * p,
              horizontalBodyHeight - border * 2
            );
          }
          cr.fill();
        } else {
          // Fill battery (plain portrait)
          Clutter.cairo_set_source_color(cr, fillColor);
          cr.clip();
          if (verticalBattery) {
            cr.rectangle(0, h * (1 - p), w, h * p);
          } else {
            cr.rectangle(0, 0, w * p, h);
          }
          cr.fill();
        }
      } else if (this.statusStyle === BStatusStyle.CIRCLE) {
        const radius = (size - strokeWidth) / 2;
        const [cw, ch] = [w / 2, h / 2];
        // Circle Background
        cr.setLineWidth(strokeWidth);
        cr.pushGroup();
        cr.translate(cw, ch);
        cr.scale(w / size, h / size);
        cr.arc(0, 0, radius, 0, 2 * Math.PI);
        cr.stroke();
        bgSource = cr.popGroup();

        cr.translate(cw, ch);
        cr.scale(w / size, h / size);
        // Circle fill foreground
        Clutter.cairo_set_source_color(cr, fillColor);
        const angleOffset = -0.5 * Math.PI;
        cr.arc(0, 0, radius, angleOffset, angleOffset + p * 2 * Math.PI);
        cr.stroke();
      }
      cr.restore();

      cr.setOperator(slim ? Cairo.Operator.OVER : Cairo.Operator.DIFFERENCE);
      Clutter.cairo_set_source_color(cr, fColor);

      if (this.inner === BInner.CHARGING) {
        // Show charging bolt
        const boltHeight = h * (verticalBattery ? 0.55 : 0.65);
        const boltAspect = 0.7333;
        const boltWidth = boltHeight * boltAspect;
        cr.translate(
          (w - (verticalBattery ? 0 : bWidthH) - boltWidth * 0.9) / 2.0,
          (h - boltHeight * (verticalBattery ? 0.9 : 1)) / 2.0
        );
        cr.scale(boltWidth / 1000, boltHeight / 1000);
        this._bolt_path.to_cairo_path(cr);
        cr.fill();
      } else if (
        this.percentage < 100 &&
        (this.inner === BInner.TEXT || this.inner === BInner.VTEXT)
      ) {
        // Show inner percentage text
        if (this.statusStyle === BStatusStyle.PLAIN) {
          cr.setOperator(Cairo.Operator.OVER);
          Clutter.cairo_set_source_color(
            cr,
            themeNode.get_color('-portrait-font-color')
          );
        }
        const layout = PangoCairo.create_layout(cr);
        layout.set_text(String(this.percentage), -1);
        const desc = themeNode.get_font();
        // Adjust font size to fit inside icon
        const horizontalText = this.inner !== BInner.VTEXT;
        const extraHorizontalSpace = w > 1.5 * h;
        const extraVerticalSpace =
          !verticalBattery &&
          ![BStatusStyle.BOLD, BStatusStyle.CIRCLE].includes(this.statusStyle);
        const fontSizeFraction =
          (horizontalText && extraHorizontalSpace) ||
          (!horizontalText && extraVerticalSpace)
            ? 9 / 8
            : verticalBattery &&
              this.statusStyle === BStatusStyle.BOLD &&
              horizontalText
            ? 5 / 8
            : null;
        if (fontSizeFraction !== null) {
          // Note: fontSizeFraction == 1 is not identity
          desc.set_size(Math.round(fontSizeFraction * desc.get_size()));
        }
        layout.set_font_description(desc);
        layout.set_alignment(1);
        PangoCairo.update_layout(cr, layout);

        const [ir, lr] = layout.get_pixel_extents();
        // Move to center
        cr.translate((w - (verticalBattery ? 0 : bWidthH)) / 2.0, h / 2.0);
        // Rotate text
        if (this.inner === BInner.VTEXT) {
          cr.rotate(-0.5 * Math.PI);
        }
        // Move to (x,y) = (0,0)
        cr.translate(-lr.x - lr.width / 2.0, -lr.y - ir.y - ir.height / 2.0);

        PangoCairo.show_layout(cr, layout);
      }
      if (
        bgSource !== null &&
        this.statusStyle !== BStatusStyle.BOLD &&
        !slim
      ) {
        cr.restore();
        cr.setSource(bgSource);
        cr.setOperator(Cairo.Operator.DEST_OVER);
        cr.paint();
      }

      // Explicitly tell Cairo to free the context memory
      // https://gjs.guide/guides/gjs/memory-management.html#cairo
      cr.$dispose();
    }
  }
);
