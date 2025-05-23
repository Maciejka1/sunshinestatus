import GObject from 'gi://GObject';
import Gio from 'gi://Gio';
import GLib from 'gi://GLib';
import St from 'gi://St';

import { Extension, gettext as _ } from 'resource:///org/gnome/shell/extensions/extension.js';
import * as PanelMenu from 'resource:///org/gnome/shell/ui/panelMenu.js';
import * as PopupMenu from 'resource:///org/gnome/shell/ui/popupMenu.js';
import * as Main from 'resource:///org/gnome/shell/ui/main.js';

const SunshineIndicator = GObject.registerClass(
class SunshineIndicator extends PanelMenu.Button {
    _init() {
        super._init(0.0, _('Sunshine Status'));

        this._icon = new St.Icon({
            icon_name: 'network-offline-symbolic',
            style_class: 'sunshine-icon-off',
        });
        this.add_child(this._icon);

        this._process = null;
        this._running = false;
        this._connected = false;

        this._buildMenu();
    }

    _buildMenu() {
        this.menu.removeAll();

        let statusText = _('Off');
        let styleClass = 'sunshine-status-off';
        if (this._running) {
            statusText = this._connected ? _('Connected') : _('Started');
            styleClass = this._connected ? 'sunshine-status-connected' : 'sunshine-status-started';
        }
        let statusItem = new PopupMenu.PopupMenuItem(statusText, { reactive: false });
        statusItem.label.add_style_class_name(styleClass);
        this.menu.addMenuItem(statusItem);

        this.menu.addMenuItem(new PopupMenu.PopupSeparatorMenuItem());

        let actionText = this._running ? _('Stop Sunshine') : _('Start Sunshine');
        let actionItem = new PopupMenu.PopupMenuItem(actionText);
        actionItem.connect('activate', () => this._toggle());
        this.menu.addMenuItem(actionItem);
    }

    _toggle() {
        if (!this._running) {
            this._startSunshine();
        } else {
            this._stopSunshine();
        }
    }

    _startSunshine() {
        try {
            this._process = new Gio.Subprocess({
                argv: ['sunshine'],
                flags: Gio.SubprocessFlags.STDOUT_PIPE | Gio.SubprocessFlags.STDERR_MERGE,
            });
            this._process.init(null);
            this._running = true;
            this._connected = false;

            this._process.wait_async(null, (obj, res) => {
                try {
                    this._process.wait_finish(res);
                    this._running = false;
                    this._connected = false;
                    this._updateVisuals();
                } catch (e) {
                    console.error(`Error waiting for subprocess: ${e}`);
                }
            });

            let stdout = new Gio.DataInputStream({ base_stream: this._process.get_stdout_pipe() });
            const readLine = () => {
                stdout.read_line_async(GLib.PRIORITY_DEFAULT, null, (obj, res) => {
                    try {
                        let [line, length] = obj.read_line_finish(res);
                        if (line) {
                            let str = line.toString().toLowerCase();
                            console.log('Sunshine output: ' + str); 
                            if (str.includes('client connected')) {
                                this._connected = true;
                                this._updateVisuals();
                            } else if (str.includes('client disconnected')) {
                                this._connected = false;
                                this._updateVisuals();
                            }
                        }
                    } catch (e) {
                        this._running = false;
                        this._connected = false;
                        this._updateVisuals();
                        return;
                    }
                    if (this._running)
                        readLine();
                });
            };
            readLine();

            this._updateVisuals();
        } catch (e) {
            console.error(`Failed to start sunshine: ${e}`);
        }
    }

    _stopSunshine() {
        if (this._process) {
            try {
                this._process.force_exit();
                this._running = false;
                this._connected = false;
                this._updateVisuals();
            } catch (e) {
                console.error(`Error stopping sunshine: ${e}`);
            }
            this._process = null;
        }
    }

    _updateVisuals() {
        this._icon.remove_style_class_name('sunshine-icon-off');
        this._icon.remove_style_class_name('sunshine-icon-started');
        this._icon.remove_style_class_name('sunshine-icon-connected');

        if (!this._running) {
            this._icon.icon_name = 'network-offline-symbolic';
            this._icon.add_style_class_name('sunshine-icon-off');
        } else if (this._connected) {
            this._icon.icon_name = 'network-wired-symbolic';
            this._icon.add_style_class_name('sunshine-icon-connected');
        } else {
            this._icon.icon_name = 'weather-clear-symbolic';
            this._icon.add_style_class_name('sunshine-icon-started');
        }

        this._buildMenu();
    }
});

export default class SunshineExtension extends Extension {
    enable() {
        this._indicator = new SunshineIndicator();
        Main.panel.addToStatusArea(this.uuid, this._indicator);
    }

    disable() {
        if (this._indicator) {
            this._indicator.destroy();
            this._indicator = null;
        }
    }
}