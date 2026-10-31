import base64
import json
import os
import sys
import uuid

try:
    import gi

    gi.require_version("Gio", "2.0")
    gi.require_version("Gst", "1.0")
    from gi.repository import Gio, GLib, Gst
except Exception as error:
    print(json.dumps({"ok": False, "error": f"Python GObject/GStreamer is unavailable: {error}"}), flush=True)
    raise SystemExit(1)


PORTAL = "org.freedesktop.portal.Desktop"
PORTAL_PATH = "/org/freedesktop/portal/desktop"
REMOTE_DESKTOP = "org.freedesktop.portal.RemoteDesktop"
SCREEN_CAST = "org.freedesktop.portal.ScreenCast"
REQUEST = "org.freedesktop.portal.Request"
SESSION = "org.freedesktop.portal.Session"
MAX_WIDTH = 1600
MAX_HEIGHT = 1000
KEYS = {
    "Enter": 0xFF0D,
    "Tab": 0xFF09,
    "Escape": 0xFF1B,
    "Backspace": 0xFF08,
    "Delete": 0xFFFF,
    "Space": 0x20,
    "ArrowUp": 0xFF52,
    "ArrowDown": 0xFF54,
    "ArrowLeft": 0xFF51,
    "ArrowRight": 0xFF53,
    "Home": 0xFF50,
    "End": 0xFF57,
    "PageUp": 0xFF55,
    "PageDown": 0xFF56,
    "F1": 0xFFBE,
    "F2": 0xFFBF,
    "F3": 0xFFC0,
    "F4": 0xFFC1,
    "F5": 0xFFC2,
    "F6": 0xFFC3,
    "F7": 0xFFC4,
    "F8": 0xFFC5,
    "F9": 0xFFC6,
    "F10": 0xFFC7,
    "F11": 0xFFC8,
    "F12": 0xFFC9,
    "Shift": 0xFFE1,
    "Control": 0xFFE3,
    "Alt": 0xFFE9,
    "Meta": 0xFFEB,
}
MODIFIERS = {"Shift", "Control", "Alt", "Meta"}
BUTTONS = {"left": 0x110, "right": 0x111, "middle": 0x112}


def unwrap(value):
    if isinstance(value, GLib.Variant):
        return unwrap(value.unpack())
    if isinstance(value, dict):
        return {key: unwrap(item) for key, item in value.items()}
    if isinstance(value, (list, tuple)):
        return [unwrap(item) for item in value]
    return value


