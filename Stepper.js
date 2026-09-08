/*
================================================================
 Stepper for Cavalry
 A "Posterize Time" style tool for keyframed animation.
================================================================

 WHAT IT DOES
 Samples the eased curve between your selected keyframes and
 bakes it into Step (hold) keyframes at a chosen frame rate,
 giving a stop motion look while preserving your easing.

 HOW TO USE
 1. Select 2 or more keyframes on any attribute(s) in the
    Time Editor or Graph Editor. Multiple attributes and
    multiple layers at once are supported.
 2. Set the Step FPS with the slider.
 3. Click "Create Stepped Keyframes".

 NOTES
 - The script reads the composition frame rate, so 12fps steps
   look identical whether your comp runs at 24, 30 or 60fps.
 - When the comp fps does not divide evenly by the step fps
   (for example 10fps steps in a 24fps comp), hold lengths
   alternate (2-3-2-3...) exactly like AE's Posterize Time.
 - The first keyframe of each selected pair is switched to
   Step so the hold starts immediately.
 - Undo (Cmd/Ctrl+Z) reverts the created keyframes.

 INSTALL
 Copy Stepper.js AND the Stepper_assets folder into your
 Cavalry Scripts folder (Help > Show Scripts Folder), then
 find it under Window > Scripts > Stepper.

================================================================
*/

// ---------------------------------------------------------------
// Theme
// ---------------------------------------------------------------

var THEME = {
	accent: "#00D778",
	accentHover: "#33E393",
	accentPressed: "#00B865",
	dark: "#1E1E1E",
	text: "#E6E6E6",
	muted: "#9A9A9A"
};

var ASSETS = ui.scriptLocation + "/Stepper_assets";

var FPS_MIN = 1;
var FPS_MAX = 30;
var FPS_DEFAULT = 12;

// ---------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------

// Read the active composition's frame rate. The attribute id is
// not documented, so try the likely names first, then scan the
// comp's attribute list for anything that looks like a frame rate.
function getCompFps() {
	var comp = api.getActiveComp();
	var candidates = ["frameRate", "fps", "frameRate.value", "sceneSettings.frameRate"];
	var i;
	for (i = 0; i < candidates.length; i++) {
		try {
			if (api.hasAttribute(comp, candidates[i])) {
				var v = Number(api.get(comp, candidates[i]));
				if (v > 0) {
					return v;
				}
			}
		} catch (err) {
			// try the next candidate
		}
	}
	try {
		var attrs = api.getAttributes(comp);
		for (i = 0; i < attrs.length; i++) {
			var id = String(attrs[i]);
			if (/fps|frame\s*_?rate/i.test(id)) {
				var v2 = Number(api.get(comp, id));
				if (v2 > 0) {
					console.log("Stepper: using comp attribute '" + id + "' for frame rate.");
					return v2;
				}
			}
		}
	} catch (err2) {
		// fall through
	}
	return null;
}

// Turn a selected keyframe path into { layerId, attrId }.
// Expected form is "basicShape#1.position.x". If the path has no
// layer id in it, fall back to the single selected layer.
function resolveAttrPath(attrPath) {
	var path = String(attrPath);
	var hash = path.indexOf("#");
	if (hash !== -1) {
		var dot = path.indexOf(".", hash);
		if (dot === -1) {
			return null;
		}
		return { layerId: path.substring(0, dot), attrId: path.substring(dot + 1) };
	}
	var selected = api.getSelection();
	if (selected.length === 1) {
		return { layerId: selected[0], attrId: path };
	}
	return null;
}

// Collect the selected keyframes into per-attribute jobs.
function buildJobs() {
	var selection = api.getSelectedKeyframes();
	var jobs = [];
	var unresolved = [];
	for (var attrPath in selection) {
		if (!Object.prototype.hasOwnProperty.call(selection, attrPath)) {
			continue;
		}
		var parts = resolveAttrPath(attrPath);
		if (!parts) {
			unresolved.push(attrPath);
			continue;
		}
		var raw = selection[attrPath];
		var frames = [];
		for (var i = 0; i < raw.length; i++) {
			var f = Number(raw[i]);
			if (!isNaN(f) && frames.indexOf(f) === -1) {
				frames.push(f);
			}
		}
		frames.sort(function (a, b) {
			return a - b;
		});
		if (frames.length < 2) {
			continue;
		}
		jobs.push({
			layerId: parts.layerId,
			attrId: parts.attrId,
			frames: frames,
			pairs: []
		});
	}
	return { jobs: jobs, unresolved: unresolved };
}

