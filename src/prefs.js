// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

const { Adw, Gio, Gtk } = imports.gi;

const ExtensionUtils = imports.misc.extensionUtils;
const Me = ExtensionUtils.getCurrentExtension();
const Gettext = imports.gettext.domain('battery-indicator-icon');
const _ = Gettext.gettext;

function init() {
  ExtensionUtils.initTranslations();
}

function createComboRow(title, options, selection, onSelected) {
  const keys = Object.keys(options);
  const aid = keys.indexOf(selection);
  const model = new Gtk.StringList();
  for (const k of keys) {
    model.append(options[k]);
  }
  const row = new Adw.ComboRow({
    title,
    model,
    selected: aid !== -1 ? aid : keys.length,
  });
  row.connect('notify::selected', () => onSelected(keys[row.selected]));
  return row;
}

function fillPreferencesWindow(window) {
  const settings = ExtensionUtils.getSettings();
  const dsettings = new Gio.Settings({
    schema_id: 'org.gnome.desktop.interface',
  });

  const page = new Adw.PreferencesPage();
  const group = new Adw.PreferencesGroup();
  page.add(group);
  const textRow = createComboRow(
    _('Show battery percentage text in icon'),
    {
      hidden: _('Hidden'),
      inside: _('Inside the icon'),
      nextTo: _('Next to the icon'),
    },
    dsettings.get_boolean('show-battery-percentage')
      ? 'nextTo'
      : settings.get_boolean('show-icon-text')
      ? 'inside'
      : 'hidden',
    opt => {
      log('text', opt);
      dsettings.set_boolean('show-battery-percentage', opt === 'nextTo');
      settings.set_boolean('show-icon-text', opt === 'inside');
    }
  );

  const s = settings.get_string('status-style');
  const styleRow = createComboRow(
    _('Battery status icon style'),
    {
      portrait: _('Icon portrait'),
      circle: _('Circle'),
      text: _('Text'),
    },
    ['portrait', 'circle'].includes(s) ? s : 'text',
    opt => {
      log('style', opt);
      if (['portrait', 'circle'].includes(opt)) {
        settings.set_string('status-style', opt);
      } else {
        // only show text
        settings.set_string('status-style', 'hidden');
        dsettings.set_boolean('show-battery-percentage', true);
      }
    }
  );
  const update = () => {
    textRow.sensitive = settings.get_string('status-style') !== 'hidden';
    dsettings.set_boolean(
      'show-battery-percentage',
      textRow.selectedItem.value === 'nextTo'
    );
  };
  settings.connect('changed::status-style', update);
  update();
  group.add(styleRow);
  group.add(textRow);

  window.default_width = 500;
  window.default_height = 220;
  window.add(page);
}
