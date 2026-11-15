<img src="./logo.svg" width="240" alt="MetaOnticVideo" />

# MetaOnticVideo

[简体中文](./README.md)

A DeepSeek Harness plugin for **beginner-friendly video creation and a low-cost long-video workflow**.

## Start creating videos quickly

Describe what you want to make and follow the assistant through your first video, without first learning prompting or editing workflows.

1. **Share your idea**: start with a brief thought or a complete concept. Any refinement stays true to your original idea.
2. **Review the script**: read what will be filmed, ask for changes in plain language, then confirm production.
3. **Watch the result**: preview the generated video and keep the finished file locally.

For example: “Make a 30-second vertical 720P video showing a peaceful lake at dawn.” Duration, orientation and resolution already supplied are reused; only missing details are requested.

## A low-cost long-video workflow

Use **segment generation → continuation → local merging** to make videos beyond the model’s single-call duration limit.

- Review each result before continuing to the next segment.
- Keep and reuse completed segments, pause and resume saved progress, and avoid starting over.
- Merge completed segments locally with FFmpeg while retaining the original clips.

Bring your own API key. Image and video calls are billed by the chosen provider, with cost confirmation before each new segment.

## Online installation

Paste an online installation URL into Harness → Plugins → Add plugin. Windows and macOS use the same package.

Gitee:

```text
https://gitee.com/hackloop/metaontic-video/releases/download/v3.24.1/metaontic-video-3.24.1.tgz
```

GitHub mirror:

```text
https://github.com/wxsimon2022/metaontic-video/releases/download/v3.24.1/metaontic-video-3.24.1.tgz
```

Open plugin settings, choose **MetaOntic AI**, enter your API key and save. Select **视频创作助手** in a conversation to begin; **宣传视频助手** is also available for product, brand or event content. Both assistants share the production workflow. Standard mode remains general-purpose.