// Frames to place hold keys on, exclusive of both boundary keys.
// Accumulates float positions and rounds each one, so uneven
// intervals distribute naturally (2-3-2-3 at 10fps in 24).
function computeStepFrames(f0, f1, interval) {
	var frames = [];
	var t = f0 + interval;
	var lastPlaced = f0;
	while (t < f1 - 0.0001) {
		var f = Math.round(t);
		if (f > lastPlaced && f < f1) {
			frames.push(f);
			lastPlaced = f;
		}
		t += interval;
	}
	return frames;
}

// ---------------------------------------------------------------
// Core action
// ---------------------------------------------------------------

function createSteppedKeyframes(stepFps) {
	var compFps = getCompFps();
	if (compFps === null) {
		return { ok: false, message: "Could not read the composition frame rate. Please report this with your Cavalry version." };
	}
	if (stepFps > compFps) {
		return { ok: false, message: "Step FPS (" + stepFps + ") is higher than the comp FPS (" + compFps + "). Lower the Step FPS." };
	}

	var built = buildJobs();
	var jobs = built.jobs;
	if (jobs.length === 0) {
		if (built.unresolved.length > 0) {
			return { ok: false, message: "Could not work out which layer owns the selected keyframes. Select the layer in the Scene Window too, then try again." };
		}
		return { ok: false, message: "Select at least 2 keyframes on an attribute first (Time Editor or Graph Editor)." };
	}

	var interval = compFps / stepFps;
	var playheadHome = api.getFrame();

	// Phase 1: sample every value from the original eased curves
	// before writing anything, so new keys never pollute a read.
	try {
		for (var j = 0; j < jobs.length; j++) {
			var job = jobs[j];
			for (var i = 0; i < job.frames.length - 1; i++) {
				var f0 = job.frames[i];
				var f1 = job.frames[i + 1];
				var stepFrames = computeStepFrames(f0, f1, interval);
				var samples = [];
				for (var s = 0; s < stepFrames.length; s++) {
					api.setFrame(stepFrames[s]);
					samples.push({
						frame: stepFrames[s],
						value: api.get(job.layerId, job.attrId)
					});
				}
				job.pairs.push({ f0: f0, f1: f1, samples: samples });
			}
		}
	} finally {
		api.setFrame(playheadHome);
	}

	// Phase 2: write the stepped keyframes and switch boundary
	// keys to Step so every hold starts on its pose.
	var createdCount = 0;
	var attrCount = 0;
	var skipped = [];

	for (var j2 = 0; j2 < jobs.length; j2++) {
		var job2 = jobs[j2];
		try {
			for (var p = 0; p < job2.pairs.length; p++) {
				var pair = job2.pairs[p];

				for (var s2 = 0; s2 < pair.samples.length; s2++) {
					var sample = pair.samples[s2];
					var valueObj = {};
					valueObj[job2.attrId] = sample.value;
					api.keyframe(job2.layerId, sample.frame, valueObj);

					var modObj = {};
					modObj[job2.attrId] = { frame: sample.frame, type: 2 };
					api.modifyKeyframe(job2.layerId, modObj);
					createdCount++;
				}

				// Hold starts on the left boundary key of each pair.
				var boundaryMod = {};
				boundaryMod[job2.attrId] = { frame: pair.f0, type: 2 };
				api.modifyKeyframe(job2.layerId, boundaryMod);
			}
			attrCount++;
		} catch (err) {
			skipped.push(job2.layerId + "." + job2.attrId);
			console.error("Stepper skipped " + job2.layerId + "." + job2.attrId + ": " + err);
		}
	}

	if (createdCount === 0 && skipped.length === 0) {
		return { ok: false, message: "Keyframes are too close together for " + stepFps + "fps steps. Try a higher Step FPS or spread the keys out." };
	}

	var message = "Created " + createdCount + " stepped keyframes across " + attrCount + " attribute(s).";
	if (skipped.length > 0) {
		message += " Skipped: " + skipped.join(", ") + " (see Console).";
	}
	if (built.unresolved.length > 0) {
		message += " Ignored " + built.unresolved.length + " path(s) with no layer.";
	}
	return { ok: true, message: message };
}

// ---------------------------------------------------------------
// UI
// ---------------------------------------------------------------

ui.setTitle("Stepper");
ui.setMargins(6, 6, 6, 6);

// Header: logo centred
var logo = new ui.Image(ASSETS + "/StepperLogo.png");
logo.setToolTip("Stepper. Bake eased animation into stop motion style holds.");

var headerRow = new ui.HLayout();
headerRow.setMargins(2, 2, 2, 2);
headerRow.addStretch();
headerRow.add(logo);
headerRow.addStretch();

