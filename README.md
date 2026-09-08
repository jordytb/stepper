# Stepper

Posterize Time for Cavalry. Turn any eased animation into stop motion style holds, and keep your easing.

![Stepper logo](Stepper_assets/StepperLogo.png)

## What it does

Cavalry doesn't have a Posterize Time effect, so Stepper does it with keyframes. Select some keys, pick a frame rate, and Stepper samples the curve between them and writes Step (hold) keyframes at that rate. Your slow-in still reads as a slow-in, it's just on 2s now.

It reads your comp's frame rate too, so 12fps holds look the same in a 24, 30 or 60fps comp. When the rates don't divide evenly, holds alternate (2-3-2-3) exactly like AE.

## Install

1. In Cavalry, go to `Help > Show Scripts Folder`.
2. Drop in `Stepper.js` and the `Stepper_assets` folder. Keep them together.
3. Open `Window > Scripts > Stepper`.

## Use

1. Select two or more keyframes on any attribute (multiple attributes and layers are fine).
2. Set the **Step FPS** slider. 12 in a 24fps comp is animating on 2s.
3. Hit **Create Stepped Keyframes**.

Not happy? Undo, tweak your curve, go again.

## Good to know

- Works on numbers and colours. Path keyframes are skipped.
- Picking a Step FPS higher than your comp rate does nothing except warn you.
- The first key of each pair is switched to Step so the hold starts right on your pose.

## Roadmap

Step distribution control for spacing holds in or out, a one-click Restore Easing button, and remembering your last Step FPS.

## Contributing

Issues and PRs welcome. If something breaks, include your Cavalry version and anything from the JavaScript Console.

Made by [Jordan Beaumont](https://YOUR-LINK-HERE). MIT licensed, see [LICENSE](LICENSE).
