# Stepper

Posterize Time for Cavalry. Bake any eased animation into stop motion style holds, without losing your easing.

![Stepper logo](SteppedMotion_assets/StepperLogo.png)

## What it does

After Effects has Posterize Time. Cavalry doesn't, and scripts can't create Behaviours. Stepper gets you the same result a different way: it samples the curve between your selected keyframes and writes new Step (hold) keyframes at whatever frame rate you choose. Your original easing is baked into where each hold lands, so a slow-out still reads as a slow-out, just on 2s, 3s or 12s.

Because the result is plain keyframes, you can still nudge, offset or delete individual holds afterwards.

## Install

1. Open Cavalry and go to `Help > Show Scripts Folder`.
2. Copy both `SteppedMotion.js` and the `SteppedMotion_assets` folder into it. The script loads its logo from that folder, so keep them together.
3. Back in Cavalry, open `Window > Scripts > SteppedMotion`.

## Usage

1. Select two or more keyframes on any attribute in the Time Editor or Graph Editor. You can select keyframes across several attributes and layers at once.
2. Set the **Step FPS** slider (1 to 30). 12 in a 24fps comp is animating on 2s.
3. Click **Create Stepped Keyframes**.

The status line under the button tells you what happened. Undo (Cmd/Ctrl+Z) reverts a run.

## How the timing works

Stepper reads your composition's frame rate, so a 12fps step looks identical in a 24, 30 or 60fps comp. When the comp rate doesn't divide evenly by the step rate (say 10fps steps in a 24fps comp), hold lengths alternate 2-3-2-3, which is exactly what Posterize Time does.

If you pick a Step FPS higher than the comp frame rate, Stepper warns you and does nothing.

The first keyframe of each selected pair is switched to Step interpolation so the hold starts on your pose rather than easing into the first hold.

## Limitations

- Works on scalar and colour attributes. Path animation keyframes are skipped with a note in the console.
- Once holds are baked, the original curve between those keys is replaced. Undo, tweak your easing, then run again.
- Tested with the current Cavalry release. Older versions may lack some UI or keyframe API calls.

## Roadmap

- Step distribution control (ease the spacing of holds in or out for more animation principle flexibility).
- Restore Easing button that removes baked holds and puts the original curve back, so you can iterate without undo.
- Per session memory of the last Step FPS.

## Contributing

Issues and pull requests welcome. If something breaks, please include your Cavalry version and anything printed in the JavaScript Console.

## Credit

Made by [Jordan Beaumont](https://YOUR-LINK-HERE).

## License

MIT. See [LICENSE](LICENSE).
