// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
//
// SPDX-License-Identifier: GPL-3.0-or-later

const { GObject, St, Clutter, PangoCairo } = imports.gi;
const Cairo = imports.cairo;
const Panel = imports.ui.panel;

var BInner = {
  EMPTY: 0,
  CHARGING: 1,
  TEXT: 2,
  VTEXT: 3,
};

var BStatusStyle = {
  PORTRAIT: 0,
  PLAINPORTRAIT: 2,
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
        BStatusStyle.PORTRAIT
      ),
    },
  },
  class BatteryDrawIcon extends St.DrawingArea {
    _init(locationClass) {
      super._init({
        y_align: Clutter.ActorAlign.CENTER,
        style_class: locationClass,
      });
      this._theme = St.ThemeContext.get_for_stage(global.stage);
      this._theme.connectObject(
        'notify::scale-factor',
        this._sync.bind(this),
        this
      );

      // https://github.com/LineageOS/android_frameworks_base/blob/-/packages/SettingsLib/src/com/android/settingslib/graph/BatteryMeterDrawableBase.java#L158
      this._bolt_path = Clutter.Path.new_with_description(
        'M 165 0 L 887 0 L 455 368 L 1000 368 L 9 1000 L 355 475 L 0 475 z'
      );
      this.connect('notify::inner', this._sync.bind(this));
      this.connect('notify::percentage', this._sync.bind(this));
      this.connect('notify::status-style', this._sync.bind(this));
      this._sync();
    }

    vfunc_repaint() {
      const p = this.percentage / 100;
      const cr = this.get_context();
      const themeNode = this.get_theme_node();

      const [w, h] = this.get_surface_size();
      const circleSize = Math.min(h, w);
      const strokeWidth = circleSize / 6.5;
      const one = h / 16;

      const fColor = themeNode.get_foreground_color();
      const fillColor =
        this.percentage > 15 ? fColor : themeNode.get_icon_colors().warning;
      cr.save();
      let bgSource = null;
      // Use background color
      Clutter.cairo_set_source_color(cr, fColor.darken().darken());
      if (
        this.statusStyle === BStatusStyle.PORTRAIT ||
        this.statusStyle === BStatusStyle.PLAINPORTRAIT
      ) {
        const bw = w * 0.58;
        // Battery button: rectangle
        const [bWidth, bHeight] = [bw * 0.44, h * 0.1];
        const bh = h - bHeight;
        cr.pushGroup();
        cr.rectangle((w - bWidth) / 2, 0, bWidth, bHeight);

        // Battery body: rounded rectangle (x,y,bw,bh)
        const r = 1.5 * one;
        const cAngle = 0.5 * Math.PI;
        const [x, y] = [(w - bw) / 2, bHeight];
        cr.newSubPath();
        cr.arc(x + bw - r, y + r, r, -cAngle, 0);
        cr.arc(x + bw - r, y + bh - r, r, 0, cAngle);
        cr.arc(x + r, y + bh - r, r, cAngle, 2 * cAngle);
        cr.arc(x + r, y + r, r, 2 * cAngle, 3 * cAngle);
        cr.closePath();
        cr.fillPreserve();
        bgSource = cr.popGroup();

        if (this.statusStyle === BStatusStyle.PORTRAIT) {
          cr.clipPreserve();
          // Outline battery
          Clutter.cairo_set_source_color(cr, fColor);
          cr.setLineWidth(strokeWidth);
          cr.stroke();

          // Fill battery button
          const eps = one / 4;
          cr.rectangle((w - bWidth) / 2, 0, bWidth, bHeight + eps);
          cr.fill();

          // Fill inner battery
          Clutter.cairo_set_source_color(cr, fillColor);
          const border = strokeWidth / 2 - eps;
          const ih = bh - border * 2;
          cr.rectangle(
            x + border,
            y + border + ih * (1 - p),
            bw - border * 2,
            ih * p
          );
          cr.fill();
        } else {
          // Fill battery (plain portrait)
          Clutter.cairo_set_source_color(cr, fillColor);
          cr.clip();
          cr.rectangle(0, h * (1 - p), w, h * p);
          cr.fill();
        }
      } else if (this.statusStyle === BStatusStyle.CIRCLE) {
        const radius = (circleSize - strokeWidth) / 2;
        const [cw, ch] = [w / 2, h / 2];
        // Circle Background
        cr.setLineWidth(strokeWidth);
        cr.pushGroup();
        cr.arc(cw, ch, radius, 0, 2 * Math.PI);
        cr.stroke();
        bgSource = cr.popGroup();
        // Circle fill foreground
        Clutter.cairo_set_source_color(cr, fillColor);
        const angleOffset = -0.5 * Math.PI;
        cr.arc(cw, ch, radius, angleOffset, angleOffset + p * 2 * Math.PI);
        cr.stroke();
      }
      cr.restore();

      cr.setOperator(Cairo.Operator.DIFFERENCE);
      Clutter.cairo_set_source_color(cr, fColor);

      if (this.inner === BInner.CHARGING) {
        // Show charging bolt
        const boltHeight = (h - strokeWidth) * 0.65;
        const boltAspect = 0.7333;
        const boltWidth = boltHeight * boltAspect;
        cr.translate((one + w - boltWidth) / 2.0, (one + h - boltHeight) / 2.0);
        cr.scale(boltWidth / 1000, boltHeight / 1000);
        this._bolt_path.to_cairo_path(cr);
        cr.fill();
      } else if (
        this.percentage < 100 &&
        (this.inner === BInner.TEXT || this.inner === BInner.VTEXT)
      ) {
        // Show inner percentage text

        if (this.statusStyle === BStatusStyle.PLAINPORTRAIT) {
          cr.setOperator(Cairo.Operator.OVER);
          Clutter.cairo_set_source_color(
            cr,
            themeNode.get_color('-portrait-font-color')
          );
        }
        const layout = PangoCairo.create_layout(cr);
        layout.set_text(String(this.percentage), -1);
        const desc = themeNode.get_font();
        if (
          this.statusStyle === BStatusStyle.PORTRAIT &&
          this.inner !== BInner.VTEXT
        ) {
          // Reduce font size to fit into portrait border
          desc.set_size(Math.round((5 / 8) * desc.get_size()));
        }
        layout.set_font_description(desc);
        layout.set_alignment(1);
        PangoCairo.update_layout(cr, layout);

        const [ir, lr] = layout.get_pixel_extents();
        // Move to center
        cr.translate(w / 2.0, h / 2.0);
        // Rotate text
        if (this.inner === BInner.VTEXT) {
          cr.rotate(-0.5 * Math.PI);
        }
        // Move to (x,y) = (0,0)
        cr.translate(-lr.x - lr.width / 2.0, -lr.y - ir.y - ir.height / 2.0);

        PangoCairo.show_layout(cr, layout);
      }
      if (bgSource !== null && this.statusStyle !== BStatusStyle.PORTRAIT) {
        cr.restore();
        cr.setSource(bgSource);
        cr.setOperator(Cairo.Operator.DEST_OVER);
        cr.paint();
      }

      // Explicitly tell Cairo to free the context memory
      // https://gjs.guide/guides/gjs/memory-management.html#cairo
      cr.$dispose();
    }

    _sync() {
      const s = this._theme.scaleFactor;
      this.set_width(s * Panel.PANEL_ICON_SIZE);
      this.set_height(s * Panel.PANEL_ICON_SIZE);
      this.queue_repaint();
    }
  }
);
