# ⌨️ NINK – Next INteractive Keyboard

**NINK** (Next INteractive Keyboard) is a fully dynamic, full-color, touch-enabled keyboard powered by programable interface. It reimagines human–computer interaction by replacing traditional mechanical keycaps with a transparent, capacitive overlay above a full-screen display.

Originally conceived for retro emulation, NINK now supports a broad range of applications: productivity, gaming, AI-driven interaction, accessibility, and programmable control panels.

---

## 🎯 Vision

A next-gen input device with:
- **Dynamic on-screen keyboard** that changes per application or context
- **Capacitive transparent key overlay** to maintain tactile feedback
- Full **visual customization** — colors, icons, animations
- AI integration to generate layouts and full emulator keypad layouts

---

## 🧱 Hardware Overview

| Component            | Description                                      |
|----------------------|--------------------------------------------------|
| **Display**           | 292 × 113 mm (12.3") touchscreen, 2560×720       |
| **Input**             | Transparent capacitive touch matrix overlay     |
| **Platform**          | Raspberry Pi 4/5, mini PC, or embedded system   |
| **Connectivity**      | USB + HDMI, or fully integrated ARM SBC         |
| **Materials**         | Acrylic/PC housing with conductive key islands  |

---

## 🧰 Software Stack

| Layer           | Tech                          |
|-----------------|-------------------------------|
| UI rendering     | Python + Pygame / Kivy / LVGL |
| Touch input      | Capacitive HID / multitouch   |
| Layout engine    | JSON-based key map + state    |
| AI integration   | AI integration via REST API   |
| Emulator control | RetroPie / Batocera / CLI     |

---

## 🚀 Features (Planned / In Progress)

- [x] Per-key pixel mapping (15U × 5-row layout)
- [x] Full 2560×720 key rendering grid
- [ ] Touch key detection and remapping
- [ ] Dynamic layout switching (including ZX Spectrum, ZX81, C64, QWERTY, gaming)
- [ ] ChatGPT integration for "Generate & Play" game sessions
- [ ] Configurable key zones via overlay files
- [ ] Low-latency key feedback / audio / animation

---

## 💡 Example Use Cases

- Retro emulation (C64, Amiga, ZX Spectrum, DOS)
- Custom keyboard for video editing, streaming, or music
- Accessible keyboards with visual/sound feedback
- AI-driven assistants that adapt the interface in real time
- Educational keyboards for learning programming or languages

---

## 📷 Concept

![NINK Concept Image](images/nink-render.png)

---

## 📁 Project Structure

