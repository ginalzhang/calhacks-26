# Needs a human (most important first)

## 1. Pick the demo posture and test it on the real webcam
Try in this order and pick the one that tracks a *resting* hand best, then record it in DECISIONS.md:
(a) external webcam or phone-as-webcam (Continuity Camera / Phone Link) on a stand looking down at the desk;
(b) laptop pushed back, lid tilted ~30° down (the calibration screen's default);
(c) Head mode.

## 2. Keys
- `ANTHROPIC_API_KEY` and `CARTESIA_API_KEY` were **not** present during the overnight build. Everything that needs them runs behind a mock and the status bar says "key missing". Put both in `.env.local` (never commit) and restart `npm run dev`.

