# Computer Use

Computer Use lets an agent view and control the desktop hosted by an environment. On Linux Wayland, it uses the desktop's system permission dialog to select one display and approve screen, pointer, and keyboard access.

Open **Settings → Integrations → Computer Use** for the environment that hosts the desktop. Enable Computer Use, enable agent access, then turn on only the permissions you want to grant. Choose **Choose screen…** to open the system display picker. The agent can use the feature after you start a new agent session.

Agents can request a screen image, move or click the pointer, scroll, type text, and press supported keys. The server checks the current settings on every action and closes the desktop session when Computer Use is disabled or its permissions change. Screen images are scaled to at most 1600 × 1000 pixels before they are sent to the agent.

Computer Use currently requires the environment server to run on Linux with a Wayland desktop, XDG RemoteDesktop and ScreenCast portals, and GStreamer with its PipeWire plugin. The desktop may show a separate system approval prompt. The screen picker and approval appear on the machine hosting the environment, even when you connect remotely.
