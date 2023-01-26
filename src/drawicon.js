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
};

var BStatusStyle = {
  PORTRAIT: 0,
  CIRCLE: 1,
  HIDE: 2,
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
      if (this.statusStyle === BStatusStyle.PORTRAIT) {
        const bw = w * 0.58;
        // Battery button: rectangle
        const [bWidth, bHeight] = [bw * 0.44, h * 0.12];
        const bh = h - bHeight;
        cr.pushGroup();
        cr.rectangle((w - bWidth) / 2, 0, bWidth, bHeight + one);

        // Battery body: rounded rectangle (x,y,bw,bh)
        const r = h / 16;
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
        cr.clip();

        // Fill battery
        Clutter.cairo_set_source_color(cr, fillColor);
        cr.rectangle(0, h * (1 - p), w, h * p);
        cr.fill();
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

      if (this.inner === BInner.CHARGING) {
        // Show charging bolt
        cr.setOperator(Cairo.Operator.DIFFERENCE);
        Clutter.cairo_set_source_color(cr, fColor);
        const boltHeight = (h - strokeWidth - one) * 0.75;
        const boltAspect = 0.7333;
        const boltWidth = boltHeight * boltAspect;
        cr.translate((one + w - boltWidth) / 2.0, (one + h - boltHeight) / 2.0);
        cr.scale(boltWidth / 1000, boltHeight / 1000);
        this._bolt_path.to_cairo_path(cr);
        cr.fill();
      } else if (this.percentage < 100 && this.inner === BInner.TEXT) {
        // Show inner percentage text
        cr.setOperator(Cairo.Operator.OVER);
        Clutter.cairo_set_source_color(
          cr,
          this.statusStyle === BStatusStyle.PORTRAIT
            ? themeNode.get_color('-portrai-font-color')
            : fColor
        );
        const layout = PangoCairo.create_layout(cr);
        layout.set_text(String(this.percentage), -1);
        layout.set_font_description(themeNode.get_font());
        layout.set_alignment(1);
        PangoCairo.update_layout(cr, layout);

        const [ir, lr] = layout.get_pixel_extents();
        const ascend = ir.y + ir.height - (lr.y + lr.height);
        // Move line y down
        cr.translate(
          -lr.x + (w - lr.width) / 2.0,
          -lr.y + (h - lr.height - ascend) / 2.0
        );

        PangoCairo.show_layout(cr, layout);
      }
      if (bgSource !== null) {
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
      this.set_width(this._theme.scaleFactor * Panel.PANEL_ICON_SIZE);
      this.set_height(this._theme.scaleFactor * Panel.PANEL_ICON_SIZE);
      this.queue_repaint();
    }
  }
);
