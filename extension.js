// extension.js

import GObject from 'gi://GObject';
import St from 'gi://St';

import {Extension, gettext as _} from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';
import GLib from 'gi://GLib';

const SUNSHINE_COMMAND = 'sunshine';
const SUNSHINE_PROCESS_NAME = 'sunshine';

const STATUS = {
    OFF: 'off',
    STARTED: 'started',
    CONNECTED: 'connected'
};

const ICONS = {
    [STATUS.OFF]: 'media-playback-stop-symbolic',
    [STATUS.STARTED]: 'media-playback-start-symbolic',
    [STATUS.CONNECTED]: 'network-transmit-receive-symbolic'
};

const Indicator = GObject.registerClass(
class Indicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Sunshine Status'));

        this._icon = new St.Icon({
            icon_name: ICONS[STATUS.OFF],
            style_class: 'system-status-icon',
        });

        this.add_child(this._icon);
        this._status = STATUS.OFF;

        this._startItem = new PopupMenu.PopupMenuItem(_('Start Sunshine'));
        this._stopItem = new PopupMenu.PopupMenuItem(_('Stop Sunshine'));

        this._startItem.connect('activate', () => this._startSunshine());
        this._stopItem.connect('activate', () => this._stopSunshine());

        this.menu.addMenuItem(this._startItem);
        this.menu.addMenuItem(this._stopItem);

        this._refreshStatus();
        this._updateMenu();

        this._statusCheckLoop();
    }

    _refreshStatus() {
        const [ok, out] = GLib.spawn_command_line_sync(`pgrep -x ${SUNSHINE_PROCESS_NAME}`);
        if (ok && out.length > 0) {
            this._status = this._isClientConnected() ? STATUS.CONNECTED : STATUS.STARTED;
        } else {
            this._status = STATUS.OFF;
        }
        this._updateIcon();
        this._updateMenu();
    }

    _updateIcon() {
        this._icon.icon_name = ICONS[this._status];
        this._icon.style_class = `system-status-icon ${this._status}`;
    }

    _updateMenu() {
        this._startItem.visible = this._status === STATUS.OFF;
        this._stopItem.visible = this._status !== STATUS.OFF;
    }

    _startSunshine() {
        GLib.spawn_command_line_async(SUNSHINE_COMMAND);
        console.info('Sunshine started');
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._refreshStatus();
            return GLib.SOURCE_REMOVE;
        });
    }

    _stopSunshine() {
        GLib.spawn_command_line_async(`pkill -x ${SUNSHINE_PROCESS_NAME}`);
        console.info('Sunshine stopped');
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 2, () => {
            this._refreshStatus();
            return GLib.SOURCE_REMOVE;
        });
    }

    _isClientConnected() {
        // Placeholder check for connection - replace with a real one if available
        return false;
    }

    _statusCheckLoop() {
        GLib.timeout_add_seconds(GLib.PRIORITY_DEFAULT, 10, () => {
            this._refreshStatus();
            return true;
        });
    }
});

export default class SunshineStatusExtension extends Extension {
    enable() {
        this._indicator = new Indicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        this._indicator.destroy();
        this._indicator = null;
    }
}