class PortalSession:
    def __init__(self, permissions):
        Gst.init(None)
        self.connection = Gio.bus_get_sync(Gio.BusType.SESSION, None)
        self.handle = None
        self.fd = None
        self.stream = None
        self.pipeline = None
        self.sink = None
        self.width = self.height = self.frame_width = self.frame_height = 0
        self.permissions = permissions
        try:
            self.open(permissions)
        except Exception:
            self.close()
            raise

    def request(self, interface, method, signature, args, options):
        token = "t4_" + uuid.uuid4().hex
        options = {**options, "handle_token": GLib.Variant("s", token)}
        sender = self.connection.get_unique_name().lstrip(":").replace(".", "_")
        expected = f"{PORTAL_PATH}/request/{sender}/{token}"
        result = {}
        loop = GLib.MainLoop()

        def on_response(_connection, _sender, path, _interface, _member, parameters, _data):
            if path == expected:
                result["response"] = parameters.unpack()
                loop.quit()

        subscription = self.connection.signal_subscribe(
            PORTAL, REQUEST, "Response", expected, None, Gio.DBusSignalFlags.NONE, on_response, None
        )
        try:
            reply = self.connection.call_sync(
                PORTAL,
                PORTAL_PATH,
                interface,
                method,
                GLib.Variant(f"({signature})", (*args, options)),
                GLib.VariantType.new("(o)"),
                Gio.DBusCallFlags.NONE,
                5000,
                None,
            )
            request_path = reply.unpack()[0]
            if request_path != expected:
                raise RuntimeError("The desktop portal returned an unexpected request handle.")
            def on_timeout():
                result["timed_out"] = True
                loop.quit()
                return GLib.SOURCE_REMOVE

            timeout_id = GLib.timeout_add_seconds(120, on_timeout)
            loop.run()
            if not result.get("timed_out"):
                GLib.source_remove(timeout_id)
            if "response" not in result:
                raise RuntimeError("The desktop permission prompt timed out.")
            status, values = result["response"]
            if status != 0:
                reason = "Screen selection was cancelled." if status == 1 else "Desktop access was denied."
                raise RuntimeError(reason)
            return unwrap(values)
        finally:
            self.connection.signal_unsubscribe(subscription)

    def open(self, permissions):
        token = "t4_" + uuid.uuid4().hex
        created = self.request(
            REMOTE_DESKTOP,
            "CreateSession",
            "a{sv}",
            (),
            {"session_handle_token": GLib.Variant("s", token)},
        )
        self.handle = created.get("session_handle")
        if not isinstance(self.handle, str) or not self.handle.startswith(f"{PORTAL_PATH}/session/"):
            raise RuntimeError("The desktop portal returned an invalid session handle.")

        devices = (2 if permissions.get("pointer") or permissions.get("click") else 0) | (
            1 if permissions.get("keyboard") else 0
        )
        self.request(
            REMOTE_DESKTOP,
            "SelectDevices",
            "oa{sv}",
            (self.handle,),
            {"types": GLib.Variant("u", devices), "persist_mode": GLib.Variant("u", 1)},
        )
        if permissions.get("screen"):
            self.request(
                SCREEN_CAST,
                "SelectSources",
                "oa{sv}",
                (self.handle,),
                {"types": GLib.Variant("u", 1), "multiple": GLib.Variant("b", False)},
            )
        started = self.request(
            REMOTE_DESKTOP,
            "Start",
            "osa{sv}",
            (self.handle, ""),
            {},
        )
        granted = int(started.get("devices", 0))
        if (permissions.get("pointer") or permissions.get("click")) and not granted & 2:
            raise RuntimeError("The system did not grant pointer access.")
        if permissions.get("keyboard") and not granted & 1:
            raise RuntimeError("The system did not grant keyboard access.")
        if not permissions.get("screen"):
            return

        streams = started.get("streams") or []
        if not streams:
            raise RuntimeError("The system did not grant a screen stream.")
        self.stream = int(streams[0][0])
        properties = streams[0][1]
        logical_size = properties.get("logical_size") or properties.get("size") or (0, 0)
        self.width, self.height = int(logical_size[0]), int(logical_size[1])
        if self.width <= 0 or self.height <= 0:
            raise RuntimeError("The desktop portal returned invalid screen dimensions.")
        scale = min(1.0, MAX_WIDTH / self.width, MAX_HEIGHT / self.height)
        self.frame_width = max(1, round(self.width * scale))
        self.frame_height = max(1, round(self.height * scale))

        reply, fds = self.connection.call_with_unix_fd_list_sync(
            PORTAL,
            PORTAL_PATH,
            SCREEN_CAST,
            "OpenPipeWireRemote",
            GLib.Variant("(oa{sv})", (self.handle, {})),
            None,
            Gio.DBusCallFlags.NONE,
            5000,
            None,
        )
        self.fd = fds.get(int(reply.unpack()[0]))
        self.start_pipeline()

    def start_pipeline(self):
        source = Gst.ElementFactory.make("pipewiresrc")
        self.valve = Gst.ElementFactory.make("valve")
        scale = Gst.ElementFactory.make("videoscale")
        caps_filter = Gst.ElementFactory.make("capsfilter")
        convert = Gst.ElementFactory.make("videoconvert")
        encoder = Gst.ElementFactory.make("pngenc")
        self.sink = Gst.ElementFactory.make("appsink")
        elements = [source, self.valve, scale, caps_filter, convert, encoder, self.sink]
        if any(element is None for element in elements):
            raise RuntimeError("GStreamer is missing a PipeWire screen capture element.")
        source.set_property("path", self.stream)
        source.set_property("do-timestamp", True)
        self.valve.set_property("drop", True)
        caps_filter.set_property(
            "caps", Gst.Caps.from_string(f"video/x-raw,width={self.frame_width},height={self.frame_height}")
        )
        encoder.set_property("compression-level", 1)
        self.sink.set_property("sync", False)
        self.sink.set_property("max-buffers", 1)
        self.sink.set_property("drop", True)
        self.pipeline = Gst.Pipeline.new("t4-computer-use")
        source.set_property("fd", os.dup(self.fd))
        for element in elements:
            self.pipeline.add(element)
        try:
            Gst.Element.link_many(*elements)
        except Gst.LinkError:
            raise RuntimeError("Could not link the PipeWire capture pipeline.")
        if self.pipeline.set_state(Gst.State.PLAYING) == Gst.StateChangeReturn.FAILURE:
            raise RuntimeError("Could not start the PipeWire screen capture pipeline.")

    def input_call(self, method, signature, *values):
        self.connection.call_sync(
            PORTAL,
            PORTAL_PATH,
            REMOTE_DESKTOP,
            method,
            GLib.Variant(f"({signature})", (self.handle, {}, *values)),
            None,
            Gio.DBusCallFlags.NONE,
            5000,
            None,
        )

    def point(self, x, y):
        if self.stream is None or not 0 <= x <= self.frame_width or not 0 <= y <= self.frame_height:
            raise RuntimeError("Pointer coordinates are outside the selected screen.")
        return (
            min(self.width - 1, round(x * self.width / self.frame_width)),
            min(self.height - 1, round(y * self.height / self.frame_height)),
        )

    def action(self, command):
        action = command.get("action")
        if action == "dimensions":
            return {
                "screenWidth": self.width,
                "screenHeight": self.height,
                "frameWidth": self.frame_width,
                "frameHeight": self.frame_height,
            }
        if action == "screenshot":
            self.valve.set_property("drop", False)
            try:
                sample = self.sink.emit("try-pull-sample", 5 * Gst.SECOND)
            finally:
                self.valve.set_property("drop", True)
            if sample is None:
                raise RuntimeError("Timed out waiting for a screen frame.")
            buffer = sample.get_buffer()
            ok, mapping = buffer.map(Gst.MapFlags.READ)
            if not ok:
                raise RuntimeError("Could not read the screen frame.")
            try:
                png = bytes(mapping.data)
            finally:
                buffer.unmap(mapping)
            return {
                "png": base64.b64encode(png).decode("ascii"),
                "screenWidth": self.width,
                "screenHeight": self.height,
                "frameWidth": self.frame_width,
                "frameHeight": self.frame_height,
            }
        if action == "move":
            x, y = self.point(command["x"], command["y"])
            self.input_call("NotifyPointerMotionAbsolute", "oa{sv}udd", self.stream, x, y)
            return {}
        if action == "click":
            x, y = self.point(command["x"], command["y"])
            button = BUTTONS[command.get("button", "left")]
            click_count = command.get("clickCount", 1)
            if click_count not in (1, 2):
                raise RuntimeError("Click count must be one or two.")
            self.input_call("NotifyPointerMotionAbsolute", "oa{sv}udd", self.stream, x, y)
            for _ in range(click_count):
                try:
                    self.input_call("NotifyPointerButton", "oa{sv}iu", button, 1)
                finally:
                    self.input_call("NotifyPointerButton", "oa{sv}iu", button, 0)
            return {}
        if action == "drag":
            start_x, start_y = self.point(command["startX"], command["startY"])
            end_x, end_y = self.point(command["endX"], command["endY"])
            button = BUTTONS[command.get("button", "left")]
            self.input_call("NotifyPointerMotionAbsolute", "oa{sv}udd", self.stream, start_x, start_y)
            try:
                self.input_call("NotifyPointerButton", "oa{sv}iu", button, 1)
                self.input_call("NotifyPointerMotionAbsolute", "oa{sv}udd", self.stream, end_x, end_y)
            finally:
                self.input_call("NotifyPointerButton", "oa{sv}iu", button, 0)
            return {}
        if action == "scroll":
            x, y = self.point(command["x"], command["y"])
            delta_x, delta_y = command.get("deltaX", 0), command.get("deltaY", 0)
            if abs(delta_x) > 100 or abs(delta_y) > 100 or (delta_x == 0 and delta_y == 0):
                raise RuntimeError("Invalid scroll distance.")
            self.input_call("NotifyPointerMotionAbsolute", "oa{sv}udd", self.stream, x, y)
            if delta_y:
                self.input_call("NotifyPointerAxisDiscrete", "oa{sv}ui", 0, round(delta_y))
            if delta_x:
                self.input_call("NotifyPointerAxisDiscrete", "oa{sv}ui", 1, round(delta_x))
            return {}
        if action == "type":
            text = command["text"]
            if len(text) > 256:
                raise RuntimeError("Text is limited to 256 characters per call.")
            for character in text:
                if character == "\n" or character == "\r":
                    keysym = KEYS["Enter"]
                elif character == "\t":
                    keysym = KEYS["Tab"]
                else:
                    codepoint = ord(character)
                    keysym = codepoint if codepoint <= 0xFF else 0x01000000 | codepoint
                self.key(keysym)
            return {}
        if action == "press_key":
            key = command["key"]
            if len(key) > 20:
                raise RuntimeError("Key name is too long.")
            character = list(key)
            keysym = KEYS.get(key)
            if keysym is None and len(character) == 1:
                codepoint = ord(character[0])
                keysym = codepoint if codepoint <= 0xFF else 0x01000000 | codepoint
            if keysym is None:
                raise RuntimeError("Key is not supported.")
            modifiers = command.get("modifiers", [])
            if len(modifiers) > 3 or len(set(modifiers)) != len(modifiers) or any(
                modifier not in MODIFIERS for modifier in modifiers
            ):
                raise RuntimeError("Use up to three distinct supported keyboard modifiers.")
            pressed = []
            try:
                for modifier in modifiers:
                    self.input_call("NotifyKeyboardKeysym", "oa{sv}iu", KEYS[modifier], 1)
                    pressed.append(KEYS[modifier])
                self.input_call("NotifyKeyboardKeysym", "oa{sv}iu", keysym, 1)
                pressed.append(keysym)
            finally:
                for item in reversed(pressed):
                    self.input_call("NotifyKeyboardKeysym", "oa{sv}iu", item, 0)
            return {}
        raise RuntimeError("Unknown computer action.")

    def key(self, keysym):
        try:
            self.input_call("NotifyKeyboardKeysym", "oa{sv}iu", keysym, 1)
        finally:
            self.input_call("NotifyKeyboardKeysym", "oa{sv}iu", keysym, 0)

    def close(self):
        if self.pipeline is not None:
            self.pipeline.set_state(Gst.State.NULL)
            self.pipeline = None
        if self.handle is not None:
            try:
                self.connection.call_sync(
                    PORTAL,
                    self.handle,
                    SESSION,
                    "Close",
                    None,
                    None,
                    Gio.DBusCallFlags.NONE,
                    1000,
                    None,
                )
            except Exception:
                pass
            self.handle = None
        if self.fd is not None:
            os.close(self.fd)
            self.fd = None


session = None
for line in sys.stdin:
    try:
        command = json.loads(line)
        if command.get("action") == "start":
            if session is not None:
                session.close()
            session = PortalSession(command["permissions"])
            result = {
                "streamId": session.stream,
                "screenWidth": session.width,
                "screenHeight": session.height,
                "frameWidth": session.frame_width,
                "frameHeight": session.frame_height,
            }
        elif command.get("action") == "close":
            if session is not None:
                session.close()
                session = None
            result = {}
        elif session is None:
            raise RuntimeError("No approved desktop session is active.")
        else:
            result = session.action(command)
        print(json.dumps({"ok": True, "result": result}), flush=True)
    except Exception as error:
        print(json.dumps({"ok": False, "error": str(error)}), flush=True)
