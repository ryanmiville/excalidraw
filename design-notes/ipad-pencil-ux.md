# Making a drawing app feel right with an iPad and Apple Pencil

Lessons from tuning this Excalidraw fork for iPad + Apple Pencil, written so they carry over to any markup or annotation tool.

The test we kept coming back to: **if someone picks up the Pencil and just starts doing things, does the app do what they expected, without them stopping to switch modes or hunt for a button?** Every change below is about removing a stop.

## The person we designed for

- iPad in landscape, held by the left hand. The left thumb rests on the left edge of the screen.
- Pencil in the right hand, doing almost all the work on the canvas.
- They don't want a mouse-style UI. They want to draw a box and have a box, write a word and have text.

That posture drives everything: the thumb gets a few large targets near the edge, the Pencil gets the canvas, and nothing either one needs should be hidden behind a menu.

## Principles

1. **Let the Pencil carry intent.** Drawing a box should make a box. Double-tapping should make text. Writing should make text. Don't make the person tell the app what they're about to do when the gesture already says it.
2. **Never throw away or surprise-convert ink.** People will distrust a tool that turns their handwriting into an arrow. Recognition belongs in a mode the person chose, with a preview of what they'll get.
3. **Reuse the app's own pieces instead of inventing a parallel UI.** A customizable version of the existing toolbar beat every custom "tablet toolbar" we built. People already know the app's panels; move them, don't replace them.
4. **The thumb gets few, big, fixed targets.** No holds, no swipes, no fans. A plain tap on a button that's always in the same place.
5. **Keep the eyes on the drawing.** Anything that pulls your gaze away (a panel at the bottom, a zoom jump) feels like friction, even if it's technically fewer taps.
6. **Make where things will land obvious.** If you write in one place and it goes somewhere else, connect the two visually and show the result live.
7. **Test on the real device.** Several things that worked with simulated input in a desktop browser failed on the iPad (hold gestures, Pencil double-tap). The person's iPad is the only real test.

## What we built

### Shapes from freehand strokes ("Draw to shape" tool)

Upstream Excalidraw already has a "Draw to shape" tool: you sketch, it shows a faded preview of the shape it recognises, and when you lift the Pencil the stroke becomes a real rectangle, ellipse, diamond, line or arrow in your current colour and stroke. A line from one shape to another becomes an arrow attached to both.

We added **curved arrows** (a smooth single bend) and **elbow arrows** (an L or Z of straight horizontal/vertical runs), both attached to any shapes they touch. Code: `packages/element/src/shaftRecognition.ts`, `packages/element/src/convertToShape.ts`, `packages/excalidraw/components/App.drawshape.ts`.

What didn't work:

- **Auto-recognition inside the normal pen tool.** We built it first: any stroke that looked enough like a shape turned into one on lift, small strokes stayed as ink to protect handwriting, and arrowheads could be added as a separate stroke within a few seconds. It worked, but it needed guesswork thresholds to avoid converting writing, it couldn't show a preview, and the behaviour was invisible until it happened. A separate mode the person chooses is predictable, so we took it out. The one thing lost was drawing the arrowhead as a second stroke, since Draw to shape treats each stroke on its own.
- **A preview that changes its mind mid-stroke.** While drawing a box, the first two sides look like an elbow, so the preview flashed an elbow arrow until the box closed. We now only preview elbows once a head is drawn (they still convert on lift). Lesson: a preview that is wrong for most of the stroke is worse than no preview.

### A customizable toolbar for the thumb

The stock toolbar can now go on any edge (left, right, top, bottom), be resized S to XL with optional labels, and hold only the tools you pick, in your order (presets: Pencil, Pencil + shapes, Pencil + text, Everything). "Draw to shape" is a first-class button, never tucked in the More menu. Code: `packages/excalidraw/components/CustomToolbar/`.

The style options (stroke, colour, fill, etc.) are the normal full Excalidraw panel, on the left or right edge as the person chooses. When it's on the same side as the toolbar it docks beside it. It stays between the top-corner buttons and the footer so it never covers them, scrolls inside that space, and can be minimised to a small pill showing the current colour.

Settings are saved on the device only (localStorage `excalidraw.toolbarConfig`), not in the URL, so the app just opens the way you left it.