// Step FPS label row
var fpsLabel = new ui.Label("Step FPS");
fpsLabel.setTextColor(THEME.text);
fpsLabel.setToolTip("The frame rate of the stop motion holds. 12 = animating on 2s in a 24fps comp.");

var fpsLabelRow = new ui.HLayout();
fpsLabelRow.setMargins(2, 2, 2, 0);
fpsLabelRow.add(fpsLabel);
fpsLabelRow.addStretch();

// Slider row with live readout
var fpsSlider = new ui.Slider();
fpsSlider.setRange(FPS_MIN, FPS_MAX);
fpsSlider.setValue(FPS_DEFAULT);
fpsSlider.setToolTip("Drag to choose the Step FPS (" + FPS_MIN + " to " + FPS_MAX + ").");

var fpsValue = new ui.Label(String(FPS_DEFAULT));
fpsValue.setTextColor(THEME.accent);
fpsValue.setAlignment(2);
fpsValue.setFixedWidth(24);

function clampFps(v) {
	v = Math.round(Number(v));
	if (isNaN(v)) {
		return FPS_DEFAULT;
	}
	if (v < FPS_MIN) {
		return FPS_MIN;
	}
	if (v > FPS_MAX) {
		return FPS_MAX;
	}
	return v;
}

function getStepFps() {
	return clampFps(fpsSlider.getValue());
}

fpsSlider.onValueChanged = function () {
	fpsValue.setText(String(getStepFps()));
};

var sliderRow = new ui.HLayout();
sliderRow.setMargins(2, 0, 2, 2);
sliderRow.add(fpsSlider);
sliderRow.add(fpsValue);

// Status readout
var statusLabel = new ui.Label("Select keyframes, set a Step FPS, then Create.");
statusLabel.setTextColor(THEME.muted);

function setStatus(text, isError) {
	statusLabel.setText(text);
	statusLabel.setTextColor(isError ? THEME.text : THEME.accent);
	if (isError) {
		console.warn("Stepper: " + text);
	} else {
		console.log("Stepper: " + text);
	}
}

// Create button: a Container so we control fill, text colour and
// height. Padding inside the layout keeps a gap under the text if
// the panel is narrow enough to force a second line.
var BUTTON_PAD_X = 12;
var BUTTON_PAD_Y = 6;
var BUTTON_MIN_HEIGHT = 32;

var createText = new ui.Label("Create Stepped Keyframes");
createText.setTextColor(THEME.dark);
createText.setAlignment(1);

var createLayout = new ui.HLayout();
createLayout.setMargins(BUTTON_PAD_X, BUTTON_PAD_Y, BUTTON_PAD_X, BUTTON_PAD_Y);
createLayout.addStretch();
createLayout.add(createText);
createLayout.addStretch();

var createButton = new ui.Container();
createButton.setLayout(createLayout);
createButton.setBackgroundColor(THEME.accent);
createButton.setRadius(4, 4, 4, 4);
createButton.setMinimumHeight(BUTTON_MIN_HEIGHT);
createButton.useHoverEvents(true);
createButton.setToolTip("Bake stepped holds between every adjacent pair of selected keyframes.");

var pressedInside = false;

function isLeftButton(button) {
	if (button === undefined || button === null) {
		return true;
	}
	return String(button).toLowerCase().indexOf("left") !== -1;
}

createButton.onMouseEnter = function () {
	createButton.setBackgroundColor(pressedInside ? THEME.accentPressed : THEME.accentHover);
};
createButton.onMouseLeave = function () {
	createButton.setBackgroundColor(THEME.accent);
};
createButton.onMousePress = function (position, button) {
	if (!isLeftButton(button)) {
		return;
	}
	pressedInside = true;
	createButton.setBackgroundColor(THEME.accentPressed);
};
createButton.onMouseRelease = function (position, button) {
	if (!isLeftButton(button) || !pressedInside) {
		return;
	}
	pressedInside = false;
	createButton.setBackgroundColor(THEME.accentHover);
	try {
		var result = createSteppedKeyframes(getStepFps());
		setStatus(result.message, !result.ok);
	} catch (err) {
		setStatus("Error: " + err, true);
		console.error(err);
	}
};

var buttonRow = new ui.HLayout();
buttonRow.setMargins(2, 2, 2, 2);
buttonRow.add(createButton);

var statusRow = new ui.HLayout();
statusRow.setMargins(2, 2, 2, 2);
statusRow.add(statusLabel);

ui.add(headerRow);
ui.add(fpsLabelRow);
ui.add(sliderRow);
ui.add(buttonRow);
ui.add(statusRow);
ui.addStretch();

ui.show();