[Online user guide](https://ai.mybfs.cn) · [Report an issue](https://github.com/wxsimon2022/metaontic-video/issues) · [Changelog](./CHANGELOG.md) · [Development](./docs/engineering/development.md)

## Plugin architecture

Agents declare their business dependencies; the shared framework assembles them. Both existing assistants use the video module. New business modules can be added independently.

```mermaid
flowchart TB
    Harness[DeepSeek Harness]
    Harness --> Host["Host entry: src/index.ts"]
    Harness --> Client["Browser entry: src/client.ts"]
    Director[Video creation assistant] --> Agents["Agent definitions: src/agents"]
    Promo[Promotional video assistant] --> Agents
    Agents --> Core["Shared framework: src/core<br/>Agent and tool registration · Scope · Lifecycle"]
    Host --> Core
    Core --> Video["Video module: src/businesses/video<br/>Review · Generation · Continuation · Recovery · Delivery"]
    Video --> Providers[Image and video providers]
    Video --> Media[Local download and FFmpeg merging]
    Client --> UI["Shared UI: src/client<br/>Module assembly · Settings composition · Updates"]
    UI --> VideoUI["Video UI<br/>Settings · Progress · Media preview"]
```

[Module structure and adding agents or businesses](./docs/engineering/structure-refactor.md)

See [LICENSE](./LICENSE).

### Infinite Canvas

The workflow canvas is built into this plugin: no other canvas plugin and no canvas data root are required.

Two settings switches control the canvas. Turn on "Workflow canvas" (off by default) and the left sidebar shows the "MetaOnticVideo workflow canvas" row; once it is on, a second switch "Create canvas automatically" appears (on by default) that makes ordinary video creation build and publish a workflow canvas — the project is created once requirements are confirmed, the full script and production segment plan are synchronized after review, and generated media is published back automatically; turn it off and the plugin only acts on nodes you select. Turning "Workflow canvas" off hides the sidebar row and the canvas page together; existing canvases and results stay in the plugin data directory. Open the workflow canvas as its own page from the "MetaOnticVideo workflow canvas" row in the left sidebar (the video panel no longer embeds a copy); it shows nodes and edges, plus seven stage cards across the top that mirror the canvas workflow (requirements, script, storyboard, assets, cost, segments, film), joined by dashed arrows into one chain and updated as the project advances, outlining the current stage. Each card carries the action for its step — Fill brief (then Edit brief), Write script (then Confirm script, then Review script), Generate storyboard (then Review storyboard), Prepare assets (character sheet, first frame or reference image; assets are bound back to the segment they serve, and the card says how many are not wired up yet), See estimate (per-segment prompts plus the whole-chain estimate), Make this segment, Merge film — as an entry point only: every generation still needs its own plan check and separate cost confirmation, and the cards themselves never take part in generation. While the script is still unapproved, stage 2 offers Confirm script (the script node carries the same button): checking the script and each segment prompt then completes the script review on the canvas, marks stage 2 done and never falls back to "to review". The flow follows the conversation order in two steps: clicking empty canvas space opens the flow panel and step one is Create brief (what to shoot, total and per-segment seconds, ratio, resolution) — confirming it marks stage 1 done and only writes the brief node and stage cards, with no script and no model call; clicking again (or stage 2's Write script) opens step two, which writes the script and storyboard from that brief (write it yourself or let the text model do it, billed by text usage), previews the split, then creates the script, storyboard, one picture (“Frame”) node per segment and the segment video node (each frame is generated first and then wired into that segment's video node as its first frame); stage 2 then reads Confirm script and, once approved, Review script. The canvas is that generation flow: click empty canvas space (an empty canvas shows a "click the canvas to start" card in the middle, and a canvas with nodes shows "＋ New flow" in the top-left corner) to open the flow panel, where you can write from script (turn a written or model-generated script into script/storyboard segments with a Frame picture node and a video node per segment, previewing the split first; the text model is picked from the same relay-model dropdown as the video and image models, and gets its own API key field once you turn the shared key off). The toolbar no longer carries a row of node-creation buttons: the first row holds the canvas name plus new-canvas, the edge-ordered "Make <node>" action with a flow progress readout, Chain, Merge film, refresh, tidy layout (re-arranges nodes along the edges without touching content or edges), reset view, export and delete actions, and the second row (Choose canvas) lists every canvas for switching. Pending production nodes are marked with a dashed outline; each step still needs its own plan check and separate cost confirmation. Drag the background to pan, scroll to zoom, drag nodes to move (a multi-selection moves together), Shift+drag to marquee-select and Shift+click to add to the selection, and create a canvas (a name is required and duplicates are refused), rename it by double-clicking its name, delete it after confirmation, duplicate or edit node content, connect or disconnect edges, delete nodes, or export the canvas as JSON. Add your own pictures from the production dialog of a video node with Import image asset (copies the file into the canvas data directory and wires it to that node) or New reference-image node; the same dialog lets you set an upstream asset port to First frame or Reference image, so both "start from a picture" and "generate from references" work; a real-person photo is rejected by the video endpoint, so first turn it into a non-photorealistic 2D animation image with an image node and use that as the first frame. Once every segment has a result, Merge film joins them in edge order into one film you can preview or download right on the canvas; merging only reads existing results, never regenerates anything, costs nothing extra, and names the missing segment when one is not ready. To confirm one whole chain and then generate it segment by segment, use Chain: the plugin first lists what to finish before batch generation (shots confirmed, assets ready, cost to be confirmed per segment), then lists the segments in edge order with their prompt, duration, ratio and resolution and an estimate that covers only what will be generated this time -- segments that already have a result are marked as skipped, never generated or billed again, and the next segment continues from their result; it only starts after you confirm the plan and the cost, and refuses to start at all when every segment already has a result (make that one segment again from its own Make button); each segment stops for your review, and you continue with "Confirm and continue to the next segment" or stop the chain at any time, keeping every finished segment on the canvas. Nodes, edges, reference assets and results are stored in the plugin's own data directory (`~/.dsh/metaontic-video/canvas`). The canvas also runs a health check: production segments with no result yet, asset images not wired to any segment, edges pointing at deleted nodes, and a film whose segment count no longer matches the video results. Problems are summarised on one line under the toolbar and listed in full, with what to do, when you open Chain. The check only reads canvas content — it never touches cost or review, and never edits the canvas itself. Reference-image nodes and imported pictures count as assets, not production segments, and the auto-created Frame nodes follow the flow but are not production segments either, so none of them take up a slot in the "Make <node>" order; while a Frame has no picture yet, the health check reminds you to generate it before making that segment.

Press Make on an image or video node to run the whole step inside the canvas: fill in the content, ratio, duration and resolution, review the plan and estimated cost, then confirm the plan and the cost separately before any model call. Review the result on the canvas and, once approved, extend it into the next segment. Cost and result review stay inside the canvas with no chat round-trip, and API keys stay in MetaOnticVideo. Each video node runs one segment (up to 15 seconds for 2.0 or 30 seconds for 2.5); images currently support one square image per call. Failed publishing can be retried and an unconfirmed task can only be queried, never regenerated. The assistant-based video_canvas workflow remains available for full script creation, and existing script, cost and segment reviews remain required.