What didn't work:

- **Five purpose-built thumb toolbars** (a rail, a half-circle arc, a hold-to-switch pad, a drawer that changed per mode, a swipe "puck"). The simplest one (three big buttons) won, and then lost to simply making the existing toolbar movable and resizable. Custom widgets add things to learn; the real need was placement and size.
- **Hold-to-switch** (hold a thumb pad to use Select or Erase temporarily, release to go back to drawing). It looked good in recordings but didn't work on the iPad. Holding a finger on screen while the Pencil draws is exactly the kind of multi-input gesture that behaves differently on real hardware than in simulation. Avoid gestures that depend on two inputs at once.
- **Swipe and long-press controls** (swipe puck, colour fan). Hidden gestures are hard to discover and easy to trigger by accident with a resting hand.
- **Compact style options** (stroke and fill tucked into sub-menus, a "styles" button, inline mini pickers, a strip across the top). Every extra tap to reach a colour is friction. The full panel, always visible and minimisable, was preferred.
- **The style panel overlapping corner buttons.** Placing a panel on an edge has to respect what already lives in the corners.

### Text without the keyboard

- **Double-tap to type**, with the Pencil or a finger, in Select, Draw, Shapes and other drawing tools. You never leave the tool you're in, and the two dots the taps left behind are removed.
- **Scribble first.** The text box opens as a roomy writing box with the on-screen keyboard hidden (`inputmode="none"`), so iPadOS Scribble turns handwriting into text. Keyboard and Done buttons sit on the box for when you want them.
- **Labels in a speech bubble.** When the text is a shape's label, you write in a large bubble beside the shape, with a tail pointing at it. It picks the side that covers the least of the drawing, the shape is highlighted, and the text appears in the shape live as you write.
- **"Aa Label" chip** on a just-drawn or selected empty shape, for one-tap labelling.

Code: `packages/excalidraw/components/TextFlows/`, plus hooks in `App.tsx`, `App.textTool.ts` and `wysiwyg/textWysiwyg.tsx`.

What didn't work:

- **A Text button on the toolbar.** Every piece of text costs two thumb taps (Text, then back to Draw). Double-tap costs nothing.
- **Writing inside the shape itself.** Shapes are often small, so people start writing and drift off to the side for room. The bubble came from watching that: give them the room they're reaching for, and connect it to the target.
- **Other label layouts:** zooming in until the shape is big enough (moves your view every time), a writing panel at the bottom (takes your eyes off the shape), and "write anywhere" with only the result shown (you can't see your own writing).
- **The bubble looking like two shapes.** A box with a triangle stuck on reads as two things. It has to be one continuous outline. Removing the border and using a drop shadow instead went too far; the fix was one outline with the original border.

## Pencil and touch pitfalls

- **iPadOS doesn't reliably send touch events for the Pencil.** Double-tap detection that listened to touch events worked with a finger but not the Pencil. Detect Pencil gestures from pointer events (`pointerType === "pen"`). See `maybePenDoubleTap` in `App.tsx`: two quick taps (under 300 ms and 12 px of movement each) within 400 ms of each other.
- **A double-tap's second tap also reaches the active tool.** In Draw that's harmless (it leaves a dot we clean up), but in the Shapes tool it started a new shape whose finish closed the text box the double-tap had just opened. Decide per tool whether the second tap should be swallowed.
- **Scribble adds a trailing line break.** Text written with Scribble ended with a newline every time. We trim trailing line breaks when a Scribble box closes. Most likely cause: in a tall multi-line box, Scribble inserts line breaks so text lands on the line you wrote on. Expect Scribble to insert whitespace you didn't type.
- **`inputmode` is only re-read on focus.** To show the keyboard after starting with it hidden, you have to swap the attribute and re-focus without a blur that would close the editor.

## Working process that helped

- A fixed preview URL (GitHub Pages from `/docs`) rebuilt in about 20 seconds per change, so the loop was: change, reload on the iPad, give feedback.
- Several real, working prototypes behind a picker, plus short recordings of each, instead of describing options in words. Choices got made in minutes.
- Once a direction was settled, delete the losing prototypes and the settings that only existed to compare them.
