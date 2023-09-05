// SPDX-FileCopyrightText: 2023 Deminder <tremminder@gmail.com>
// SPDX-License-Identifier: GPL-3.0-or-later

import GObject from 'gi://GObject';
import UPowerGlib from 'gi://UPowerGlib';

export const PowerManagerProxyMock = GObject.registerClass(
  {
    Signals: {
      'g-properties-changed': {},
    },
  },
  class PowerManagerProxyMock extends GObject.Object {
    _init(params = {}) {
      super._init(params);
      this._debugCounter = 0;
      // Start debug interval
      this._debugCounter = 0;
      this.State = UPowerGlib.DeviceState.UNKNOWN;
      this.Percentage = 0;
      this.IsPresent = true;
      this.IconName = 'battery-level-100-charged-symbolic';
      this._debugIntervalId = setInterval(() => {
        this._debugCounter += 1;
        this.State =
          this._debugCounter % 7 <= 1
            ? UPowerGlib.DeviceState.CHARGING
            : UPowerGlib.DeviceState.DISCHARGING;
        this.Percentage = this._debugCounter % 101;
        this.emit('g-properties-changed');
      }, 200);
    }

    destroy() {
      if (this._debugIntervalId) {
        // Stop debug interval
        clearInterval(this._debugIntervalId);
        this._debugIntervalId = null;
      }
    }
  }
);
