(() => {
  // src/core/settings/client.ts
  function createSettingsPages(h) {
    const pages = /* @__PURE__ */ new Map();
    return {
      register(page) {
        const group = pages.get(page.namespace) || [];
        if (group.some((existing) => existing.id === page.id)) throw new Error(`\u91CD\u590D\u7684\u8BBE\u7F6E\u9875\uFF1A${page.id}`);
        group.push(page);
        pages.set(page.namespace, group);
      },
      mount(ctx) {
        for (const [namespace, group] of pages) {
          const Page = group.length === 1 ? group[0].Page : (props) => h("div", {}, ...group.map((page) => h(page.Page, { ...props, key: page.id })));
          ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
            name: "plugins.bundle.config",
            key: namespace,
            locale: group[0].locale
          }, Page)), `${namespace}: configuration page`);
        }
      }
    };
  }

  // src/client/runtime.ts
  function createClientRuntime(require2, modules) {
    const ids = /* @__PURE__ */ new Set();
    const plugins = modules.map((module) => {
      if (!module.id || ids.has(module.id)) throw new Error(`\u91CD\u590D\u6216\u65E0\u6548\u7684\u754C\u9762\u6A21\u5757\uFF1A${module.id}`);
      ids.add(module.id);
      return module.create(require2);
    });
    return {
      inject: [...new Set(plugins.flatMap((plugin) => plugin.inject || []))],
      apply(ctx) {
        const settings = createSettingsPages(require2("react").createElement);
        for (const plugin of plugins) plugin.apply(ctx, { settings });
        settings.mount(ctx);
      }
    };
  }

  // src/client/auth-notice.ts
  var TOOL_ARGS_JSON = /Tool call[^\n]*JSON|Expected ',' or '\}' after property value|Unexpected (?:token|end of JSON input)/i;
  function createAuthNotice({ h, Original, hostT, t }) {
    return function AuthNotice(props) {
      const data = props.node?.data;
      if (data?.code !== "AUTH") {
        if (typeof data?.message === "string" && TOOL_ARGS_JSON.test(data.message)) {
          return h("div", { role: "status", "data-field": "tool-args-notice", style: { display: "flex", gap: 10, padding: "10px 0", alignItems: "flex-start" } }, [
            h("span", { key: "dot", "aria-hidden": true, style: { flex: "0 0 auto", width: 7, height: 7, marginTop: 6, borderRadius: "50%", background: "var(--dsw-alias-state-error-primary,#d9534f)" } }),
            h("div", { key: "copy", style: { minWidth: 0, fontSize: 13, lineHeight: 1.65, color: "var(--dsw-alias-label-primary,inherit)" } }, [
              h("strong", { key: "title", style: { fontWeight: 500 } }, t("toolArgsNoticeTitle")),
              h("div", { key: "hint", style: { color: "var(--dsw-alias-label-secondary,inherit)" } }, t("toolArgsNoticeHint")),
              h("div", { key: "raw", style: { marginTop: 4, fontSize: 12, color: "var(--dsw-alias-label-caption,inherit)", wordBreak: "break-word" } }, data.message)
            ])
          ]);
        }
        return h(Original, { ...props, t: hostT });
      }
      return h("div", { role: "status", "data-field": "auth-notice", style: { display: "flex", gap: 10, padding: "10px 0", alignItems: "flex-start" } }, [
        h("span", { key: "dot", "aria-hidden": true, style: { flex: "0 0 auto", width: 7, height: 7, marginTop: 6, borderRadius: "50%", background: "var(--dsw-alias-state-error-primary,#d9534f)" } }),
        h("div", { key: "copy", style: { minWidth: 0, fontSize: 13, lineHeight: 1.65, color: "var(--dsw-alias-label-primary,inherit)" } }, [
          h("strong", { key: "title", style: { fontWeight: 500 } }, t("authNoticeTitle")),
          h("div", { key: "hint", style: { color: "var(--dsw-alias-label-secondary,inherit)" } }, t("authNoticeHint")),
          h("a", { key: "support", href: "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18", target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, t("supportContact"))
        ])
      ]);
    };
  }
  function registerAuthNotice(ctx, h, t) {
    if (typeof ctx.slots.entriesOfSlot !== "function") return;
    const original = ctx.slots.entriesOfSlot("conversation.chat.node").filter((entry2) => entry2.options?.key === "turn-error").sort((a, b) => (b.options.priority || 0) - (a.options.priority || 0))[0];
    if (!original?.component) return;
    const Notice = createAuthNotice({ h, Original: original.component, hostT: ctx.locale.bind(original.locale || "chat"), t });
    return ctx.slots.register({ name: "conversation.chat.node", key: "turn-error", priority: (original.options.priority || 0) + 1, locale: "chat" }, Notice);
  }

  // src/businesses/video/client/tool-result.ts
  var SUMMARY_TOOLS = { video_project: "\u811A\u672C\u5BA1\u6838", video_estimate: "\u8D39\u7528\u8BD5\u7B97" };
  var ACTION_LABELS = { prepare: "\u51C6\u5907\u9879\u76EE", review: "\u811A\u672C\u5BA1\u6838", review_segment: "\u5206\u6BB5\u7ED3\u679C\u5BA1\u6838", status: "\u8BFB\u53D6\u9879\u76EE\u72B6\u6001" };
  var STATUS_LABELS = { approved: "\u5DF2\u901A\u8FC7", draft: "\u5F85\u4FEE\u6539", pending: "\u5F85\u786E\u8BA4", blocked: "\u672A\u901A\u8FC7\u6821\u9A8C", running: "\u8FDB\u884C\u4E2D" };
  var CANVAS_SYNC_LABELS = { synced: "\u5DF2\u540C\u6B65", pending: "\u5F85\u8865\u4F20\uFF08\u7528video_canvas\u8865\u4F20\uFF0C\u4E0D\u91CD\u65B0\u751F\u6210\uFF09", unavailable: "\u6682\u4E0D\u53EF\u7528", external: "\u6CBF\u7528\u6240\u9009\u753B\u5E03" };
  var textOf = (block) => (Array.isArray(block?.content) ? block.content : []).filter((part) => part?.type === "text").map((part) => String(part.text || "")).join("\n").trim();
  var money = (value) => Number.isFinite(Number(value)) ? `\xA5${(Math.round(Number(value) * 1e4) / 1e4).toFixed(4)}` : "";
  function parseJson(text) {
    const body = text.trim().replace(/^```[a-zA-Z]*\s*/, "").replace(/```$/, "").trim();
    try {
      const data = JSON.parse(body);
      return data && typeof data === "object" ? data : null;
    } catch {
      return null;
    }
  }
  function toolSummary(toolName, block) {
    const title = SUMMARY_TOOLS[toolName];
    if (!title) return null;
    const raw = textOf(block);
    if (!block || !("kind" in block)) {
      const args = block?.args || {};
      const rows2 = [];
      if (args.action) rows2.push(["\u52A8\u4F5C", ACTION_LABELS[String(args.action)] || String(args.action)]);
      if (args.duration) rows2.push(["\u76EE\u6807\u65F6\u957F", `${Number(args.duration)} \u79D2`]);
      if (args.resolution) rows2.push(["\u6E05\u6670\u5EA6", String(args.resolution).toUpperCase()]);
      return { title, state: "running", stateLabel: "\u8FDB\u884C\u4E2D", rows: rows2, raw: "" };
    }
    if (block.isError) return { title, state: "error", stateLabel: "\u672A\u5B8C\u6210", rows: [], raw };
    const data = parseJson(raw);
    if (!data) return { title, state: "done", stateLabel: "\u5DF2\u5B8C\u6210", rows: [], raw };
    const rows = [];
    const push = (label, value) => {
      if (value !== void 0 && value !== null && String(value) !== "") rows.push([label, String(value)]);
    };
    if (toolName === "video_estimate") {
      push("\u76EE\u6807\u65F6\u957F", data.duration ? `${data.duration} \u79D2` : "");
      push("\u753B\u5E45 / \u6E05\u6670\u5EA6", [data.ratio, data.resolution && String(data.resolution).toUpperCase()].filter(Boolean).join(" \xB7 "));
      push("\u706B\u5C71\u5B98\u65B9\u65B9\u6848", money(data.official?.cny));
      push("\u63D2\u4EF6\u65B9\u6848", money(data.plugin?.cny));
      push("\u4EF7\u76EE\u65E5\u671F", data.priceDate);
      return { title, state: "ok", stateLabel: "\u5DF2\u8BD5\u7B97", rows, raw };
    }
    push("\u72B6\u6001", STATUS_LABELS[String(data.status)] || data.status);
    push("\u9879\u76EE", data.projectId);
    push("\u4E0B\u4E00\u6B65", data.nextAction);
    push("\u8BF4\u660E", data.reason);
    const canvasSync = String(data.canvasProject?.status || "");
    if (canvasSync && canvasSync !== "disabled") push("\u753B\u5E03\u540C\u6B65", CANVAS_SYNC_LABELS[canvasSync] || canvasSync);
    const state = data.status === "approved" ? "ok" : ["draft", "blocked"].includes(String(data.status)) ? "warn" : "done";
    return { title, state, stateLabel: STATUS_LABELS[String(data.status)] || "\u5DF2\u5B8C\u6210", rows, raw };
  }
  var SUMMARY_CSS = `
  .mov-summary { box-sizing: border-box; width: 100%; min-width: 0; margin: 6px 0; padding: 10px 12px; border: 1px solid var(--dsw-alias-border-l2,#dfe3eb); border-radius: 10px; color: inherit; }
  .mov-summary-head { display: flex; align-items: center; gap: 8px; flex-wrap: wrap; }
  .mov-summary-title { font-size: 13px; font-weight: 600; }
  .mov-summary-rows { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: 4px 10px; margin: 8px 0 0; font-size: 12.5px; }
  .mov-summary-key { color: var(--dsw-alias-label-caption,#737b8b); }
  .mov-summary-val { margin: 0; min-width: 0; overflow-wrap: anywhere; white-space: pre-wrap; }
  .mov-summary-raw { margin-top: 8px; font-size: 12px; }
  .mov-summary-raw > summary { color: var(--dsw-alias-label-caption,#737b8b); cursor: pointer; }
  .mov-summary-text { margin-top: 6px; color: var(--dsw-alias-label-caption,#737b8b); line-height: 1.6; white-space: pre-wrap; overflow-wrap: anywhere; }
`;
  function createToolResultView({ h, MediaPreview, VideoTaskProgress }) {
    function summaryView(props) {
      const summary = toolSummary(props?.toolName, props?.block);
      if (!summary) return null;
      const chip = summary.state === "ok" ? "mov-chip mov-chip-ok" : summary.state === "running" ? "mov-chip movc-badge" : "mov-chip mov-chip-bad";
      return h("div", { className: "mov-summary", "data-field": "tool-summary" }, [
        h("style", { key: "style" }, SUMMARY_CSS),
        h("div", { key: "head", className: "mov-summary-head" }, [
          h("span", { key: "title", className: "mov-summary-title" }, summary.title),
          h("span", { key: "state", className: chip }, summary.stateLabel)
        ]),
        summary.rows.length ? h("dl", { key: "rows", className: "mov-summary-rows" }, summary.rows.flatMap(([key, value]) => [
          h("dt", { key: `${key}-key`, className: "mov-summary-key" }, key),
          h("dd", { key: `${key}-value`, className: "mov-summary-val" }, value)
        ])) : null,
        summary.raw ? h("details", { key: "raw", className: "mov-summary-raw" }, [
          h("summary", { key: "label" }, "\u67E5\u770B\u5B8C\u6574\u8FD4\u56DE"),
          h("div", { key: "text", className: "mov-summary-text" }, summary.raw)
        ]) : null
      ]);
    }
    function ToolResultView(props) {
      if (toolSummary(props?.toolName, props?.block)) return summaryView(props);
      if (props.block && "kind" in props.block) return h(MediaPreview, props);
      if (!["video_generate", "video_extend"].includes(props.toolName)) return null;
      return h(VideoTaskProgress, props);
    }
    return { ToolResultView };
  }

  // src/businesses/video/client/media-preview.ts
  function localMediaUrl(file, base) {
    if (typeof file !== "string" || /[\u0000-\u001f\u007f]/.test(file) || !/^(?:\/(?!\/)|[a-z]:[/\\])/i.test(file)) return "";
    if (typeof base !== "string" || !/^https?:/i.test(base) && !base.startsWith("dsh-app://app/")) return "";
    try {
      return new URL(`api/file?path=${encodeURIComponent(file)}`, base).href;
    } catch {
      return "";
    }
  }
  function remoteMediaUrl(value) {
    try {
      const url = new URL(String(value || ""));
      return ["https:", "http:"].includes(url.protocol) && !url.username && !url.password ? url.href : "";
    } catch {
      return "";
    }
  }
  function previewMediaFromBlock(block, toolName) {
    if (!block || !("kind" in block) || block.isError) return [];
    const projected = block.meta?.metaonticMedia;
    if (projected?.version === 1 && Array.isArray(projected.media)) return projected.media.filter((item) => item && ["video", "image"].includes(item.kind)).slice(0, 40);
    const text = (Array.isArray(block.content) ? block.content : []).filter((p) => p.type === "text").map((p) => p.text || "").join("\n");
    const media = [], seen = /* @__PURE__ */ new Set();
    for (const match of text.matchAll(/\[([^\]]*)\]\(\s*(?:<([^>]+)>|([^\s)]+))\s*\)/g)) {
      const source = match[2] || match[3];
      if (seen.has(source)) continue;
      let kind = /\.(png|jpe?g|webp|gif|svg)(?:[?#]|$)/i.test(source) || /图片|参考图/.test(match[1]) || toolName === "video_prepare_image" ? "image" : /\.(mp4|webm|mov|m4v)(?:[?#]|$)/i.test(source) || /视频|第.*段/.test(match[1]) ? "video" : "";
      if (!kind) continue;
      seen.add(source);
      let url = remoteMediaUrl(source);
      let file = "";
      if (!url) {
        try {
          file = decodeURI(source);
        } catch {
          continue;
        }
      }
      media.push({ kind, label: match[1] || (kind === "image" ? "\u56FE\u7247" : "\u89C6\u9891"), ...url ? { url } : { localPath: file } });
      if (media.length >= 40) break;
    }
    return media;
  }
  function createMediaPreview({ React, h }) {
    function MediaItem({ item }) {
      const sources = [...new Set([localMediaUrl(item.localPath, document.baseURI), remoteMediaUrl(item.url)].filter(Boolean))];
      const signature = sources.join("\n");
      const [index, setIndex] = React.useState(0);
      const [failed, setFailed] = React.useState(false);
      const [zoom, setZoom] = React.useState(false);
      const dialog = React.useRef(null);
      React.useEffect(() => {
        setIndex(0);
        setFailed(false);
        setZoom(false);
      }, [signature]);
      React.useEffect(() => {
        if (zoom && dialog.current && !dialog.current.open) dialog.current.showModal();
      }, [zoom]);
      const source = sources[index] || "";
      const error = () => {
        if (index + 1 < sources.length) setIndex(index + 1);
        else setFailed(true);
      };
      const label = String(item.label || (item.kind === "image" ? "\u56FE\u7247" : "\u89C6\u9891"));
      const media = !source || failed ? h("p", { role: "status", className: "mov-media-error" }, item.kind === "image" ? "\u56FE\u7247\u9884\u89C8\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u6587\u4EF6\u53EF\u80FD\u5DF2\u79FB\u52A8\u6216\u94FE\u63A5\u5DF2\u8FC7\u671F\u3002\u8BF7\u5C1D\u8BD5\u6253\u5F00\u539F\u56FE\u3002" : "\u89C6\u9891\u9884\u89C8\u65E0\u6CD5\u64AD\u653E\uFF0C\u53EF\u80FD\u662F\u6587\u4EF6\u5DF2\u79FB\u52A8\u3001\u94FE\u63A5\u5DF2\u8FC7\u671F\u6216\u7F16\u7801\u4E0D\u53D7\u652F\u6301\u3002\u8BF7\u5C1D\u8BD5\u6253\u5F00\u539F\u89C6\u9891\u6216\u4E0B\u8F7D\u540E\u64AD\u653E\u3002") : item.kind === "image" ? h("button", { type: "button", className: "mov-media-image-button", onClick: () => setZoom(true), "aria-label": `\u653E\u5927${label}` }, h("img", { src: source, alt: label, loading: "lazy", onError: error, className: "mov-media-image", referrerPolicy: "no-referrer" })) : h("video", { key: source, src: source, controls: true, playsInline: true, preload: "metadata", onError: error, className: "mov-media-video", "aria-label": label, referrerPolicy: "no-referrer" });
      return h("figure", { className: "mov-media-item", "data-media-kind": item.kind }, [
        h("figcaption", { key: "caption", className: "mov-media-caption" }, label),
        h("div", { key: "body", className: "mov-media-surface" }, media),
        sources.length ? h("div", { key: "links", className: "mov-media-links" }, [
          h("a", { key: "open", href: source || sources[0], target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, item.kind === "image" ? "\u6253\u5F00\u539F\u56FE" : "\u6253\u5F00\u539F\u89C6\u9891"),
          item.localPath && remoteMediaUrl(item.url) ? h("a", { key: "remote", href: remoteMediaUrl(item.url), target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, "\u4E0A\u6E38\u94FE\u63A5") : null
        ]) : null,
        zoom && item.kind === "image" ? h("dialog", { key: "zoom", ref: dialog, className: "mov-media-dialog", "aria-label": label, onCancel: () => setZoom(false), onClose: () => setZoom(false), onClick: (e) => {
          if (e.target === e.currentTarget) setZoom(false);
        } }, [
          h("button", { key: "close", type: "button", className: "mov-media-close", onClick: () => {
            dialog.current?.close();
            setZoom(false);
          }, "aria-label": "\u5173\u95ED\u56FE\u7247\u9884\u89C8" }, "\u5173\u95ED"),
          h("img", { key: "image", src: source, alt: label, className: "mov-media-zoom", referrerPolicy: "no-referrer", onError: error })
        ]) : null
      ]);
    }
    function MediaPreview({ block, toolName }) {
      const items = previewMediaFromBlock(block, toolName);
      const [expanded, setExpanded] = React.useState(false);
      if (!items.length) return null;
      const visible = expanded ? items : items.slice(0, 2);
      return h("section", { className: "mov-media-preview", "aria-label": "\u751F\u6210\u7ED3\u679C\u9884\u89C8", "data-field": "media-preview" }, [
        h("style", { key: "styles" }, `
        .mov-media-preview{margin-top:12px;min-width:0;color:var(--dsw-alias-label-primary,inherit)}
        .mov-media-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(min(100%,300px),1fr));gap:12px;min-width:0}
        .mov-media-item{margin:0;min-width:0;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:10px;overflow:hidden}
        .mov-media-caption{padding:8px 12px;font-size:13px;font-weight:600;overflow-wrap:anywhere}
        .mov-media-surface{min-width:0;background:var(--dsw-specific-input-major,#f5f6f8)}
        .mov-media-image-button{display:block;width:100%;padding:0;border:0;background:transparent;cursor:zoom-in}
        .mov-media-image{display:block;width:100%;max-height:320px;object-fit:contain}
        .mov-media-video{display:block;width:100%;max-height:420px;background:#10131a;object-fit:contain}
        .mov-media-links{display:flex;gap:16px;flex-wrap:wrap;padding:8px 12px;font-size:12px}
        .mov-media-links a{color:var(--dsw-alias-link,#247bbf);text-decoration:underline;overflow-wrap:anywhere}
        .mov-media-error{margin:0;padding:18px 12px;font-size:12px;line-height:1.6;color:var(--dsw-alias-label-caption,#737b8b)}
        .mov-media-more{margin-top:10px;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:6px 10px;background:transparent;color:inherit;cursor:pointer}
        .mov-media-dialog{box-sizing:border-box;max-width:94vw;max-height:94vh;padding:42px 12px 12px;border:0;border-radius:12px;background:var(--dsw-alias-settings-card-fill,#fff);color:inherit}
        .mov-media-dialog::backdrop{background:rgba(0,0,0,.7)}
        .mov-media-zoom{display:block;max-width:calc(94vw - 24px);max-height:calc(94vh - 70px);object-fit:contain}
        .mov-media-close{position:absolute;top:8px;right:10px;background:transparent;color:inherit;border:1px solid var(--dsw-alias-border-l2,#dfe3eb);border-radius:6px;padding:4px 10px;cursor:pointer}
        .mov-media-image-button:focus-visible,.mov-media-more:focus-visible,.mov-media-close:focus-visible{outline:2px solid #247bbf;outline-offset:-2px}
      `),
        h("div", { key: "grid", className: "mov-media-grid" }, visible.map((item) => h(MediaItem, { key: `${item.kind}:${item.localPath || item.url}`, item }))),
        items.length > 2 ? h("button", { key: "more", type: "button", className: "mov-media-more", onClick: () => setExpanded(!expanded), "aria-expanded": expanded }, expanded ? "\u6536\u8D77\u5176\u4ED6\u6210\u679C" : `\u5C55\u5F00\u5176\u4ED6\u6210\u679C\uFF08${items.length - 2}\uFF09`) : null
      ]);
    }
    return { MediaPreview };
  }

  // src/client/theme.ts
  function createTheme() {
    const TOKENS = {
      text: "var(--dsw-alias-label-primary, inherit)",
      muted: "var(--dsw-alias-label-caption, #8886)",
      border: "var(--dsw-alias-border-l2, #8884)",
      cardFill: "var(--dsw-alias-settings-card-fill, transparent)",
      controlFill: "var(--dsw-specific-input-major, transparent)",
      primaryFill: "var(--dsw-alias-button-primary-fill, #247bbf)",
      error: "var(--dsw-alias-state-error-primary, #d9534f)",
      success: "var(--dsw-alias-state-success-primary, #2e9e5b)"
    };
    const inputStyle = { width: "100%", boxSizing: "border-box" };
    const PAGE_CSS = `
      /* \u6574\u9875\u7EB5\u5411\u6392\u5E03\uFF1A\u5757\u4E0E\u5757\u4E4B\u95F4\u7EDF\u4E00 16px\uFF0C\u6BD4\u4E00\u6574\u7247\u8868\u5355\u597D\u626B */
      .mov-page { display: flex; flex-direction: column; gap: 16px; padding: 4px 0; color: ${TOKENS.text}; }
      /* \u5206\u7EC4\u5361\u7247\uFF1A16 \u4E2A\u5B57\u6BB5\u644A\u5728\u4E00\u683C\u91CC\u592A\u7CCA\uFF0C\u6309\u7528\u9014\u5404\u88C5\u4E00\u5F20\u5361 */
      .mov-section { display: flex; flex-direction: column; gap: 14px; padding: 14px 16px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-advanced { display: block; }
      .mov-advanced-toggle { cursor: pointer; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-advanced-toggle .mov-hint { display: block; margin: 5px 0 0 16px; font-weight: 400; }
      .mov-advanced-toggle:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 5px; border-radius: 4px; }
      .mov-advanced-body { display: flex; flex-direction: column; gap: 18px; border-top: 1px solid ${TOKENS.border}; margin-top: 14px; padding-top: 16px; }
      .mov-advanced-body .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 16px 18px; align-items: start; }
      .mov-advanced-body .mov-field-wide { grid-column: auto; }
      .mov-advanced-group { display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .mov-advanced-group + .mov-advanced-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .mov-advanced-group .mov-label { min-height: 30px; display: flex; align-items: flex-end; }
      .mov-advanced-tools .mov-grid { grid-template-columns: minmax(0, 1fr); }
      .mov-advanced-tools .mov-label { min-height: 0; }
      .mov-advanced-group[data-group="advancedPicture"] .mov-grid { grid-template-columns: minmax(0, 1fr); }
      .mov-advanced-group[data-group="advancedPicture"] .mov-switch { justify-content: space-between; flex-direction: row-reverse; }

      @container (max-width: 480px) { .mov-advanced-body .mov-grid { grid-template-columns: minmax(0, 1fr); } .mov-advanced-group .mov-label { min-height: 0; } }
      .mov-advanced { container-type: inline-size; }
      .mov-section-title { display: flex; align-items: center; gap: 8px; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      /* \u6807\u9898\u5DE6\u8FB9\u4E00\u9053\u4E3B\u8272\u7AD6\u6761\uFF0C\u4EE3\u66FF\u7EAF\u6587\u5B57\u5206\u7EC4\u6807\u9898 */
      .mov-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* \u4E24\u5217\u81EA\u9002\u5E94\uFF1A\u5355\u5217\u81F3\u5C11 240px\uFF0C\u7A84\u9762\u677F\u81EA\u52A8\u843D\u6210\u4E00\u5217 */
      .mov-parameter-group { container-type: inline-size; display: flex; flex-direction: column; gap: 12px; min-width: 0; }
      .mov-parameter-group + .mov-parameter-group { border-top: 1px solid ${TOKENS.border}; padding-top: 16px; }
      .mov-parameter-heading { font-size: 12px; font-weight: 600; color: ${TOKENS.muted}; }
      .mov-parameter-group .mov-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); align-items: start; }
      @container (max-width: 480px) { .mov-parameter-group .mov-grid { grid-template-columns: minmax(0, 1fr); } }
      .mov-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 240px), 1fr)); gap: 14px 18px; }
      .mov-field { display: flex; flex-direction: column; min-width: 0; }
      .mov-model-settings { display: flex; flex-direction: column; gap: 14px; min-width: 0; }
      .mov-model-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .mov-model-grid-single { grid-template-columns: minmax(0, 1fr); }
      .mov-model-card { display: flex; flex-direction: column; gap: 14px; padding: 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; min-width: 0; }
      .mov-parameter-group > .mov-card { border: 0; padding: 0; background: transparent; }
      @container (max-width: 600px) { .mov-model-grid { grid-template-columns: minmax(0, 1fr); } }

      .mov-av-grid { display: grid; grid-template-columns: repeat(2, minmax(0, 1fr)); gap: 12px; }
      .mov-av-card { display: flex; flex-direction: column; min-width: 0; padding: 12px; gap: 8px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; }
      .mov-av-card > .mov-label { margin-bottom: -2px; }
      .mov-av-card .mov-hint { margin-top: auto; }
      .mov-av-audio .mov-switch { justify-content: space-between; gap: 12px; padding: 0; border: 0; background: transparent; }
      .mov-av-audio .mov-switch span { order: 0; }
      .mov-av-audio .mov-switch input { appearance: none; order: 1; flex: 0 0 34px; width: 34px; height: 20px; margin: 0; border: 1px solid ${TOKENS.border}; border-radius: 999px; background: ${TOKENS.border}; position: relative; transition: background .15s; }
      .mov-av-audio .mov-switch input::after { content: ''; position: absolute; width: 14px; height: 14px; left: 2px; top: 2px; border-radius: 50%; background: white; transition: transform .15s; }
      .mov-av-audio .mov-switch input:checked { background: ${TOKENS.primaryFill}; border-color: ${TOKENS.primaryFill}; }
      .mov-av-audio .mov-switch input:checked::after { transform: translateX(14px); }
      .mov-av-audio .mov-switch input:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 3px; }
      @container (max-width: 480px) { .mov-av-grid { grid-template-columns: minmax(0, 1fr); } }
      @media (prefers-reduced-motion: reduce) { .mov-av-audio .mov-switch input, .mov-av-audio .mov-switch input::after { transition: none; } }

      /* \u5F00\u5173\u6CA1\u6709\u6807\u7B7E\u884C\uFF0C\u9760\u5E95\u5BF9\u9F50\u624D\u80FD\u8DDF\u65C1\u8FB9\u8F93\u5165\u6846\u7684\u63A7\u5236\u7EBF\u9F50\u5E73 */
      .mov-field-switch { justify-content: flex-end; }
      .mov-field-wide { grid-column: 1 / -1; }
      .mov-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .mov-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .mov-key-control { position: relative; min-width: 0; }
      .mov-key-control .mov-input { padding-right: 40px; }
      .mov-key-eye { position: absolute; right: 4px; top: 50%; transform: translateY(-50%); width: 30px; height: 28px; display: flex; align-items: center; justify-content: center; padding: 0; border: 0; border-radius: 5px; background: transparent; color: ${TOKENS.muted}; cursor: pointer; }
      .mov-key-eye:hover { color: ${TOKENS.text}; background: ${TOKENS.border}; }
      .mov-key-eye:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 1px; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* \u6A21\u578B ID \u4E0E\u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u5F88\u957F\uFF1A\u7B49\u5BBD\u5B57\u4F53 + \u7701\u7565\uFF0C\u4E0D\u628A\u6574\u884C\u6491\u53D8\u5F62 */
      .mov-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* \u5F00\u5173\u505A\u6210\u8DDF\u8F93\u5165\u6846\u540C\u9AD8\u7684\u5C0F\u65B9\u5757\uFF0C\u548C\u5468\u56F4\u63A7\u4EF6\u4E00\u6761\u7EBF */
      .mov-switch { display: flex; align-items: center; gap: 8px; padding: 0 10px; height: 36px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.controlFill}; font-size: 13px; color: ${TOKENS.text}; cursor: pointer; }
      .mov-switch:hover { border-color: ${TOKENS.primaryFill}; }
      .mov-switch input { width: 15px; height: 15px; accent-color: ${TOKENS.primaryFill}; cursor: pointer; }
      .mov-card { display: flex; flex-direction: column; gap: 10px; padding: 14px 16px; border-radius: 12px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.cardFill}; }
      .mov-current-version { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 120px; }
      .mov-update-bell { display: inline-flex; flex: 0 0 auto; color: ${TOKENS.primaryFill}; transform-origin: 50% 10%; animation: mov-bell-swing 1.6s ease-in-out infinite; }
      @keyframes mov-bell-swing { 0%, 60%, 100% { transform: rotate(0deg); } 10%, 30% { transform: rotate(-18deg); } 20%, 40% { transform: rotate(18deg); } 50% { transform: rotate(-8deg); } }
      @media (prefers-reduced-motion: reduce) { .mov-update-bell { animation: none; } }
      .mov-card-head { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-card-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
      .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; flex: 0 0 120px; width: 120px; min-width: 120px; height: 36px; min-height: 36px; padding: 4px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; text-align: center; cursor: pointer; white-space: normal; overflow-wrap: anywhere; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
      .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
      .mov-btn:disabled { opacity: .5; cursor: default; }
      .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
      .mov-btn-primary:hover:not(:disabled) { color: #fff; opacity: .88; }
      .mov-quota-actions { display: flex; gap: 8px; flex: 0 0 auto; }
      .mov-support-dialog { width: min(420px, calc(100vw - 32px)); max-height: calc(100vh - 32px); padding: 0; border: 1px solid ${TOKENS.border}; border-radius: 12px; color: ${TOKENS.text}; background: ${TOKENS.cardFill}; overflow: auto; }
      .mov-support-dialog::backdrop { background: rgba(0, 0, 0, .45); }
      .mov-support-content { padding: 16px; display: flex; flex-direction: column; gap: 12px; }
      .mov-support-content p { margin: 0; }
      .mov-support-frame { width: 100%; height: min(480px, 62vh); border: 0; border-radius: 8px; background: white; }
      .mov-trailing { margin-left: auto; }
      /* \u989D\u5EA6\uFF1A\u4E09\u4E2A\u6570\u5B57\u5757\uFF0C\u4E00\u773C\u5206\u6E05\u5269\u4F59 / \u5DF2\u7528 / \u603B\u989D\u5EA6 */
      .mov-quota-compact { padding: 8px 12px; gap: 10px 14px; flex-direction: row; align-items: center; flex-wrap: wrap; }
      .mov-quota-compact .mov-card-head { min-height: 24px; flex: 0 0 auto; gap: 8px; }
      .mov-quota-compact .mov-stats { display: flex; flex: 1 1 auto; flex-wrap: wrap; gap: 8px 16px; min-width: 0; }
      .mov-quota-compact .mov-stat { flex-direction: row; align-items: baseline; justify-content: space-between; gap: 6px; padding: 0; border: 0; border-radius: 0; white-space: nowrap; }
      .mov-quota-compact .mov-stat-label { font-size: 11px; white-space: nowrap; }
      .mov-quota-compact .mov-stat-value { font-size: 14px; }
      .mov-quota-compact .mov-foot-note { font-size: 10px; white-space: nowrap; flex: 0 0 auto; }
      .mov-stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(120px, 1fr)); gap: 10px; }
      .mov-stat { display: flex; flex-direction: column; gap: 4px; padding: 10px 12px; border-radius: 10px; border: 1px solid ${TOKENS.border}; }
      .mov-stat-label { font-size: 11.5px; color: ${TOKENS.muted}; }
      .mov-stat-value { font-size: 16px; font-weight: 600; font-variant-numeric: tabular-nums; overflow-wrap: anywhere; }
      .mov-foot-note { font-size: 11.5px; color: ${TOKENS.muted}; }
      /* ffmpeg \u5B89\u88C5\u547D\u4EE4\uFF1A\u4E00\u884C\u7B49\u5BBD\u3001\u53EF\u590D\u5236\uFF0C\u4E0D\u7528\u6491\u6EE1\u6574\u884C */
      .mov-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .mov-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* \u4F7F\u7528\u8BB0\u5F55\uFF1A\u6591\u9A6C\u7EB9 + \u7EC6\u8868\u5934\uFF0C\u6A21\u578B\u5217\u5403\u6389\u5269\u4F59\u5BBD\u5EA6 */
      /* \u9762\u677F\u5F88\u7A84\u65F6\u8868\u683C\u6A2A\u5411\u6EDA\u52A8\uFF0C\u4E5F\u4E0D\u628A\u300C\u65F6\u95F4\u300D\u6324\u6210\u4E24\u884C */
      .mov-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .mov-table-head > :nth-child(1), .mov-table-row > :nth-child(1) { white-space: nowrap; }
      .mov-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-radius: 8px; }
      .mov-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .mov-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* \u8D39\u7528\u4E0E\u7ED3\u679C\u4E24\u5217\u53F3\u5BF9\u9F50\uFF0C\u6570\u5B57\u7AD6\u7740\u5BF9\u5F97\u9F50 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4),
      .mov-table-head > :nth-child(5), .mov-table-row > :nth-child(5) { text-align: right; }
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .mov-num { font-variant-numeric: tabular-nums; }
      /* \u7ED3\u679C\u7528\u80F6\u56CA\u6807\u7B7E\uFF0C\u6BD4\u88F8\u6587\u5B57\u66F4\u5BB9\u6613\u4E00\u773C\u626B\u5230 */
      .mov-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .mov-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .mov-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* \u6CE8\u518C\u8868\u5355\uFF1A\u8F93\u5165\u6846\u5403\u6389\u591A\u4F59\u5BBD\u5EA6\uFF0C\u4E24\u4E2A\u6309\u94AE\u4E0D\u6362\u884C */
      .mov-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* \u5E95\u90E8\u64CD\u4F5C\u6761\uFF1A\u4E0A\u8FB9\u7EBF\u628A\u300C\u4FDD\u5B58\u300D\u548C\u914D\u7F6E\u5185\u5BB9\u5206\u5F00 */
      .mov-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .mov-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;
    return { TOKENS, inputStyle, PAGE_CSS };
  }

  // src/businesses/video/client/progress.ts
  function estimatedVideoWait(duration) {
    const seconds = Number(duration);
    return Number.isFinite(seconds) && seconds > 0 ? 105 + seconds * 3 : 180;
  }
  function estimatedVideoProgress(elapsed, duration) {
    const seconds = Math.max(0, Number(elapsed) || 0);
    return Math.min(99, Math.max(1, Math.floor(seconds / estimatedVideoWait(duration) * 100)));
  }
  function activeVideoCalls(chat) {
    const calls = [];
    const seen = /* @__PURE__ */ new Set();
    function visit(block) {
      if (!block)
        return;
      const done = "kind" in block;
      const name = done ? block.call?.name : block.name;
      if (!done && ["video_generate", "video_extend"].includes(name) && !seen.has(block.callId)) {
        seen.add(block.callId);
        calls.push({ block, toolName: name, callId: block.callId });
      }
      for (const child of block.subCalls || [])
        visit(child);
    }
    const nodes = chat?.nodes?.values?.() ?? (chat?.order || []).map((key) => chat.nodes?.get(key));
    for (const node of nodes) {
      if (node?.kind === "tool-call")
        visit(node.data?.root);
    }
    return calls;
  }
  function videoExecutionSource(eventSource) {
    let previous;
    let snapshot = /* @__PURE__ */ new Map();
    return {
      subscribe: (listener) => eventSource.subscribe(listener),
      getSnapshot() {
        const window2 = eventSource.getSnapshot();
        if (window2 === previous)
          return snapshot;
        const next = /* @__PURE__ */ new Map();
        for (const { event } of window2.entries) {
          if (event.type === "plugin:metaontic-video/execution") {
            const { callId, phase } = event.data || {};
            if (typeof callId !== "string")
              continue;
            if (phase === "start")
              next.set(callId, event.time);
            else if (phase === "end")
              next.delete(callId);
          } else if (event.type === "turn/end")
            next.clear();
        }
        previous = window2;
        if (next.size !== snapshot.size || [...next].some(([id, time]) => snapshot.get(id) !== time))
          snapshot = next;
        return snapshot;
      }
    };
  }
  function createVideoProgress({ React, h, TOKENS }) {
    function VideoTaskProgress({ block = {}, toolName = "video_generate", callId, useVideoExecutions, startedAt }) {
      const done = "kind" in block;
      const executions = useVideoExecutions?.((snapshot) => snapshot);
      const beganAt = startedAt ?? executions?.get(callId);
      const [elapsed, setElapsed] = React.useState(0);
      React.useEffect(() => {
        if (done || beganAt === void 0)
          return;
        const tick = () => setElapsed(Math.max(0, Math.floor((Date.now() - beganAt) / 1e3)));
        tick();
        const timer = window.setInterval(tick, 1e3);
        return () => window.clearInterval(timer);
      }, [done, callId, beganAt]);
      if (done)
        return null;
      if (!["video_generate", "video_extend"].includes(toolName) || block.phase !== "start" || beganAt === void 0)
        return null;
      const status = "\u6B63\u5728\u751F\u6210 \xB7 \u7B49\u5F85\u7ED3\u679C";
      const duration = block.args?.duration;
      const estimatedWait = estimatedVideoWait(duration);
      const progress = estimatedVideoProgress(elapsed, duration);
      const waitingDots = ".".repeat(elapsed % 3 + 1);
      const title = toolName === "video_extend" ? "\u89C6\u9891\u7EED\u62CD" : "\u89C6\u9891\u751F\u6210";
      return h("div", { className: "mov-task mov-task-running", "data-field": "video-task-progress" }, [
        h("style", { key: "style" }, `
          @keyframes mov-task-spin { to { transform: rotate(360deg); } }
          @keyframes mov-task-flow { from { background-position:0 0; } to { background-position:32px 0; } }
          @keyframes mov-task-shimmer { from { transform:translateX(-120%); } to { transform:translateX(420%); } }
          @keyframes mov-task-pulse { 0%,100% { opacity:.45; } 50% { opacity:1; } }
          @keyframes mov-task-breath { 0%,100% { border-color:${TOKENS.border}; box-shadow:0 0 0 0 transparent; } 50% { border-color:${TOKENS.primaryFill}; box-shadow:0 0 12px 0 ${TOKENS.primaryFill}; } }
          .mov-task { box-sizing:border-box; min-width:0; width:100%; border:1px solid ${TOKENS.border}; border-radius:10px; padding:10px 12px; color:${TOKENS.text}; margin:6px 0; overflow-wrap:anywhere; }
          .mov-task-running { animation:mov-task-breath 2.4s ease-in-out infinite; }
          .mov-task-head { display:flex; align-items:center; gap:10px; flex-wrap:wrap; font-size:13px; }
          .mov-task-spinner { width:14px; height:14px; border:2px solid ${TOKENS.border}; border-top-color:${TOKENS.primaryFill}; border-radius:50%; animation:mov-task-spin .9s linear infinite; }
          .mov-task-note { font-size:12px; color:${TOKENS.muted}; margin-top:8px; }
          .mov-task-rail { position:relative; margin-top:20px; }
          .mov-task-track { height:5px; border-radius:999px; overflow:hidden; background:${TOKENS.border}; }
          .mov-task-turtle { position:absolute; top:-14px; transform:translateX(-50%) scaleX(-1); font-size:12px; line-height:1; transition:left 1s ease; }
          .mov-task-fill { height:100%; border-radius:999px; background:${TOKENS.primaryFill}; transition:width 1s ease; position:relative; overflow:hidden; }
          .mov-task-active .mov-task-fill { background-image:repeating-linear-gradient(110deg,transparent 0px,transparent 12px,rgba(255,255,255,.22) 12px,rgba(255,255,255,.22) 22px,transparent 22px,transparent 32px); background-size:32px 100%; animation:mov-task-flow 1s linear infinite; }
          .mov-task-active .mov-task-fill::after { content:''; position:absolute; inset:0; width:30%; background:linear-gradient(90deg,transparent,rgba(255,255,255,.6),transparent); animation:mov-task-shimmer 2s linear infinite; }
          .mov-task-live { display:inline-block; width:6px; height:6px; border-radius:50%; background:${TOKENS.primaryFill}; margin-right:6px; animation:mov-task-pulse 1.4s ease-in-out infinite; }
          .mov-task-dots { display:inline-block; width:18px; text-align:left; }
          @media(prefers-reduced-motion:reduce) { .mov-task-spinner, .mov-task-live, .mov-task-active .mov-task-fill, .mov-task-active .mov-task-fill::after { animation:none; } .mov-task-turtle { transition:none; } .mov-task-running { animation:none; } }
        `),
        h("div", { key: "head", className: "mov-task-head" }, [
          h("span", { key: "spinner", className: "mov-task-spinner", "aria-hidden": true }),
          h("strong", { key: "title" }, title),
          h("span", { key: "status", role: "status" }, [status, h("span", { key: "dots", className: "mov-task-dots", "aria-hidden": true }, waitingDots)]),
          h("span", { key: "elapsed", style: { marginLeft: "auto", fontVariantNumeric: "tabular-nums" } }, `\u5DF2\u7B49\u5F85 ${Math.floor(elapsed / 60)}\u5206${String(elapsed % 60).padStart(2, "0")}\u79D2`)
        ]),
        h("div", { key: "progress", className: "mov-task-rail" }, [
          h("div", { className: "mov-task-track mov-task-active", role: "progressbar", "aria-label": "\u4F30\u7B97\u8FDB\u5EA6", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": progress }, h("div", { className: "mov-task-fill", style: { width: `${progress}%` } })),
          // 装饰用的小乌龟：跟着进度条填充的右端一起从左往右爬，只表示「还在忙」，不代表真实进度；屏幕阅读器不读它。
          h("span", { key: "turtle", className: "mov-task-turtle", style: { left: `${progress}%` }, "aria-hidden": true }, "\u{1F422}")
        ]),
        h("div", { key: "percent", className: "mov-task-note" }, `${progress}% \xB7 \u4F30\u7B97\u8FDB\u5EA6`),
        h("div", { key: "note", className: "mov-task-note" }, [
          h("span", { key: "live", className: "mov-task-live", "aria-hidden": true }),
          `${duration ? `\u76EE\u6807 ${duration} \u79D2 \xB7 \u9884\u8BA1\u7B49\u5F85\u7EA6 ${Math.round(estimatedWait)} \u79D2 \xB7 ` : ""}${progress >= 99 ? "\u4EFB\u52A1\u4ECD\u5728\u7B49\u5F85\u7ED3\u679C\uFF0C\u8FDB\u5EA6\u505C\u572899%\u4E0D\u8868\u793A\u5931\u8D25\u3002" : "\u4EFB\u52A1\u5904\u7406\u4E2D\uFF0C\u5B8C\u6210\u540E\u81EA\u52A8\u663E\u793A\u7ED3\u679C\u3002"}\u8BF7\u52FF\u91CD\u590D\u63D0\u4EA4\u3002`
        ])
      ]);
    }
    function VideoProgressDock({ useChat, useVideoExecutions }) {
      const chat = useChat((snapshot) => snapshot);
      const executions = useVideoExecutions?.((snapshot) => snapshot);
      const calls = activeVideoCalls(chat).filter((call) => call.block.phase === "start" && executions?.has(call.callId));
      if (!calls.length)
        return null;
      return h("div", {
        "data-field": "video-progress-dock",
        "aria-live": "polite",
        style: {
          boxSizing: "border-box",
          width: "calc(100% - var(--dsh-composer-side-clearance, 0px) - var(--dsh-composer-side-clearance, 0px))",
          maxWidth: "var(--dsh-composer-card-max-width, 100%)",
          minWidth: 0,
          margin: "0 auto",
          flex: "none"
        }
      }, calls.map((call) => h(VideoTaskProgress, { ...call, startedAt: executions.get(call.callId), key: call.callId })));
    }
    return { videoExecutionSource, VideoTaskProgress, VideoProgressDock };
  }

  // src/core/hardcoded-config.ts
  var PLUGIN_ID = "metaontic-video";
  var PLUGIN_PACKAGE = PLUGIN_ID;
  var PLUGIN_NAMESPACE = PLUGIN_ID;
  var PANEL_ID = PLUGIN_ID;
  var CANVAS_PANEL_ID = `${PLUGIN_ID}-canvas`;
  var GUIDE_URL = "https://ai.mybfs.cn";
  var SUPPORT_URL = "https://work.weixin.qq.com/kfid/kfcd6fc4ca793eeac18";
  var GITEE = {
    slug: "hackloop/metaontic-video",
    web: "https://gitee.com/hackloop/metaontic-video",
    api: "https://gitee.com/api/v5/repos/hackloop/metaontic-video",
    transport: "git@gitee.com:hackloop/metaontic-video.git"
  };
  var GITHUB = {
    slug: "wxsimon2022/metaontic-video",
    web: "https://github.com/wxsimon2022/metaontic-video",
    api: "https://api.github.com/repos/wxsimon2022/metaontic-video",
    transport: "git@ssh.github.com:wxsimon2022/metaontic-video.git"
  };
  var CHANGELOG_URL = `${GITHUB.web}/blob/master/CHANGELOG.md`;
  var UPDATE_SPEC = `git+${GITEE.web}.git`;
  var UPDATE_CACHE_KEY = `${PLUGIN_ID}.update-check-v3`;
  var UPDATE_MAX_AGE_MS = 6 * 60 * 60 * 1e3;
  var UPDATE_ATTEMPTS = 3;
  var releaseArchiveName = (version) => `${PLUGIN_ID}-${version}.tgz`;
  var releaseDownloadUrl = (version, channel = "gitee") => `${(channel === "github" ? GITHUB : GITEE).web}/releases/download/v${version}/${releaseArchiveName(version)}`;
  var RELAY = {
    baseUrl: "https://ai.bileego.com",
    //signupUrl: 'https://ai.bileego.com/sign-up?aff=VzYr',
    signupUrl: "https://ai.bileego.com",
    pricingUrl: "https://ai.bileego.com/pricing",
    submitPath: "/doubao/api/v3/contents/generations/tasks",
    queryPath: "/doubao/api/v3/contents/generations/tasks/{task_id}",
    baseEnv: ["NEWAPI_VIDEO_BASE_URL", "NEWAPI_BASE_URL"],
    modelEnv: ["NEWAPI_VIDEO_MODEL"],
    textModelEnv: ["NEWAPI_TEXT_MODEL"]
  };
  var VOLCENGINE = {
    modeAvailable: false,
    baseUrl: "https://ark.cn-beijing.volces.com",
    submitPath: "/api/v3/contents/generations/tasks",
    queryPath: "/api/v3/contents/generations/tasks/{task_id}",
    pricingUrl: "https://docs.volcengine.com/docs/ark/model-pricing"
  };
  var VIDEO_MODEL = "doubao-seedance-2-0-mini-260615";
  var VIDEO_MODEL_OPTIONS = [
    "doubao-seedance-2-0-mini-260615",
    "doubao-seedance-2-0-fast-260128"
  ];
  var IMAGE_MODEL = "doubao-seedream-5-0-pro-260628";
  var RETIRED_IMAGE_MODELS = ["doubao-seedream-5-0-260128"];
  var TEXT_MODELS = ["deepseek v4.1 flash", "deepseekv4pro"];
  var TEXT_MODEL = TEXT_MODELS[0];
  var RETIRED_TEXT_MODELS = ["doubao-seed-1-6-250615"];
  var REFERENCE_TMP_DIR = `${PLUGIN_ID}-reference`;

  // src/businesses/video/connection-defaults.ts
  var METAONTIC_BASE_URL = RELAY.baseUrl;
  var VOLCENGINE_MODE_AVAILABLE = VOLCENGINE.modeAvailable;
  function resolveImageModel(value) {
    const model = String(value ?? "").trim();
    if (!model || RETIRED_IMAGE_MODELS.includes(model)) return IMAGE_MODEL;
    return model;
  }
  function normalizeTextModel(value) {
    const model = String(value ?? "").trim();
    if (!model || RETIRED_TEXT_MODELS.includes(model)) return TEXT_MODEL;
    return model;
  }
  function connectionDefaults(values) {
    const text = (key, fallback) => String(values[key] ?? "").trim() || fallback;
    const volc = values.connectionMode === "volcengine";
    return {
      ...volc ? { baseUrl: VOLCENGINE.baseUrl } : { baseUrl: text("baseUrl", METAONTIC_BASE_URL).replace(/\/+$/, "") },
      submitPath: volc ? VOLCENGINE.submitPath : text("submitPath", RELAY.submitPath),
      queryPath: volc ? VOLCENGINE.queryPath : text("queryPath", RELAY.queryPath),
      model: text("model", VIDEO_MODEL),
      imageModel: resolveImageModel(text("imageModel", IMAGE_MODEL)),
      textModel: normalizeTextModel(text("textModel", TEXT_MODEL)),
      imageUseVideoKey: values.imageUseVideoKey !== false
    };
  }

  // src/businesses/video/client/config.ts
  function createClientConfig() {
    const NAMESPACE = PLUGIN_NAMESPACE;
    const NS = "settings.metaonticVideo";
    const MODEL_OPTIONS = VIDEO_MODEL_OPTIONS;
    const SELECTS = {
      // MetaOntic AI；火山直连按开关提供。
      connectionMode: VOLCENGINE_MODE_AVAILABLE ? ["metaontic", "volcengine"] : ["metaontic"],
      model: MODEL_OPTIONS,
      // 图片模型只提供在售的 pro 版；旧型号已下线，存量配置由 resolveImageModel 归一到这一项。
      imageModel: [IMAGE_MODEL],
      // 文本模型同样只列中转站当前上架的候选；旧默认值由 normalizeTextModel 归一到第一项。
      textModel: TEXT_MODELS,
      ratio: ["16:9", "9:16", "4:3", "3:4", "1:1", "adaptive"],
      mergeMode: ["copy", "reencode"]
    };
    const SECTIONS = [
      { key: "sectionConnection", fields: ["connectionMode"] },
      { key: "sectionModels", fields: ["imageUseVideoKey", "model", "metaonticApiKey", "volcengineApiKey", "imageModel", "imageApiKey", "textModel", "textApiKey"] },
      { key: "sectionVideo", fields: ["ratio", "generateAudio"] },
      { key: "sectionCanvas", fields: ["canvasEnabled", "autoCreateCanvas"] }
    ];
    const FIELDS = [
      { key: "connectionMode", kind: "select", wide: true },
      { key: "metaonticApiKey", kind: "text", secret: true, wide: true },
      { key: "volcengineApiKey", kind: "text", secret: true, wide: true },
      // 模型用下拉选（候选见 MODEL_OPTIONS），占一整行显示完整型号
      { key: "model", kind: "select", wide: true },
      { key: "imageModel", kind: "select", wide: true },
      // 文本模型（写脚本）：与视频模型同一把密钥，候选见 SELECTS（TEXT_MODELS）
      { key: "textModel", kind: "select", wide: true },
      { key: "imageUseVideoKey", kind: "switch", wide: true },
      { key: "imageApiKey", kind: "text", secret: true, wide: true },
      { key: "textApiKey", kind: "text", secret: true, wide: true },
      { key: "ratio", kind: "select" },
      { key: "generateAudio", kind: "switch" },
      { key: "watermark", kind: "switch" },
      { key: "usageStatsEnabled", kind: "switch" },
      // 流程画布总开关；打开后设置页才显示「自动创建画布」这一项。
      { key: "canvasEnabled", kind: "switch", wide: true },
      { key: "autoCreateCanvas", kind: "switch", wide: true },
      { key: "seamTrimSeconds", kind: "text" },
      { key: "mergeMode", kind: "select", wide: true },
      { key: "pollIntervalMs", kind: "number" },
      { key: "maxWaitMs", kind: "number" },
      { key: "ffmpegBinary", kind: "text", mono: true },
      { key: "ffprobeBinary", kind: "text", mono: true }
    ];
    const FIELD_BY_KEY = Object.fromEntries(FIELDS.map((field) => [field.key, field]));
    const PLUGIN_OWNED_KEYS = [
      "canvasEnabled",
      "autoCreateCanvas",
      "usageStatsEnabled",
      "connectionMode",
      "metaonticApiKey",
      "volcengineApiKey",
      "entryId",
      "baseUrl",
      "submitPath",
      "queryPath",
      "imageUseVideoKey",
      "imageApiKey",
      "imageModel",
      "textModel",
      "textApiKey",
      "model",
      "estimateGroupRatio",
      "duration",
      "singleMaxSeconds",
      "seamTrimSeconds",
      "mergeMode",
      "bgmFadeSeconds",
      "outputDir",
      "keepSegments",
      "resumeLockStaleMinutes",
      "ffmpegBinary",
      "ffprobeBinary",
      "mode",
      "ratio",
      "generateAudio",
      "watermark",
      "extraParams",
      "pollIntervalMs",
      "maxWaitMs",
      "pollErrorRetries"
    ];
    function currentOs() {
      const nav = window.navigator || {};
      const raw = String(
        nav.userAgentData?.platform || nav.platform || nav.userAgent || ""
      ).toLowerCase();
      if (/mac|darwin|iphone|ipad/.test(raw)) return "macos";
      if (/win/.test(raw)) return "windows";
      return "linux";
    }
    function formatMoney(value) {
      const number = Number(value);
      if (!Number.isFinite(number)) return "0";
      const text = number.toFixed(Math.abs(number) >= 1 ? 2 : 4);
      return text.includes(".") ? text.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "") : text;
    }
    function optionLabel(t, key, option) {
      if (key === "connectionMode") return t(option);
      if (key === "mergeMode") {
        if (option === "reencode") return t("mergeModeReencode");
        return option === "copy" ? t("mergeModeCopy") : t("mergeModeSeamless");
      }
      return option;
    }
    return { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE };
  }

  // src/businesses/video/client/locale.ts
  function createDictionaries() {
    const zh = {
      connectionCheckTitle: "API \u8FDE\u63A5\u9A8C\u8BC1",
      connectionCheckButton: "\u9A8C\u8BC1\u8FDE\u63A5",
      connectionChecking: "\u6B63\u5728\u9A8C\u8BC1\u2026",
      connectionCheckSaveFirst: "\u6709\u672A\u4FDD\u5B58\u7684\u4FEE\u6539\uFF0C\u8BF7\u5148\u4FDD\u5B58\u540E\u9A8C\u8BC1\u3002",
      connectionCheckHint: "\u68C0\u67E5\u5DF2\u4FDD\u5B58\u7684\u63A5\u53E3\u3001\u9274\u6743\u54CD\u5E94\u548C\u6A21\u578B\u6E05\u5355\uFF0C\u4E0D\u63D0\u4EA4\u751F\u6210\u4EFB\u52A1\u3001\u4E0D\u4EA7\u751F\u6A21\u578B\u751F\u6210\u8D39\u7528\uFF1B\u901A\u8FC7\u4E0D\u4EE3\u8868\u5B9E\u9645\u751F\u6210\u6548\u679C\u5DF2\u9A8C\u8BC1\u3002",
      connectionCheckFailed: "\u9A8C\u8BC1\u672A\u5B8C\u6210\uFF0C\u8BF7\u786E\u8BA4\u63D2\u4EF6\u670D\u52A1\u53EF\u7528\u540E\u91CD\u8BD5\u3002",
      connectionTarget_video: "\u89C6\u9891\u6A21\u578B",
      connectionTarget_image: "\u56FE\u7247\u6A21\u578B",
      connectionTarget_text: "\u6587\u672C\u6A21\u578B",
      connectionResult_ok: "\u9274\u6743\u63A5\u53E3\u54CD\u5E94\u6B63\u5E38\uFF0C\u5F53\u524D\u6A21\u578B\u5DF2\u5217\u51FA\u3002",
      connectionResult_model_not_listed: "\u63A5\u53E3\u54CD\u5E94\u6B63\u5E38\uFF0C\u4F46\u5F53\u524D\u6A21\u578B\u672A\u5217\u51FA\uFF0C\u8BF7\u6838\u5BF9\u6A21\u578B\u540D\u79F0\u4E0E\u4F7F\u7528\u6743\u9650\u3002",
      connectionResult_key_missing: "\u672A\u586B\u5199\u6B64\u6A21\u578B\u5B9E\u9645\u4F7F\u7528\u7684 API\u5BC6\u94A5\uFF0C\u8BF7\u586B\u5199\u5E76\u4FDD\u5B58\u3002",
      connectionResult_invalid_address: "\u63A5\u53E3\u5730\u5740\u683C\u5F0F\u4E0D\u6B63\u786E\uFF0C\u8BF7\u68C0\u67E5\u5DF2\u4FDD\u5B58\u7684\u5730\u5740\u3002",
      connectionResult_auth_failed: "\u9274\u6743\u672A\u901A\u8FC7\uFF08401\uFF09\uFF0C\u8BF7\u6838\u5BF9 API\u5BC6\u94A5\u53CA\u63A5\u53E3\u5730\u5740\u3002",
      connectionResult_forbidden: "\u8BBF\u95EE\u88AB\u62D2\u7EDD\uFF08403\uFF09\uFF0C\u8BF7\u6838\u5BF9\u5BC6\u94A5\u6743\u9650\u3001\u6E20\u9053\u9650\u5236\u53CA\u5730\u5740\u3002",
      connectionResult_models_unsupported: "\u670D\u52A1\u672A\u63D0\u4F9B\u6A21\u578B\u67E5\u8BE2\u63A5\u53E3\uFF0C\u65E0\u6CD5\u4EC5\u9760\u53EA\u8BFB\u8BF7\u6C42\u786E\u8BA4\u53EF\u7528\u6027\u3002",
      connectionResult_rate_limited: "\u8BF7\u6C42\u53D7\u9650\uFF08429\uFF09\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u5E76\u6838\u5BF9\u6E20\u9053\u9650\u5236\u3002",
      connectionResult_server_error: "\u4E0A\u6E38\u63A5\u53E3\u5F02\u5E38\uFF0C\u8BF7\u6838\u5BF9\u5730\u5740\u6216\u7A0D\u540E\u91CD\u8BD5\u3002",
      connectionResult_invalid_response: "\u8FD4\u56DE\u5185\u5BB9\u4E0D\u662F\u9884\u671F\u7684\u6A21\u578B\u6E05\u5355\uFF0C\u8BF7\u68C0\u67E5\u63A5\u53E3\u5730\u5740\u3002",
      connectionResult_api_rejected: "\u4E0A\u6E38\u62D2\u7EDD\u4E86\u9A8C\u8BC1\u8BF7\u6C42\uFF0C\u8BF7\u6838\u5BF9 API\u5BC6\u94A5\u548C\u5730\u5740\u3002",
      connectionResult_timeout: "\u8FDE\u63A5\u8D85\u65F6\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u548C\u63A5\u53E3\u5730\u5740\u540E\u91CD\u8BD5\u3002",
      connectionResult_network_error: "\u65E0\u6CD5\u8FDE\u63A5\u63A5\u53E3\uFF0C\u8BF7\u68C0\u67E5\u7F51\u7EDC\u3001\u8BC1\u4E66\u6216\u63A5\u53E3\u5730\u5740\u3002",
      connectionResult_query_reachable: "\u67E5\u8BE2\u63A5\u53E3\u5DF2\u54CD\u5E94\uFF1B\u53EA\u8BFB\u63A2\u6D4B\u5C1A\u4E0D\u80FD\u786E\u8BA4\u5F53\u524D\u6A21\u578B\u7684\u751F\u6210\u6743\u9650\u3002",
      connectionResult_query_unverified: "\u53EA\u8BFB\u67E5\u8BE2\u672A\u80FD\u786E\u8BA4\u8FDE\u63A5\uFF0C\u8BF7\u6838\u5BF9\u706B\u5C71\u63A5\u53E3\u914D\u7F6E\u53CA\u6743\u9650\u3002",
      summaryEmpty: "\u8BF7\u9009\u62E9\u63A5\u5165\u65B9\u5F0F\uFF0C\u586B\u5199 API\u5BC6\u94A5\u540E\u4FDD\u5B58\u3002",
      panelTitle: "\u89C6\u9891\u521B\u4F5C",
      panelSidebarLabel: "\u89C6\u9891\u521B\u4F5C\u52A9\u624B",
      sidebarUpdateBadge: "\u6709\u66F4\u65B0",
      panelIntro: "\u5728\u5BF9\u8BDD\u91CC\u8BF4\u6E05\u521B\u610F\u3001\u65F6\u957F\u4E0E\u753B\u5E45\uFF0C\u811A\u672C\u3001\u5206\u955C\u3001\u751F\u6210\u548C\u672C\u673A\u5408\u5E76\u90FD\u7531\u63D2\u4EF6\u5B8C\u6210\u3002",
      panelStart: "\u5F00\u59CB\u521B\u4F5C",
      panelNew: "\u65B0\u5EFA\u89C6\u9891\u521B\u4F5C\u4F1A\u8BDD",
      panelSettings: "\u6253\u5F00\u63D2\u4EF6\u8BBE\u7F6E",
      panelGuide: "\u4F7F\u7528\u8BF4\u660E",
      panelHighlights: "\u4E3A\u4EC0\u4E48\u7528\u5B83",
      panelHighlight1Title: "\u65B0\u624B\u4E5F\u80FD\u4E0A\u624B",
      panelHighlight1Desc: "\u4E0D\u7528\u7814\u7A76\u63D0\u793A\u8BCD\uFF1A\u8BF4\u6E05\u521B\u610F\u3001\u65F6\u957F\u548C\u753B\u5E45\u5C31\u80FD\u5F00\u59CB\uFF0C\u811A\u672C\u3001\u5206\u955C\u3001\u751F\u6210\u548C\u672C\u673A\u5408\u5E76\u90FD\u7531\u52A9\u624B\u5B8C\u6210\u3002",
      panelHighlight2Title: "\u5206\u6BB5\u5236\u4F5C\u957F\u89C6\u9891",
      panelHighlight2Desc: "\u8D85\u8FC7\u5355\u6BB5\u4E0A\u9650\u65F6\u5206\u6BB5\u7EED\u62CD\uFF0C\u6BCF\u6BB5\u9884\u89C8\u786E\u8BA4\u540E\u7EE7\u7EED\uFF0C\u5168\u90E8\u5B8C\u6210\u540E\u5728\u672C\u673A\u5408\u5E76\u3002",
      panelFlow: "\u4F7F\u7528\u6D41\u7A0B",
      panelStep1Title: "\u8BF4\u6E05\u521B\u610F",
      panelStep1Desc: "\u4E3B\u9898\u3001\u65F6\u957F\u3001\u753B\u5E45\uFF0816:9 / 9:16\uFF09\u4E0E\u6E05\u6670\u5EA6\uFF1B\u6CA1\u5199\u753B\u5E45\u65F6\u52A9\u624B\u4F1A\u5148\u95EE\u3002",
      panelStep2Title: "\u811A\u672C\u5206\u955C",
      panelStep2Desc: "\u5148\u51FA\u811A\u672C\u4E0E\u5206\u955C\uFF0C\u4F60\u5BA1\u6838\u786E\u8BA4\u540E\u518D\u7EE7\u7EED\u3002",
      panelStep3Title: "\u9010\u6BB5\u751F\u6210",
      panelStep3Desc: "\u786E\u8BA4\u8D39\u7528\u540E\u751F\u6210\uFF1B\u5206\u6BB5\u9884\u89C8\u786E\u8BA4\u540E\u7EE7\u7EED\u4E0B\u4E00\u6BB5\uFF0C\u652F\u6301\u65AD\u70B9\u7EED\u505A\u3002",
      panelStep4Title: "\u672C\u673A\u5408\u5E76",
      panelStep4Desc: "\u5206\u6BB5\u751F\u6210\u7684\u7ED3\u679C\u5728\u672C\u673A\u5408\u5E76\u6210\u7247\uFF0C\u53EF\u9010\u6BB5\u9884\u89C8\u3002",
      summary: "{provider} \xB7 {model}",
      apiKeyConfigured: "\u5DF2\u914D\u7F6E\uFF0C\u7559\u7A7A\u4FDD\u7559\u73B0\u6709 API\u5BC6\u94A5",
      connectionMode: "\u63A5\u5165\u65B9\u5F0F",
      connectionModeHint: "\u4F7F\u7528\u81EA\u5DF1\u7684 MetaOntic AI API\u5BC6\u94A5\u3002\u5207\u6362\u540E\u4FDD\u5B58\u751F\u6548\u3002",
      connectionVolcengineUnavailable: "\u706B\u5C71\u5F15\u64CE\u76F4\u8FDE\u5F53\u524D\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF1A\u5DF2\u6709\u7684\u914D\u7F6E\u4ECD\u53EF\u7EE7\u7EED\u751F\u6210\uFF1B\u5982\u9700\u66F4\u6362\uFF0C\u8BF7\u5728\u300C\u63A5\u5165\u65B9\u5F0F\u300D\u91CC\u9009\u62E9 MetaOntic AI\u3002",
      connectionMetaonticHint: "\u4F7F\u7528 MetaOntic AI \u7684 API\u5BC6\u94A5\uFF0C\u586B\u5199\u540E\u4FDD\u5B58\u751F\u6548\u3002",
      connectionMetaonticRegister: "\u6CE8\u518C\u83B7\u53D6 API\u5BC6\u94A5",
      volcengineKeyHint: "\u586B\u5199\u706B\u5C71\u65B9\u821F\u63A7\u5236\u53F0\u7684 API\u5BC6\u94A5\u540E\u4FDD\u5B58\uFF0C\u8D39\u7528\u7531\u706B\u5C71\u5F15\u64CE\u8D26\u6237\u627F\u62C5\u3002\u9700\u8981\u81EA\u884C\u6838\u5BF9\u597D API\u5BC6\u94A5\u7684\u6A21\u578B\u80FD\u529B\u3002",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API\u5BC6\u94A5",
      showKey: "\u663E\u793A API\u5BC6\u94A5",
      hideKey: "\u9690\u85CF API\u5BC6\u94A5",
      metaonticKeyHint: "\u586B\u5199 API\u5BC6\u94A5\u540E\u4FDD\u5B58\uFF0C\u65E0\u9700\u90AE\u7BB1\u767B\u5F55\u3002\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF0C\u8D39\u7528\u4E0E\u7528\u91CF\u8BF7\u5728\u6E20\u9053\u5E73\u53F0\u67E5\u770B\u3002",
      volcengineApiKey: "\u706B\u5C71\u5F15\u64CE API\u5BC6\u94A5",
      volcengine: "\u706B\u5C71\u5F15\u64CE\u76F4\u8FDE",
      volcengineUnavailable: "\u706B\u5C71\u5F15\u64CE\u76F4\u8FDE\uFF08\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF09",
      seamTrimSeconds: "\u63A5\u7F1D\u88C1\u526A\u79D2\u6570\uFF08\u5982 0.5,0\uFF09",
      modelHiddenCurrent: "\u5F53\u524D\u6A21\u578B\uFF08\u6682\u4E0D\u63D0\u4F9B\u9009\u62E9\uFF09",
      releaseNotesTitle: "\u66F4\u65B0\u5185\u5BB9",
      releaseUpdatedAt: "{time}",
      resetConfirm: "\u786E\u5B9A\u91CD\u7F6E\u63D2\u4EF6\u5417\uFF1F\u8FD9\u4F1A\u6E05\u9664\u672C\u63D2\u4EF6\u4FDD\u5B58\u7684\u914D\u7F6E\u548CAPI\u5BC6\u94A5\uFF0C\u9700\u8981\u91CD\u65B0\u914D\u7F6E\u3002\u5DF2\u751F\u6210\u7684\u89C6\u9891\u4E0D\u4F1A\u5220\u9664\u3002",
      model: "\u89C6\u9891\u6A21\u578B",
      imageModel: "\u56FE\u7247\u6A21\u578B",
      textModel: "\u6587\u672C\u6A21\u578B\uFF08\u5199\u811A\u672C\uFF09",
      imageUseVideoKey: "\u89C6\u9891 / \u56FE\u7247 / \u6587\u672C\u6A21\u578B\u5171\u7528 API\u5BC6\u94A5",
      sharedModelKey: "\u5171\u7528 API\u5BC6\u94A5",
      videoModelKey: "\u89C6\u9891\u6A21\u578B API\u5BC6\u94A5",
      imageApiKey: "\u56FE\u7247\u6A21\u578B API\u5BC6\u94A5",
      textApiKey: "\u6587\u672C\u6A21\u578B API\u5BC6\u94A5",
      resolution: "\u89C6\u9891\u6E05\u6670\u5EA6",
      imageModelHint: "Seedream\u53EF\u751F\u6210\u89D2\u8272\u56FE\uFF1B\u9047\u771F\u4EBA\u9650\u5236\u65F6\uFF0C\u7ECF\u540C\u610F\u53EF\u8F6C\u6362\u53C2\u8003\u56FE\u3002\u56FE\u7247\u8C03\u7528\u5355\u72EC\u8BA1\u8D39\uFF0C\u7ED3\u679C\u9700\u5BA1\u6838\u3002",
      textModelHint: "\u753B\u5E03\u300C\u521B\u4F5C\u6D41\u7A0B\u300D\u91CC\u7528\u8FD9\u4E2A\u578B\u53F7\u628A\u4E00\u6BB5\u60F3\u6CD5\u5199\u6210\u5267\u672C\u4E0E\u5206\u955C\u8868\uFF1B\u8D70\u540C\u4E00\u4E2D\u8F6C\u7AD9\u7684 /v1/chat/completions\uFF0C\u5355\u72EC\u6309\u6587\u672C\u8BA1\u8D39\u3002\u5019\u9009\u4E0E\u4E2D\u8F6C\u7AD9\u5728\u552E\u7684\u6587\u672C\u6A21\u578B\u4E00\u81F4\uFF0C\u65E7\u7684\u9ED8\u8BA4\u578B\u53F7\u5DF2\u4E0B\u7EBF\uFF0C\u8BFB\u5230\u4F1A\u81EA\u52A8\u6362\u6210\u9ED8\u8BA4\u9879\u3002",
      modelHint: "mini \u4FA7\u91CD\u6210\u672C\uFF0Cfast \u4FA7\u91CD\u751F\u6210\u901F\u5EA6\u3002\u5B9E\u9645\u4EF7\u683C\u4EE5\u6240\u9009\u6E20\u9053\u4E3A\u51C6\u3002",
      mergeMode: "\u5408\u5E76\u65B9\u5F0F",
      mergeModeSeamless: "\u76F4\u63A5\u62FC\u63A5\uFF08\u65E7\u914D\u7F6E\u517C\u5BB9\uFF09",
      mergeModeCopy: "\u65E0\u635F\u62FC\u63A5",
      mergeModeReencode: "\u91CD\u7F16\u7801\u62FC\u63A5",
      ffmpegBinary: "ffmpeg \u8DEF\u5F84",
      ffprobeBinary: "ffprobe \u8DEF\u5F84",
      ffmpegTitle: "\u957F\u89C6\u9891\u5408\u5E76\u9700\u8981 ffmpeg",
      ffmpegBody: "\u89C6\u9891\u8D85\u8FC7\u6A21\u578B\u5355\u6B21\u4E0A\u9650\uFF082.0 \u4E3A 15 \u79D2\u30012.5 \u4E3A 30 \u79D2\uFF09\u65F6\u4F1A\u62C6\u6210\u51E0\u6BB5\u5206\u522B\u751F\u6210\u3001\u518D\u5728\u672C\u673A\u5408\u5E76\u6210\u4E00\u6761\u2014\u2014\u5408\u5E76\u8FD9\u4E00\u6B65\u7528\u7684\u662F ffmpeg\u3002\u9ED8\u8BA4\u5408\u5E76\u524D\u4F1A\u68C0\u67E5\u662F\u5426\u5B89\u88C5\uFF1B\u660E\u786E\u9009\u62E9\u53EA\u751F\u6210\u5206\u6BB5\u65F6\u53EF\u4E0D\u5408\u5E76\u3002",
      ffmpegInstallFor: "\u6309\u4F60\u7684\u7CFB\u7EDF\u88C5\u4E00\u4E0B\uFF08\u70B9\u53F3\u8FB9\u6309\u94AE\u590D\u5236\u547D\u4EE4\uFF09\uFF1A",
      ffmpegCopy: "\u590D\u5236",
      ffmpegCopied: "\u5DF2\u590D\u5236",
      ffmpegMore: "\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegLess: "\u6536\u8D77\u5176\u4ED6\u7CFB\u7EDF",
      ffmpegAfter: "\u4E0D\u60F3\u81EA\u5DF1\u6572\u547D\u4EE4\u7684\u8BDD\uFF0C\u76F4\u63A5\u5728\u5BF9\u8BDD\u91CC\u8BF4\u300C\u5E2E\u6211\u88C5 ffmpeg\u300D\u2014\u2014\u63D2\u4EF6\u4F1A\u6267\u884C\u5B89\u88C5\uFF08\u547D\u4EE4\u4F1A\u5148\u8BA9\u4F60\u786E\u8BA4\uFF09\uFF1B\u88C5\u597D\u540E\u7528\u539F\u6682\u505C\u8FDB\u5EA6\u91CD\u8BD5\u4E0B\u8F7D\u6216\u5408\u5E76\uFF0C\u4E0D\u91CD\u65B0\u63D0\u4EA4\u89C6\u9891\u751F\u6210\u3002ffmpeg \u88C5\u5728\u975E\u9ED8\u8BA4\u4F4D\u7F6E\u7684\u8BDD\uFF0C\u628A\u7EDD\u5BF9\u8DEF\u5F84\u586B\u5230\u4E0A\u9762\u7684\u300Cffmpeg \u8DEF\u5F84\u300D\u4E5F\u4E00\u6837\u7BA1\u7528\u3002\u5B89\u88C5\u5305\u81EA\u5E26 ffprobe\uFF0C\u5206\u6BB5\u65F6\u957F\u63A2\u6D4B\u4F1A\u4E00\u8D77\u89E3\u51B3\u3002",
      ffmpegManual: "\u60F3\u81EA\u5DF1\u88C5\uFF1AmacOS \u7528 Homebrew\uFF0CWindows \u7528 winget\uFF0CLinux \u7528\u7CFB\u7EDF\u5305\u7BA1\u7406\u5668\uFF1B\u88C5\u5B8C\u786E\u8BA4\u547D\u4EE4\u884C\u91CC\u80FD\u8DD1 ffmpeg -version \u5C31\u884C\u3002",
      supportContact: "\u5BA2\u670D",
      advancedStats: "\u4F7F\u7528\u7EDF\u8BA1",
      usageStatsEnabled: "\u533F\u540D\u4F7F\u7528\u7EDF\u8BA1",
      usageStatsHint: "\u7528\u4E8E\u7EDF\u8BA1\u9996\u6B21\u542F\u7528\u3001\u542F\u52A8\u548C\u529F\u80FD\u4F7F\u7528\u60C5\u51B5\uFF0C\u4EC5\u4E0A\u62A5\u533F\u540D\u6807\u8BC6\u3001\u7248\u672C\u3001\u57FA\u7840\u8BBE\u5907\u4FE1\u606F\u4E0E\u8C03\u7528\u7ED3\u679C\uFF0C\u4E0D\u542B\u5BF9\u8BDD\u3001\u7D20\u6750\u6216API\u5BC6\u94A5\u3002\u5173\u95ED\u4E0D\u5F71\u54CD\u89C6\u9891\u521B\u4F5C\u3002",
      toolArgsNoticeTitle: "\u8FD9\u4E00\u8F6E\u52A9\u624B\u628A\u5DE5\u5177\u53C2\u6570\u5199\u6210\u4E86\u4E0D\u5408\u6CD5\u7684 JSON",
      toolArgsNoticeHint: "\u591A\u534A\u662F 480p\u300116:9 \u8FD9\u7C7B\u503C\u5C11\u4E86\u5F15\u53F7\uFF0C\u672C\u8F6E\u6CA1\u6709\u771F\u6B63\u8C03\u7528\u5DE5\u5177\u3001\u4E5F\u6CA1\u6709\u4EA7\u751F\u8D39\u7528\uFF1B\u56DE\u4E00\u53E5\u300C\u6309\u539F\u53C2\u6570\u91CD\u8BD5\u300D\u5373\u53EF\uFF0C\u52A9\u624B\u4F1A\u8865\u9F50\u5F15\u53F7\u6309\u539F\u6765\u7684\u6E05\u6670\u5EA6\u3001\u753B\u5E45\u548C\u65F6\u957F\u91CD\u53D1\u3002",
      authNoticeTitle: "\u670D\u52A1\u8FDE\u63A5\u9A8C\u8BC1\u672A\u901A\u8FC7",
      authNoticeHint: "\u8BF7\u5230 Harness \u7684\u6A21\u578B\u8BBE\u7F6E\u68C0\u67E5\u5F53\u524D API\u5BC6\u94A5\u548C\u4E2D\u8F6C\u5730\u5740\uFF1B\u5982\u679C\u914D\u7F6E\u65E0\u8BEF\uFF0C\u8BF7\u8054\u7CFB\u5BA2\u670D\u6838\u67E5\u3002",
      supportClose: "\u5173\u95ED",
      supportScan: "\u8BF7\u6309\u9875\u9762\u63D0\u793A\u4F7F\u7528\u5FAE\u4FE1\u8054\u7CFB\u5BA2\u670D\uFF0C\u54A8\u8BE2\u4F7F\u7528\u6216\u63A5\u5165\u95EE\u9898\u3002\u9875\u9762\u672A\u52A0\u8F7D\u65F6\u53EF\u70B9\u51FB\u4E0B\u65B9\u94FE\u63A5\u3002",
      supportOpenPage: "\u6253\u5F00\u5BA2\u670D\u9875\u9762",
      versionTitle: "\u63D2\u4EF6\u7248\u672C",
      versionCurrent: "\u5F53\u524D\u7248\u672C v{version}",
      versionCheck: "\u68C0\u67E5\u66F4\u65B0",
      versionChecking: "\u68C0\u67E5\u4E2D\u2026",
      versionLatest: "\u5DF2\u662F\u6700\u65B0\u7248\u672C",
      versionNew: "\u6709\u65B0\u7248\u672C v{version}",
      versionFailed: "\u68C0\u67E5\u66F4\u65B0\u5931\u8D25\uFF1A{message}",
      versionUpdate: "\u7ACB\u5373\u66F4\u65B0",
      versionOptional: "\u8FD9\u662F\u666E\u901A\u66F4\u65B0\uFF0C\u4F60\u53EF\u4EE5\u81EA\u884C\u51B3\u5B9A\u662F\u5426\u5347\u7EA7\u3002\u7A0D\u540E\u5904\u7406\u4E0D\u5F71\u54CD\u7EE7\u7EED\u4F7F\u7528\uFF0C\u63D2\u4EF6\u4E0D\u4F1A\u81EA\u52A8\u5B89\u88C5\u3002",
      versionLater: "\u7A0D\u540E\u518D\u8BF4",
      versionUpdateConfirm: "\u786E\u8BA4\u66F4\u65B0\u5230 v{version}",
      versionUpdateConfirmHint: "\u66F4\u65B0\u671F\u95F4\u8BBE\u7F6E\u9875\u53EF\u80FD\u77ED\u6682\u5173\u95ED\uFF0C\u73B0\u6709\u914D\u7F6E\u4E0E API\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionUpdating: "\u66F4\u65B0\u4E2D\u2026",
      versionUpdateDone: "\u5DF2\u66F4\u65B0\u5230 v{version}\uFF0C\u5DF2\u901A\u8FC7\u70ED\u52A0\u8F7D\u751F\u6548\uFF0C\u65E0\u9700\u91CD\u542F\u3002\u73B0\u6709\u5BF9\u8BDD\u4E0B\u4E00\u8F6E\u4F7F\u7528\u6700\u65B0\u63D2\u4EF6\u89C4\u5219\u3002",
      versionUpdatePending: "v{version} \u5DF2\u5B89\u88C5\uFF0C\u5F53\u524D\u914D\u7F6E\u5C1A\u672A\u542F\u7528\u65B0\u7248\uFF0C\u8BF7\u5728\u63D2\u4EF6\u9875\u68C0\u67E5\u542F\u7528\u72B6\u6001\u3002",
      versionUpdateRestart: "\u65B0\u7248\u672C v{version} \u5DF2\u88C5\u597D\uFF1A\u91CD\u542F Harness \u540E\u751F\u6548\u3002",
      versionUpdateCancelled: "\u66F4\u65B0\u5DF2\u53D6\u6D88\u3002",
      versionUpdateRetry: "\u66F4\u65B0\u672A\u5B8C\u6210\uFF0C\u6B63\u5728\u91CD\u8BD5\uFF08{attempt}/{total}\uFF09\u2026",
      versionUpdateFailed: "\u5728\u7EBF\u66F4\u65B0\u5931\u8D25\uFF1A{message}",
      versionUpdateRemoved: "\u672A\u80FD\u786E\u8BA4\u63D2\u4EF6\u5B89\u88C5\u72B6\u6001\uFF0C\u8BF7\u5230\u300C\u63D2\u4EF6\u300D\u9875\u68C0\u67E5\uFF1B\u4FDD\u7559\u73B0\u6709\u914D\u7F6E\uFF0C\u4E0D\u8981\u76F4\u63A5\u5378\u8F7D\u3002",
      versionUpdateRateLimited: "Gitee \u8BF7\u6C42\u8FC7\u4E8E\u9891\u7E41\uFF0C\u8BF7\u7A0D\u540E\u91CD\u8BD5\u3002\u73B0\u6709\u914D\u7F6E\u4E0E API\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionUpdateLockfile: "\u5B89\u88C5\u76EE\u5F55\u7684 pnpm-lock.yaml \u91CC\u6709\u672C\u63D2\u4EF6\u7F3A\u5C11 integrity \u7684\u65E7\u8BB0\u5F55\uFF0Cpnpm \u56E0\u6B64\u62D2\u7EDD\u5B89\u88C5\uFF08ERR_PNPM_MISSING_TARBALL_INTEGRITY\uFF09\u3002\u63D2\u4EF6\u4F1A\u6BCF 2 \u79D2\u68C0\u67E5\u4E00\u6B21\u3001\u81EA\u52A8\u6E05\u7406\u8FD9\u4E9B\u65E0\u6548\u8BB0\u5F55\u5E76\u4FDD\u7559\u5907\u4EFD\uFF0C\u66F4\u65B0\u5931\u8D25\u540E\u4E5F\u4F1A\u7B49\u6E05\u7406\u5B8C\u6210\u81EA\u52A8\u91CD\u8BD5\uFF1B\u82E5\u4ECD\u7136\u5931\u8D25\uFF0C\u5B8C\u5168\u9000\u51FA Harness \u540E\u624B\u52A8\u5220\u9664\u63D2\u4EF6\u5B89\u88C5\u76EE\u5F55\u4E0B\u7684 pnpm-lock.yaml \u518D\u8BD5\u3002",
      versionUpdateUnavailable: "\u5F53\u524D Harness \u4E0D\u652F\u6301\u6B64\u5728\u7EBF\u66F4\u65B0\u5165\u53E3\uFF0C\u8BF7\u4FDD\u7559\u73B0\u6709\u63D2\u4EF6\u4E0E\u914D\u7F6E\uFF0C\u53C2\u8003\u4F7F\u7528\u8BF4\u660E\u901A\u8FC7\u6B63\u5F0F\u7248\u6210\u54C1\u5305\u66F4\u65B0\u3002",
      versionHint: "\u53EF\u5728\u6B64\u68C0\u67E5\u5E76\u5B89\u88C5\u65B0\u7248\u672C\uFF0C\u73B0\u6709\u914D\u7F6E\u4E0E API\u5BC6\u94A5\u4F1A\u4FDD\u7559\u3002",
      versionCheckedAt: "\u68C0\u67E5\u4E8E {time}",
      sectionGeneration: "\u751F\u6210\u53C2\u6570",
      sectionConnection: "\u63A5\u5165\u4E0E API\u5BC6\u94A5",
      sectionVideo: "\u753B\u9762\u4E0E\u58F0\u97F3",
      sectionCanvas: "\u6D41\u7A0B\u753B\u5E03",
      canvasPanelLabel: "MetaOnticVideo\u6D41\u7A0B\u753B\u5E03",
      canvasEnabled: "\u6D41\u7A0B\u753B\u5E03",
      canvasEnabledHint: "\u9ED8\u8BA4\u5173\u95ED\uFF1A\u5173\u95ED\u65F6\u5DE6\u4FA7\u680F\u4E0D\u51FA\u73B0\u300CMetaOnticVideo\u6D41\u7A0B\u753B\u5E03\u300D\u5165\u53E3\uFF0C\u753B\u5E03\u4E0D\u53EF\u7528\uFF1B\u5DF2\u6709\u753B\u5E03\u4E0E\u6210\u679C\u4ECD\u4FDD\u7559\u5728\u63D2\u4EF6\u6570\u636E\u76EE\u5F55\uFF0C\u91CD\u65B0\u6253\u5F00\u5C31\u80FD\u7EE7\u7EED\u3002\u5F00\u542F\u540E\u5DE6\u4FA7\u680F\u51FA\u73B0\u6D41\u7A0B\u753B\u5E03\u5165\u53E3\uFF0C\u53EF\u7528\u72EC\u7ACB\u753B\u5E03\u9875\u521B\u4F5C\u3002\u6D41\u7A0B\u753B\u5E03\u662F\u672C\u63D2\u4EF6\u81EA\u5E26\u7EC4\u4EF6\uFF0C\u4E0D\u9700\u8981\u5B89\u88C5\u5176\u4ED6\u753B\u5E03\u63D2\u4EF6\u3002",
      autoCreateCanvas: "\u81EA\u52A8\u521B\u5EFA\u753B\u5E03",
      autoCreateCanvasHint: "\u6D41\u7A0B\u753B\u5E03\u6253\u5F00\u540E\u6709\u6548\uFF0C\u9ED8\u8BA4\u5F00\u542F\uFF1A\u521B\u4F5C\u65F6\u81EA\u52A8\u5EFA\u56FE\uFF0C\u5BA1\u6838\u524D\u540C\u6B65\u5267\u672C\u3001\u5206\u955C\u548C\u5236\u4F5C\u8BA1\u5212\uFF0C\u751F\u6210\u540E\u56DE\u586B\u6210\u679C\uFF1B\u5173\u95ED\u540E\u4E0D\u81EA\u52A8\u5EFA\u56FE\uFF0C\u4EC5\u5728\u753B\u5E03\u5185\u660E\u786E\u9009\u4E2D\u8282\u70B9\u65F6\u8054\u52A8\u3002",
      sectionModels: "\u6A21\u578B\u914D\u7F6E",
      sectionCombined: "\u66F4\u591A\u8BBE\u7F6E",
      advancedPicture: "\u753B\u9762",
      advancedMerge: "\u89C6\u9891\u5408\u5E76",
      advancedWait: "\u67E5\u8BE2\u4E0E\u7B49\u5F85",
      advancedTools: "\u672C\u5730\u5DE5\u5177",
      sectionCombinedHint: "\u753B\u9762 \xB7 \u5408\u5E76 \xB7 \u7B49\u5F85 \xB7 \u672C\u5730\u5DE5\u5177",
      toolsHint: "\u901A\u5E38\u65E0\u9700\u586B\u5199\uFF1B\u5DF2\u5B89\u88C5\u4F46\u65E0\u6CD5\u81EA\u52A8\u8BC6\u522B\u65F6\uFF0C\u53EF\u6307\u5B9A\u53EF\u6267\u884C\u6587\u4EF6\u8DEF\u5F84\u3002",
      segmentsRetained: "\u6240\u6709\u539F\u59CB\u5206\u6BB5\u81EA\u52A8\u4FDD\u7559\uFF0C\u4FBF\u4E8E\u9884\u89C8\u3001\u7EED\u505A\u548C\u91CD\u65B0\u526A\u8F91\u3002",
      ratio: "\u753B\u9762\u6BD4\u4F8B",
      audioSettings: "\u58F0\u97F3\u8BBE\u7F6E",
      ratioLayoutHint: "\u9009\u62E9\u6A2A\u5C4F\u3001\u7AD6\u5C4F\u6216\u81EA\u52A8\u9002\u914D\u753B\u9762\u3002",
      audioLayoutHint: "\u5BF9\u767D\u3001\u97F3\u4E50\u4E0E\u73AF\u5883\u58F0\u6309\u811A\u672C\u5B89\u6392\u3002",
      generateAudio: "\u751F\u6210\u97F3\u9891",
      watermark: "\u6DFB\u52A0\u6C34\u5370",
      pollIntervalMs: "\u72B6\u6001\u67E5\u8BE2\u95F4\u9694\uFF08\u79D2\uFF09",
      maxWaitMs: "\u5355\u4E2A\u4EFB\u52A1\u6700\u957F\u7B49\u5F85\u65F6\u95F4\uFF08\u79D2\uFF09",
      save: "\u4FDD\u5B58",
      reset: "\u91CD\u7F6E\u63D2\u4EF6",
      resetHint: "\u6E05\u9664\u672C\u673A\u4FDD\u5B58\u7684 API\u5BC6\u94A5\u4E0E\u81EA\u5B9A\u4E49\u8BBE\u7F6E\uFF0C\u6062\u590D\u9ED8\u8BA4\u914D\u7F6E\u3002",
      saving: "\u4FDD\u5B58\u4E2D\u2026",
      saved: "\u8BBE\u7F6E\u5DF2\u4FDD\u5B58\uFF0C\u914D\u7F6E\u91CD\u65B0\u52A0\u8F7D\u540E\u751F\u6548\u3002",
      saveFailed: "\u4FDD\u5B58\u5931\u8D25\uFF0C\u8BF7\u68C0\u67E5\u8BBE\u7F6E\u540E\u91CD\u8BD5\u3002",
      dirty: "\u6709\u672A\u4FDD\u5B58\u7684\u6539\u52A8",
      loading: "\u8BFB\u53D6\u914D\u7F6E\u4E2D\u2026",
      unavailable: "\u6682\u65F6\u65E0\u6CD5\u52A0\u8F7D\u63D2\u4EF6\u8BBE\u7F6E\uFF0C\u8BF7\u91CD\u542F Harness \u540E\u91CD\u8BD5\uFF1B\u82E5\u4ECD\u65E0\u6CD5\u52A0\u8F7D\uFF0C\u8BF7\u68C0\u67E5 Harness \u4E0E\u63D2\u4EF6\u7684\u7248\u672C\u662F\u5426\u517C\u5BB9\u3002",
      readOnly: "\u5F53\u524D\u914D\u7F6E\u4E3A\u53EA\u8BFB\uFF0C\u65E0\u6CD5\u4FDD\u5B58\u4FEE\u6539\u3002",
      seamTrimSecondsHint: "\u5206\u522B\u88C1\u526A\u7B2C 2\u30013\u2026\u6BB5\u5F00\u5934\uFF0C\u4F8B\u5982 0.5,0\u3002\u7559\u7A7A\u4F7F\u7528\u6A21\u578B\u9ED8\u8BA4\u503C\uFF0C\u586B 0 \u5173\u95ED\uFF1B\u6BCF\u9879\u4E3A 0\u20133 \u79D2\u3002",
      waitSecondsHint: "\u81F3\u5C11 1 \u79D2\uFF0C\u652F\u6301\u5C0F\u6570\u3002\u6700\u957F\u7B49\u5F85\u65F6\u95F4\u4E0D\u5F97\u5C0F\u4E8E\u67E5\u8BE2\u95F4\u9694\u3002",
      versionHistory: "\u5386\u53F2\u66F4\u65B0",
      versionCheckFirst: "\u8BF7\u5148\u68C0\u67E5\u5E76\u9009\u62E9\u53EF\u7528\u7684\u6B63\u5F0F\u7248\u672C\uFF0C\u518D\u786E\u8BA4\u5B89\u88C5\u3002",
      unknownConnection: "\u672A\u77E5\u63A5\u5165\u65B9\u5F0F\uFF0C\u8BF7\u91CD\u65B0\u9009\u62E9\u3002",
      atomicUnsupported: "\u5F53\u524D Harness \u4E0D\u652F\u6301\u6279\u91CF\u4FDD\u5B58\uFF0C\u8BF7\u66F4\u65B0 Harness \u540E\u91CD\u8BD5\u3002",
      atomicRejected: "\u8F6F\u4EF6\u672A\u63A5\u53D7\u672C\u6B21\u4FDD\u5B58\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u6838\u5BF9\u540E\u91CD\u8BD5\u3002",
      settingsUnavailable: "\u8BBE\u7F6E\u9875\u6B63\u5728\u52A0\u8F7D\u6216\u5DF2\u66F4\u65B0\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\u3002\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u540E\u91CD\u8BD5\u3002",
      settingsConflict: "\u914D\u7F6E\u540C\u65F6\u88AB\u5176\u4ED6\u64CD\u4F5C\u4FEE\u6539\uFF0C\u8F93\u5165\u5DF2\u4FDD\u7559\u3002\u8BF7\u6838\u5BF9\u6700\u65B0\u8BBE\u7F6E\u540E\u91CD\u8BD5\u3002",
      settingsTransport: "\u4FDD\u5B58\u8FDE\u63A5\u4E2D\u65AD\uFF0C\u7ED3\u679C\u5C1A\u672A\u786E\u8BA4\u3002\u8F93\u5165\u5DF2\u4FDD\u7559\uFF0C\u8BF7\u91CD\u65B0\u6253\u5F00\u8BBE\u7F6E\u9875\u6838\u5BF9\u540E\u518D\u4FDD\u5B58\u3002",
      invalidWait: "\u7B49\u5F85\u65F6\u95F4\u987B\u4E3A\u81F3\u5C11 1 \u79D2\u7684\u6709\u6548\u6570\u503C\uFF0C\u4E14\u6700\u957F\u7B49\u5F85\u65F6\u95F4\u4E0D\u5F97\u5C0F\u4E8E\u67E5\u8BE2\u95F4\u9694\u3002",
      invalidSeam: "\u63A5\u7F1D\u88C1\u526A\u987B\u4E3A\u9017\u53F7\u5206\u9694\u7684 0\u20133 \u79D2\u6570\u503C\uFF0C\u4F8B\u5982 0.5,0\u3002",
      resetDone: "\u5DF2\u6E05\u9664\u672C\u673A\u914D\u7F6E\uFF0C\u6062\u590D\u9ED8\u8BA4\u8BBE\u7F6E\u3002",
      resetFailed: "\u91CD\u7F6E\u5931\u8D25\uFF1A{message}"
    };
    const en = {
      connectionCheckTitle: "API connection check",
      connectionCheckButton: "Check connection",
      connectionChecking: "Checking\u2026",
      connectionCheckSaveFirst: "Save your changes before checking.",
      connectionCheckHint: "Checks saved endpoints, authentication responses and model listings without submitting generation tasks or incurring model generation charges. Success does not verify generation quality.",
      connectionCheckFailed: "Check could not finish. Confirm the plugin service is available and retry.",
      connectionTarget_video: "Video model",
      connectionTarget_image: "Image model",
      connectionTarget_text: "Text model",
      connectionResult_ok: "Authentication endpoint responded and the model is listed.",
      connectionResult_model_not_listed: "Endpoint responded, but this model is not listed. Check its name and permissions.",
      connectionResult_key_missing: "The API key used by this model is missing. Enter it and save.",
      connectionResult_invalid_address: "Invalid endpoint address. Check the saved URL.",
      connectionResult_auth_failed: "Authentication failed (401). Check the API key and endpoint.",
      connectionResult_forbidden: "Access denied (403). Check key permissions, channel restrictions and endpoint.",
      connectionResult_models_unsupported: "Model listing is unsupported. Read-only checks cannot confirm availability.",
      connectionResult_rate_limited: "Rate limited (429). Retry later and check provider limits.",
      connectionResult_server_error: "Upstream error. Check the endpoint or retry later.",
      connectionResult_invalid_response: "Unexpected model listing response. Check the endpoint URL.",
      connectionResult_api_rejected: "Upstream rejected the check. Check the API key and endpoint.",
      connectionResult_timeout: "Connection timed out. Check the network and endpoint.",
      connectionResult_network_error: "Connection failed. Check the network, certificates and endpoint.",
      connectionResult_query_reachable: "Query endpoint responded. Generation permissions remain unverified.",
      connectionResult_query_unverified: "Read-only query was inconclusive. Check the Volcano endpoint and permissions.",
      summaryEmpty: "Choose a connection method, then log in or enter an API key and save.",
      panelTitle: "Video",
      panelSidebarLabel: "Video Creator",
      sidebarUpdateBadge: "Update available",
      panelIntro: "Describe the idea, duration and aspect ratio in the conversation; the plugin handles script, storyboard, generation and local merging.",
      panelStart: "Start creating",
      panelNew: "New video session",
      panelSettings: "Open plugin settings",
      panelGuide: "User guide",
      panelHighlights: "Why it works",
      panelHighlight1Title: "Made for beginners",
      panelHighlight1Desc: "No prompt engineering: describe the idea, duration and ratio, and the assistant handles script, storyboard, generation and merging.",
      panelHighlight2Title: "Create longer videos in segments",
      panelHighlight2Desc: "Videos beyond the model limit are continued in segments. Review each segment before continuing; merge locally when all segments are complete.",
      panelFlow: "How it works",
      panelStep1Title: "Describe the idea",
      panelStep1Desc: "Topic, duration, ratio (16:9 / 9:16) and resolution; the assistant asks when the ratio is missing.",
      panelStep2Title: "Script & storyboard",
      panelStep2Desc: "The script and storyboard come first; production waits for your review.",
      panelStep3Title: "Segment generation",
      panelStep3Desc: "Confirm the cost to generate, then review each segment before continuing to the next. Resume saved progress when needed.",
      panelStep4Title: "Merge locally",
      panelStep4Desc: "Segments are merged into the final video on your machine, with per-segment preview.",
      summary: "{provider} \xB7 {model}",
      apiKeyConfigured: "Configured; leave blank to keep the current key",
      connectionMode: "Connection",
      connectionModeHint: "Log in by email to receive a key, or use your own MetaOntic AI key. Save to apply a change.",
      connectionVolcengineUnavailable: 'Volcano Engine direct is not offered right now. An existing configuration keeps working; switch to MetaOntic AI in "Connection" to change it.',
      connectionMetaonticHint: "Use your MetaOntic AI API key, then save to apply.",
      connectionMetaonticRegister: "Register to get a key",
      volcengineKeyHint: "Enter an API key from the Volcano Ark console and save. No email login required. Billed to your Volcano Engine account. Check which models your key can access.",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API key",
      showKey: "Show key",
      hideKey: "Hide key",
      metaonticKeyHint: "Enter an API key and save. No email login required. Check actual charges and usage on your provider platform.",
      volcengineApiKey: "Volcano Engine API key",
      volcengine: "Volcano Engine",
      volcengineUnavailable: "Volcano Engine (not offered right now)",
      seamTrimSeconds: "Seam head trims (e.g. 0.5,0)",
      modelHiddenCurrent: "Current model (selection unavailable)",
      releaseNotesTitle: "Release notes",
      releaseUpdatedAt: "{time}",
      resetConfirm: "Reset this plugin? Saved settings, API keys and login state will be cleared. Generated videos will be kept.",
      model: "Video model",
      imageModel: "Image model",
      textModel: "Text model (scripting)",
      imageUseVideoKey: "Share one API key across video / image / text models",
      sharedModelKey: "Shared key",
      videoModelKey: "Video model key",
      imageApiKey: "Image model key",
      textApiKey: "Text model key",
      resolution: "Video resolution",
      imageModelHint: "Seedream creates character images or, with consent after a real-person restriction, stylizes references. Image calls are billed separately and results require review.",
      textModelHint: "Used inside the canvas flow panel to turn a brief into a script and storyboard table through the same relay (/v1/chat/completions); text calls are billed separately. Options match the text models on sale at the relay; the retired default is replaced with the current default.",
      modelHint: "mini focuses on cost; fast focuses on generation speed. Actual prices depend on your provider.",
      mergeMode: "Merge mode",
      mergeModeSeamless: "Direct concat (legacy setting)",
      mergeModeCopy: "Stream copy",
      mergeModeReencode: "Re-encode",
      ffmpegBinary: "ffmpeg path",
      ffprobeBinary: "ffprobe path",
      ffmpegTitle: "Merging long videos needs ffmpeg",
      ffmpegBody: "Videos exceeding the model limit (15s for 2.0, 30s for 2.5) are generated as several shots and merged into one file on this machine using ffmpeg. The default merge workflow checks for ffmpeg first; you may explicitly choose separate segments without merging.",
      ffmpegInstallFor: "Install it for your OS (click the button to copy the command):",
      ffmpegCopy: "Copy",
      ffmpegCopied: "Copied",
      ffmpegMore: "Other systems",
      ffmpegLess: "Hide other systems",
      ffmpegAfter: 'Rather not touch a terminal? Just say "\u5E2E\u6211\u88C5 ffmpeg" in the chat and the plugin runs the install after you confirm the command. Resume the original saved progress to retry downloading or merging without submitting new generation tasks. Installed somewhere unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: "Installing by hand: Homebrew on macOS, winget on Windows, your distro package manager on Linux \u2014 you are set once `ffmpeg -version` works in a terminal.",
      supportContact: "Support",
      advancedStats: "Usage statistics",
      usageStatsEnabled: "Anonymous usage statistics",
      usageStatsHint: "Reports an anonymous installation ID, version, basic device information and operation results. No conversations, media or API keys. Turning it off does not affect video creation.",
      toolArgsNoticeTitle: "The assistant wrote invalid JSON for a tool call",
      toolArgsNoticeHint: "Usually a value like 480p or 16:9 is missing its quotes. Nothing was executed and nothing was billed; reply \u201Cretry with the same settings\u201D and the assistant will re-send with the same resolution, aspect ratio and duration.",
      authNoticeTitle: "Service authentication could not be verified",
      authNoticeHint: "Check the API key and relay URL in Harness model settings. If they are correct, contact support.",
      supportClose: "Close",
      supportScan: "Follow the page instructions to contact support with WeChat for usage or connection questions. If it does not load, use the link below.",
      supportOpenPage: "Open support page",
      versionTitle: "Plugin version",
      versionCurrent: "Installed v{version}",
      versionCheck: "Check for updates",
      versionChecking: "Checking\u2026",
      versionLatest: "Up to date",
      versionNew: "v{version} is available",
      versionFailed: "Update check failed: {message}",
      versionUpdate: "Update now",
      versionOptional: "This update is optional. You can keep using the plugin and update later. It will not install automatically.",
      versionLater: "Later",
      versionUpdateConfirm: "Confirm update to v{version}",
      versionUpdateConfirmHint: "The settings page may briefly close during the update. Your settings and keys will be kept.",
      versionUpdating: "Updating\u2026",
      versionUpdateDone: "v{version} applied through hot reload; no restart needed. Existing conversations use updated plugin rules on the next turn.",
      versionUpdatePending: "v{version} installed, but not activated by the current configuration. Check its enabled state in Plugins.",
      versionUpdateRestart: "v{version} installed; restart Harness to apply it.",
      versionUpdateCancelled: "Update cancelled.",
      versionUpdateRetry: "Update incomplete. Retrying ({attempt}/{total})\u2026",
      versionUpdateFailed: "Online update failed: {message}",
      versionUpdateRemoved: "The installation state could not be confirmed. Check the Plugins page and preserve your configuration; do not uninstall immediately.",
      versionUpdateRateLimited: "Gitee is limiting requests. Try again later. Your settings and keys will be kept.",
      versionUpdateLockfile: "The profile pnpm-lock.yaml still has metaontic-video entries without integrity, so pnpm refuses to install (ERR_PNPM_MISSING_TARBALL_INTEGRITY). The plugin checks every 2 seconds, clears those invalid entries in the background and keeps a backup, and the update retries once the cleanup is done. If it still fails, quit Harness and delete pnpm-lock.yaml in the plugin install directory.",
      versionUpdateUnavailable: "This Harness version does not support this update entry. Keep the existing plugin and configuration; follow the guide to update using a stable release package.",
      versionHint: "Check for and install updates here. Your settings and keys will be kept.",
      versionCheckedAt: "checked {time}",
      sectionGeneration: "Generation",
      sectionConnection: "Connection & credentials",
      sectionVideo: "Picture & audio",
      sectionCanvas: "Workflow canvas",
      canvasPanelLabel: "MetaOnticVideo workflow canvas",
      canvasEnabled: "Workflow canvas",
      canvasEnabledHint: "Off by default: the sidebar shows no workflow canvas entry and the canvas is unavailable. Existing canvases and results stay in the plugin data folder and reopen where they left off. Turn it on to show the entry and use the standalone canvas page. The workflow canvas is built into this plugin; no other canvas plugin is required.",
      autoCreateCanvas: "Create canvas automatically",
      autoCreateCanvasHint: "Effective once the workflow canvas is on, on by default: each project creates a canvas automatically, syncs script, storyboard and plan before review, and publishes results after generation. Turn it off to stop automatic creation and only act on nodes you select.",
      sectionModels: "Models",
      sectionCombined: "More settings",
      advancedPicture: "Picture",
      advancedMerge: "Video merging",
      advancedWait: "Polling & waiting",
      advancedTools: "Local tools",
      sectionCombinedHint: "Appearance, merging, runtime and local tools",
      toolsHint: "Usually leave blank. Set executable paths only if installed tools are not detected.",
      segmentsRetained: "Original segments are always retained for preview, resume and editing.",
      ratio: "Aspect ratio",
      audioSettings: "Audio settings",
      ratioLayoutHint: "Choose landscape, portrait or adaptive framing.",
      audioLayoutHint: "Dialogue, music and ambience follow the script.",
      generateAudio: "Generate audio",
      watermark: "Add watermark",
      pollIntervalMs: "Status check interval (seconds)",
      maxWaitMs: "Maximum wait per task (seconds)",
      save: "Save",
      reset: "Reset plugin",
      resetHint: "Clear locally saved keys and custom settings to restore defaults.",
      saving: "Saving\u2026",
      saved: "Settings saved. Changes apply after configuration reloads.",
      saveFailed: "Could not save. Check your settings and try again.",
      dirty: "Unsaved changes",
      loading: "Reading configuration\u2026",
      unavailable: "Plugin settings could not be loaded. Restart Harness and try again. If this continues, check that your Harness and plugin versions are compatible.",
      readOnly: "These settings are read-only and cannot be changed.",
      seamTrimSecondsHint: "Trim the start of segments 2, 3, etc., e.g. 0.5,0. Leave blank for model defaults; use 0 to disable. Each value: 0\u20133 seconds.",
      waitSecondsHint: "At least 1 second; decimals allowed. Maximum wait must be at least the check interval.",
      versionHistory: "Update history",
      versionCheckFirst: "Check and select an available stable version before confirming installation.",
      unknownConnection: "Unknown connection method. Select one again.",
      atomicUnsupported: "This version of Harness does not support batch saving. Update Harness and try again.",
      atomicRejected: "The application refused the save. Input is retained. Reopen settings, review and retry.",
      settingsUnavailable: "Settings are loading or were replaced. Input is retained. Reopen settings and retry.",
      settingsConflict: "Another operation changed these settings. Input is retained. Review the latest settings and retry.",
      settingsTransport: "The save connection was interrupted; the result is unconfirmed. Input is retained. Reopen settings and check before saving again.",
      invalidWait: "Enter valid times of at least 1 second. Maximum wait must be at least the check interval.",
      invalidSeam: "Enter comma-separated trim values from 0 to 3 seconds, e.g. 0.5,0.",
      resetDone: "Local settings cleared and defaults restored.",
      resetFailed: "Reset failed: {message}"
    };
    return { zh, en };
  }

  // src/core/settings/state.ts
  function createFormState({ React }) {
    function useSnapshot(form) {
      const subscribe = React.useCallback((listener) => form.subscribe(listener), [form]);
      const getSnapshot = React.useCallback(() => form.getSnapshot(), [form]);
      return React.useSyncExternalStore(subscribe, getSnapshot, getSnapshot);
    }
    function same(a, b) {
      return a === b || a === void 0 && b === "" || a === "" && b === void 0;
    }
    async function persistBatch(form, ops) {
      if (typeof form.mutate !== "function") throw new Error("atomicUnsupported");
      function checkpoint() {
        try {
          const snapshot = form.getSnapshot?.();
          if (!snapshot || snapshot.status !== "ready" || snapshot.writable === false || snapshot.revision == null) return null;
          const fields = ops.map(({ path }) => ["value", "user", "base", "secrets"].map((source) => {
            let current = snapshot[source];
            for (const key of path) current = current?.[key];
            return current;
          }));
          return { revision: snapshot.revision, fields: JSON.stringify(fields) };
        } catch {
          return null;
        }
      }
      function fail(code, before2, after2) {
        globalThis.console?.warn?.("[MetaOnticVideo] settings-save", {
          code,
          beforeRevision: before2?.revision ?? null,
          afterRevision: after2?.revision ?? null
        });
        throw new Error(code);
      }
      function readiness() {
        let snapshot;
        try {
          snapshot = form.getSnapshot?.();
        } catch {
          return "settingsUnavailable";
        }
        if (!snapshot) return null;
        if (snapshot.writable === false) return "readOnly";
        if (snapshot.status && snapshot.status !== "ready") return "settingsUnavailable";
        return null;
      }
      const initialProblem = readiness();
      if (initialProblem) fail(initialProblem, null, null);
      const before = checkpoint();
      let accepted;
      try {
        accepted = await form.mutate(ops, before?.revision);
      } catch {
        fail("settingsTransport", before, null);
      }
      if (accepted) return;
      const after = checkpoint();
      const problem = readiness();
      if (problem) fail(problem, before, after);
      if (before && after && before.revision !== after.revision) {
        if (before.fields !== after.fields) fail("settingsConflict", before, after);
        try {
          accepted = await form.mutate(ops, after.revision);
        } catch {
          fail("settingsTransport", after, null);
        }
        if (accepted) return;
        const latest = checkpoint();
        fail(readiness() || (latest && latest.revision !== after.revision ? "settingsConflict" : "atomicRejected"), after, latest);
      }
      fail("atomicRejected", before, after);
    }
    return { useSnapshot, same, persistBatch };
  }

  // src/businesses/video/client/state.ts
  function createSettingsState({ React }) {
    const { useSnapshot, same, persistBatch } = createFormState({ React });
    function validateSettings(values) {
      const interval = Number(values.pollIntervalMs ?? 5e3);
      const wait = Number(values.maxWaitMs ?? 6e5);
      if (![interval, wait].every((n) => Number.isSafeInteger(n) && n >= 1e3) || wait < interval) {
        throw new Error("invalidWait");
      }
      const trim = String(values.seamTrimSeconds ?? "").trim();
      if (trim && !trim.split(",").every((part) => part.trim() !== "" && Number.isFinite(Number(part)) && Number(part) >= 0 && Number(part) <= 3)) {
        throw new Error("invalidSeam");
      }
    }
    async function persistConnection(form, pending, nextMode) {
      if (!["metaontic", "volcengine"].includes(nextMode)) throw new Error("unknownConnection");
      const inactiveKeys = nextMode === "volcengine" ? ["metaonticApiKey", "baseUrl", "submitPath", "queryPath"] : ["volcengineApiKey"];
      const ops = pending.filter(([key]) => key !== "connectionMode" && !inactiveKeys.includes(key)).map(([key, next]) => ({ op: "set", path: [key], value: next }));
      for (const key of inactiveKeys) ops.push({ op: "set", path: [key], value: "" });
      const saved = form.getSnapshot?.()?.value || {};
      const values = { ...saved, ...Object.fromEntries(pending), connectionMode: nextMode };
      if (saved.connectionMode === "volcengine" && nextMode !== "volcengine") {
        for (const key of ["baseUrl", "submitPath", "queryPath"]) {
          if (!pending.some(([field]) => field === key)) values[key] = "";
        }
      }
      for (const key of inactiveKeys) values[key] = "";
      for (const [key, next] of Object.entries(connectionDefaults(values))) {
        const existing = ops.findIndex((op) => op.path[0] === key);
        if (existing >= 0) ops.splice(existing, 1);
        ops.push({ op: "set", path: [key], value: next });
      }
      ops.push({ op: "set", path: ["connectionMode"], value: nextMode });
      await persistBatch(form, ops);
    }
    return { useSnapshot, same, validateSettings, persistConnection, persistBatch };
  }

  // src/client/updates.ts
  function createUpdates({ h, fetchSource }) {
    const PLUGIN_VERSION = true ? "3.30.1".trim().replace(/^v/i, "") : "";
    function isNewerVersion(remote, local) {
      const parse = (text) => {
        const m = /^v?(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)(?:-([0-9A-Za-z-]+(?:\.[0-9A-Za-z-]+)*))?$/.exec(String(text || ""));
        return m ? { core: m.slice(1, 4).map(Number), pre: m[4]?.split(".") || [] } : null;
      };
      const next = parse(remote), current = parse(local);
      if (!next || !current) return false;
      for (let i = 0; i < 3; i++) if (next.core[i] !== current.core[i]) return next.core[i] > current.core[i];
      if (!next.pre.length || !current.pre.length) return !next.pre.length && Boolean(current.pre.length);
      for (let i = 0; i < Math.max(next.pre.length, current.pre.length); i++) {
        const a = next.pre[i], b = current.pre[i];
        if (a === b) continue;
        if (a === void 0 || b === void 0) return b === void 0;
        const an = /^\d+$/.test(a), bn = /^\d+$/.test(b);
        if (an && bn) return Number(a) > Number(b);
        if (an !== bn) return !an;
        return a > b;
      }
      return false;
    }
    function updateBell(t, latest, current) {
      if (!isNewerVersion(latest, current)) return null;
      const label = t("versionNew", { version: latest });
      return h(
        "span",
        { key: "update-bell", className: "mov-update-bell", "data-field": "update-bell", role: "img", "aria-label": label, title: label },
        h("svg", { width: 16, height: 16, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.8, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, [
          h("path", { key: "body", d: "M18 8a6 6 0 0 0-12 0c0 7-3 7-3 9h18c0-2-3-2-3-9" }),
          h("path", { key: "clapper", d: "M10 21h4M12 2V1" })
        ])
      );
    }
    async function fetchUpdateSource(url, ms = 12e3) {
      const controller = typeof AbortController === "function" ? new AbortController() : null;
      const timer = controller ? window.setTimeout(() => controller.abort(), ms) : null;
      try {
        const response = await fetch(url, {
          headers: { accept: "application/json" },
          signal: controller ? controller.signal : void 0
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}`);
        const data = await response.json();
        return { json: async () => data };
      } finally {
        if (timer) window.clearTimeout(timer);
      }
    }
    async function fetchRecentVersions() {
      const urls = [
        `${GITEE.api}/releases?per_page=100`,
        `${GITHUB.api}/releases?per_page=100`
      ];
      const results = await Promise.allSettled(urls.map(async (url) => {
        const body = await (await (fetchSource || fetchUpdateSource)(url, 6e3)).json();
        if (!Array.isArray(body)) throw new Error("invalid releases");
        return body.filter((r) => !r.draft && !r.prerelease).map((r) => String(r.tag_name || "").replace(/^v/, "")).filter((version) => /^(0|[1-9]\d*)\.(0|[1-9]\d*)\.(0|[1-9]\d*)$/.test(version));
      }));
      const versions = [...new Set(results.flatMap((r) => r.status === "fulfilled" ? r.value : []))].sort((a, b) => isNewerVersion(a, b) ? -1 : isNewerVersion(b, a) ? 1 : 0).slice(0, 3);
      if (!versions.length) throw new Error("no published stable releases available");
      return versions;
    }
    async function fetchLatestVersion() {
      return (await fetchRecentVersions())[0];
    }
    return { PLUGIN_VERSION, UPDATE_CACHE_KEY, UPDATE_MAX_AGE_MS, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE, UPDATE_SPEC, UPDATE_ATTEMPTS, isNewerVersion, updateBell };
  }
  function createUpdateActions(context) {
    function readUpdateCache() {
      try {
        const raw = window.localStorage.getItem(context.UPDATE_CACHE_KEY);
        const saved = raw ? JSON.parse(raw) : null;
        if (!saved || typeof saved !== "object") {
          return { latest: "", versions: [], at: 0, fresh: false };
        }
        const at = Number(saved.at) || 0;
        return {
          latest: String(saved.latest || ""),
          versions: Array.isArray(saved.versions) ? saved.versions.filter((v) => /^\d+\.\d+\.\d+$/.test(v)).slice(0, 3) : [],
          at,
          fresh: Boolean(at) && Date.now() - at < context.UPDATE_MAX_AGE_MS
        };
      } catch {
        return { latest: "", versions: [], at: 0, fresh: false };
      }
    }
    function rememberUpdateCheck(latest, versions = []) {
      try {
        window.localStorage.setItem(context.UPDATE_CACHE_KEY, JSON.stringify({ at: Date.now(), latest, versions }));
      } catch {
      }
    }
    function forgetUpdateCheck() {
      try {
        window.localStorage.removeItem(context.UPDATE_CACHE_KEY);
      } catch {
      }
    }
    async function checkForUpdate(silent = false) {
      if (!silent) {
        context.setUpdateDeferred?.("");
        try {
          window.localStorage.removeItem(`${context.UPDATE_CACHE_KEY}.deferred`);
        } catch {
        }
        context.setUpdateStatus("working");
        context.setUpdateMessage("");
      }
      const request = context.updateRequest ? ++context.updateRequest.current : 0;
      try {
        const versions = context.fetchRecentVersions ? await context.fetchRecentVersions() : [await context.fetchLatestVersion()];
        const latest = versions[0];
        if (context.updateRequest && request !== context.updateRequest.current) return "";
        context.setUpdateConfirm?.(false);
        context.setUpdateLatest(latest);
        context.setUpdateAt((/* @__PURE__ */ new Date()).toLocaleTimeString());
        context.setUpdateStatus("ok");
        rememberUpdateCheck(latest, versions);
        return latest;
      } catch (error) {
        if (context.updateRequest && request !== context.updateRequest.current) return "";
        if (silent)
          return "";
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionFailed", { message: error?.message || String(error) }));
        return "";
      }
    }
    async function runOnlineUpdate() {
      if (context.updateConfirm !== true) return;
      context.setUpdateConfirm(false);
      if (context.PLUGIN_VERSION && context.isNewerVersion?.(context.updateLatest, context.PLUGIN_VERSION) !== true) {
        context.setUpdateStatus("ok");
        context.setUpdateMessage(context.t("versionLatest"));
        return;
      }
      context.setUpdateStatus("installing");
      context.setUpdateMessage("");
      const probe = context.manager ? context.manager() : { manager: null, tried: ["\u672A\u6CE8\u5165"] };
      const pluginManager = probe.manager;
      if (!pluginManager || typeof pluginManager.installBundle !== "function") {
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionUpdateUnavailable", { detail: probe.tried.join("\uFF0C") }));
        return;
      }
      try {
        if (typeof pluginManager.listBundles !== "function") throw new Error("source-unavailable");
        const listed = await pluginManager.listBundles();
        const bundles = Array.isArray(listed) ? listed : listed?.ok === true && Array.isArray(listed.value) ? listed.value : null;
        const bundle = bundles?.find((item) => item?.name === context.PLUGIN_PACKAGE && item.installed === true);
        let source = typeof bundle?.source === "string" ? bundle.source.trim() : "";
        if (source.startsWith(`${context.PLUGIN_PACKAGE}@`)) source = source.slice(context.PLUGIN_PACKAGE.length + 1);
        if (!source) throw new Error("source-unavailable");
        const linked = /^link:/i.test(source);
        const local = /^(?:file:|[a-z]:[\\/]|[\\/]|~[\\/])/i.test(source);
        if (linked || local && !/\.(?:tgz|tar\.gz)(?:[?#].*)?$/i.test(source)) {
          context.setUpdateStatus("failed");
          context.setUpdateMessage("\u5F53\u524D\u4E3A\u672C\u5730\u76EE\u5F55\u94FE\u63A5\u5B89\u88C5\uFF0C\u5DF2\u505C\u6B62\u5728\u7EBF\u66F4\u65B0\uFF0C\u672A\u6267\u884C\u66FF\u6362\u3002\u76EE\u5F55\u94FE\u63A5\u5207\u6362\u4E3A\u6210\u54C1\u5305\u5B58\u5728\u6587\u4EF6\u88AB\u6E05\u7A7A\u6216\u4ECD\u52A0\u8F7D\u65E7\u76EE\u5F55\u7684\u98CE\u9669\u3002\u8BF7\u5148\u5907\u4EFD\u5E76\u4FDD\u7559\u539F\u76EE\u5F55\uFF0C\u4F7F\u7528\u6210\u54C1\u5305\u8FC1\u79FB\u6D41\u7A0B\uFF1B\u82E5\u76EE\u5F55\u5DF2\u7A7A\uFF0C\u5148\u6062\u590D\u5B8C\u6574package\u3002\u4E0D\u8981\u91CD\u7F6E API\u5BC6\u94A5\u6216\u76F4\u63A5\u5378\u8F7D\u3002");
          return;
        }
        if (bundle.error || bundle.meta?.error) throw new Error("metadata-unavailable");
      } catch {
        context.setUpdateStatus("failed");
        context.setUpdateMessage("\u65E0\u6CD5\u6838\u5B9E\u63D2\u4EF6\u5B89\u88C5\u6765\u6E90\u6216\u5143\u4FE1\u606F\uFF0C\u5DF2\u505C\u6B62\u66F4\u65B0\uFF0C\u672A\u6267\u884C\u66FF\u6362\u3002\u8BF7\u4FDD\u7559\u73B0\u6709\u914D\u7F6E\u548C\u5B89\u88C5\u76EE\u5F55\uFF0C\u6838\u5BF9\u5B89\u88C5\u72B6\u6001\u540E\u518D\u5904\u7406\uFF1B\u4E0D\u8981\u91CD\u7F6E API\u5BC6\u94A5\u6216\u5148\u5378\u8F7D\u3002");
        return;
      }
      const requestId = `${context.PLUGIN_PACKAGE}-update-${Date.now()}`;
      const install = async (spec) => {
        try {
          return await pluginManager.installBundle(spec, { enabled: true, requestId });
        } catch (error) {
          return { ok: false, error: { message: error?.message || String(error) } };
        }
      };
      const failureText = (result) => String(result?.error?.message ?? result?.value?.error?.diagnostic ?? result?.value?.error?.code ?? "unknown");
      const worthRetrying = (text) => /429|queue overflowed|timed out|timeout|ETIMEDOUT|ECONNRESET|ECONNREFUSED|EAI_AGAIN|socket hang up|unable to access|network|fetch/i.test(text);
      const lockfileUnverifiable = (text) => /MISSING_TARBALL_INTEGRITY/i.test(text);
      if (!/^\d+\.\d+\.\d+$/.test(context.updateLatest || "") || context.availableVersions && !context.availableVersions.includes(context.updateLatest)) {
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionCheckFirst"));
        return;
      }
      const candidates = [
        releaseDownloadUrl(context.updateLatest, "gitee"),
        releaseDownloadUrl(context.updateLatest, "github")
      ];
      const specUnresolvable = (text) => /Could not resolve|No matching version|ERR_PNPM_NO_MATCHING_VERSION|ERR_PNPM_FETCH_40[34]|HTTP[ :]+40[34]|404 Not Found|403 Forbidden/i.test(text);
      const trySpec = async (spec) => {
        for (let round = 1; round <= context.UPDATE_ATTEMPTS; round += 1) {
          let result = await install(spec);
          if (result?.ok === true && result.value?.error?.code === "already-installed") {
            return { failure: failureText(result), next: false };
          }
          if (result?.ok === true && result.value?.application !== "failed") {
            return { outcome: result.value || {} };
          }
          const text = failureText(result);
          if (lockfileUnverifiable(text)) {
            if (round < context.UPDATE_ATTEMPTS) {
              context.setUpdateMessage(context.t("versionUpdateRetry", { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
              await new Promise((resolve) => window.setTimeout(resolve, 5e3));
              continue;
            }
            return { failure: text, next: false, lockfile: true };
          }
          const transient = worthRetrying(text);
          if (transient && round < context.UPDATE_ATTEMPTS) {
            context.setUpdateMessage(context.t("versionUpdateRetry", { attempt: round + 1, total: context.UPDATE_ATTEMPTS }));
            await new Promise((resolve) => window.setTimeout(resolve, round * 1200));
            continue;
          }
          return { failure: text, next: !transient && specUnresolvable(text) };
        }
        return { failure: "unknown" };
      };
      let outcome = null;
      let failure = "";
      for (const spec of candidates) {
        const attempt = await trySpec(spec);
        if (attempt.outcome) {
          outcome = attempt.outcome;
          break;
        }
        failure = attempt.failure || failure;
        if (!attempt.next)
          break;
      }
      if (!outcome) {
        context.setUpdateStatus("failed");
        context.setUpdateMessage([
          lockfileUnverifiable(failure) ? context.t("versionUpdateLockfile") : "",
          context.t("versionUpdateFailed", { message: failure }),
          worthRetrying(failure) || /429|queue overflowed/i.test(failure) ? context.t("versionUpdateRateLimited") : ""
        ].filter(Boolean).join(" "));
        return;
      }
      if (outcome.application === "cancelled") {
        context.setUpdateStatus("ok");
        context.setUpdateMessage(context.t("versionUpdateCancelled"));
        return;
      }
      forgetUpdateCheck();
      const version = outcome.version || context.updateLatest;
      context.setUpdateLatest("");
      context.setUpdateStatus(outcome.application === "restart-required" ? "restart" : "applied");
      context.setUpdateMessage(outcome.application === "restart-required" ? context.t("versionUpdateRestart", { version }) : context.t(outcome.application === "applied" ? "versionUpdateDone" : "versionUpdatePending", { version }));
    }
    function deferUpdate() {
      context.setUpdateConfirm(false);
      context.setUpdateDeferred(context.updateLatest);
      try {
        window.localStorage.setItem(`${context.UPDATE_CACHE_KEY}.deferred`, context.updateLatest);
      } catch {
      }
    }
    return { deferUpdate, readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate };
  }
  function renderUpdateNotice({ h, t, available, latest, deferred, status, confirmed, onUpdate, onLater }) {
    if (!available || deferred === latest || status === "installing") return null;
    return h("div", { key: "update-notice", className: "mov-notice", role: "status", "data-field": "update-notice" }, [
      h("strong", { key: "title" }, t("versionNew", { version: latest })),
      h("p", { key: "optional" }, t("versionOptional")),
      confirmed ? h("p", { key: "confirm" }, t("versionUpdateConfirmHint")) : null,
      h("div", { key: "actions", className: "mov-cmd-row" }, [
        h(
          "button",
          {
            key: "update",
            type: "button",
            className: "mov-btn mov-btn-sm mov-btn-primary",
            "data-action": confirmed ? "update-notice-confirm" : "update-notice-open",
            onClick: onUpdate
          },
          confirmed ? t("versionUpdateConfirm", { version: latest }) : t("versionUpdate")
        ),
        h("button", { key: "later", type: "button", className: "mov-btn mov-btn-sm", "data-action": "update-later", onClick: onLater }, t("versionLater"))
      ])
    ]);
  }
  function formatReleaseTime(value) {
    if (typeof value !== "string" || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d+)?(?:Z|[+-]\d{2}:\d{2})$/.test(value)) return "";
    const date = new Date(value);
    if (!Number.isFinite(date.getTime())) return "";
    return new Date(date.getTime() + 8 * 60 * 60 * 1e3).toISOString().slice(0, 16).replace("T", " ");
  }

  // src/businesses/video/client/connection-check.ts
  function createConnectionCheckController({ setState, readSnapshot, fetcher = (...args) => fetch(...args) }) {
    let request = 0, controller = null;
    function dispose() {
      request++;
      controller?.abort();
      controller = null;
    }
    function invalidate() {
      dispose();
      setState({ status: "idle", checks: [] });
    }
    async function run(ready) {
      if (!ready || controller) return;
      const id = ++request, revision = readSnapshot()?.revision;
      const abort = new AbortController();
      controller = abort;
      setState({ status: "working", checks: [] });
      const timeout = setTimeout(() => abort.abort(), 16e3);
      try {
        const response = await fetcher("/metaontic-video/check-connection", { method: "POST", headers: { "content-type": "application/json" }, body: "{}", signal: abort.signal });
        const result = await response.json();
        if (id !== request || readSnapshot()?.revision !== revision) return;
        if (!response.ok || !Array.isArray(result?.checks) || !result.checks.length) throw Error();
        setState({ status: "done", checks: result.checks });
      } catch {
        if (id === request && readSnapshot()?.revision === revision) setState({ status: "failed", checks: [] });
      } finally {
        clearTimeout(timeout);
        if (id === request) controller = null;
      }
    }
    return { run, invalidate, dispose };
  }

  // src/businesses/video/client/settings-actions.ts
  var HIDDEN_CONNECTION_MODES = [
    ...VOLCENGINE_MODE_AVAILABLE ? [] : ["volcengine"]
  ];
  function hiddenConnectionLabel(t, mode) {
    if (mode === "volcengine")
      return t(VOLCENGINE_MODE_AVAILABLE ? "volcengine" : "volcengineUnavailable");
    return t(mode);
  }
  function createSettingsActions(context) {
    async function save() {
      const { saveInFlight, connectionBusy, setSaveError, setStatus, form, draft, same, validateSettings, persistConnection, setDraft, flashStatus, settingsError } = context;
      if (saveInFlight.current)
        return;
      if (connectionBusy.current && !connectionBusy.pending)
        return;
      saveInFlight.current = true;
      setSaveError("");
      setStatus("saving");
      try {
        if (connectionBusy.pending)
          await connectionBusy.pending.catch(() => {
          });
        connectionBusy.current = true;
        const latest = form.getSnapshot().value || {};
        const nextMode = draft.connectionMode ?? latest.connectionMode ?? "metaontic";
        const changes = Object.entries(draft).filter(([key, next]) => !same(latest[key], next));
        validateSettings({ ...latest, ...draft });
        await persistConnection(form, changes, nextMode);
        setDraft((current) => Object.fromEntries(Object.entries(current).filter(([key, next]) => !Object.prototype.hasOwnProperty.call(draft, key) || !same(draft[key], next))));
        flashStatus("saved");
      } catch (error) {
        setSaveError(settingsError(error));
        setStatus("failed");
      } finally {
        connectionBusy.current = false;
        saveInFlight.current = false;
      }
    }
    async function reset() {
      const { connectionBusy, t, setSaveError, setStatus, snapshot, PLUGIN_OWNED_KEYS, persistBatch, form, setDraft, setVisibleKey, flashStatus, settingsError } = context;
      if (connectionBusy.current)
        return;
      if (!context.confirm(t("resetConfirm")))
        return;
      connectionBusy.current = true;
      setSaveError("");
      setStatus("saving");
      try {
        const targets = new Set(PLUGIN_OWNED_KEYS);
        await persistBatch(form, [...targets].map((key) => ({ op: "unset", path: [key] })));
        setDraft({});
        setVisibleKey("");
        flashStatus("reset");
      } catch (error) {
        setSaveError(t("resetFailed", { message: settingsError(error) }));
        setStatus("failed");
      } finally {
        connectionBusy.current = false;
      }
    }
    function control(field) {
      const { draft, value, h, SELECTS, inputStyle, t, snapshot, visibleKey, setVisibleKey, edit, optionLabel } = context;
      const blankTextModel = field.key === "textModel" && !String(draft[field.key] ?? value[field.key] ?? "").trim();
      const current = blankTextModel ? (SELECTS.textModel || [])[0] : draft[field.key] !== void 0 ? draft[field.key] : value[field.key] ?? (["imageUseVideoKey", "usageStatsEnabled", "autoCreateCanvas"].includes(field.key) ? true : field.key === "canvasEnabled" ? false : field.key === "pollIntervalMs" ? 5e3 : field.key === "maxWaitMs" ? 6e5 : void 0);
      const secondsField = field.key === "pollIntervalMs" || field.key === "maxWaitMs";
      const displayed = secondsField && current !== void 0 && current !== "" ? Number(current) / 1e3 : current;
      const id = `metaontic-video-${field.key}`;
      if (field.kind === "switch") {
        return h("label", { key: "control", htmlFor: id, className: "mov-switch" }, h("input", {
          id,
          "data-field": field.key,
          type: "checkbox",
          checked: Boolean(current),
          onChange: (event) => edit(field.key, event.target.checked)
        }), h("span", null, t(field.key)));
      }
      if (field.kind === "select") {
        const options = SELECTS[field.key] || [];
        const hiddenModel = field.key === "model" && /seedance-2(?:-5|\.5)/i.test(String(current || ""));
        const hiddenMode = field.key === "connectionMode" && HIDDEN_CONNECTION_MODES.includes(String(current || ""));
        const legacyMerge = field.key === "mergeMode" && current === "seamless";
        const retiredImageModel = field.key === "imageModel" && !options.includes(String(current || ""));
        const retiredTextModel = field.key === "textModel" && RETIRED_TEXT_MODELS.includes(String(current || ""));
        const removedMode = field.key === "connectionMode" && !["metaontic", "volcengine"].includes(String(current || ""));
        const list = !removedMode && current && !options.includes(current) && !hiddenModel && !hiddenMode && !legacyMerge && !retiredImageModel && !retiredTextModel ? [...options, current] : options;
        return h("select", {
          key: "control",
          id,
          "data-field": field.key,
          className: `mov-input${field.mono ? " mov-mono" : ""}`,
          style: inputStyle,
          value: removedMode ? "" : legacyMerge ? "copy" : retiredImageModel || retiredTextModel ? options[0] ?? "" : current ?? "",
          onChange: (event) => edit(field.key, event.target.value)
        }, [
          removedMode ? h("option", { key: "select-connection", value: "", disabled: true }, t("unknownConnection")) : null,
          hiddenModel ? h("option", { key: "hidden-current", value: current, hidden: true }, t("modelHiddenCurrent")) : null,
          // 下架期间直接标出不可用；恢复后这一支不会走到（该方式会回到候选里）。
          hiddenMode ? h("option", { key: "hidden-current", value: current, hidden: true }, hiddenConnectionLabel(t, String(current || ""))) : null,
          ...list.map((option) => h("option", { key: option, value: option }, optionLabel(t, field.key, option)))
        ]);
      }
      const canReveal = field.key === "metaonticApiKey" || field.key === "volcengineApiKey" || field.key === "imageApiKey" || field.key === "textApiKey";
      const revealed = canReveal && visibleKey === field.key;
      const input = h("input", {
        // 这个 input 会和右侧眼睛按钮一起放进数组，React 要求数组子节点带 key
        key: "input",
        id,
        "data-field": field.key,
        className: `mov-input${field.mono ? " mov-mono" : ""}`,
        style: inputStyle,
        type: field.kind === "number" ? "number" : field.secret && !revealed ? "password" : "text",
        value: displayed ?? "",
        min: secondsField ? 1 : void 0,
        step: secondsField ? 1e-3 : void 0,
        placeholder: field.secret && (snapshot.secrets?.[field.key] || value[field.key]) ? t("apiKeyConfigured") : "",
        onChange: (event) => edit(field.key, field.kind === "number" && event.target.value !== "" ? secondsField ? Math.round(Number(event.target.value) * 1e3) : Number(event.target.value) : event.target.value)
      });
      if (!canReveal)
        return input;
      return h("div", { key: "control", className: "mov-key-control" }, [
        input,
        h("button", {
          key: "toggle",
          type: "button",
          className: "mov-key-eye",
          "aria-label": t(revealed ? "hideKey" : "showKey"),
          title: t(revealed ? "hideKey" : "showKey"),
          "data-action": `toggle-${field.key}`,
          "aria-controls": id,
          "aria-pressed": revealed,
          onClick: () => setVisibleKey(revealed ? "" : field.key)
        }, h("svg", { width: 18, height: 18, viewBox: "0 0 24 24", fill: "none", stroke: "currentColor", strokeWidth: 1.7, strokeLinecap: "round", strokeLinejoin: "round", "aria-hidden": true }, [
          h("path", { key: "eye", d: "M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" }),
          h("circle", { key: "pupil", cx: 12, cy: 12, r: 3 }),
          revealed ? h("path", { key: "slash", d: "M3 3l18 18" }) : null
        ]))
      ]);
    }
    return { save, reset, control };
  }

  // package.json
  var package_default = {
    name: "metaontic-video",
    version: "3.30.1",
    description: "DeepSeek Harness video plugin: beginner-friendly guided video creation and a low-cost long-video workflow using segment continuation and local merging.",
    license: "SEE LICENSE IN LICENSE",
    type: "module",
    keywords: [
      "metaontic-video",
      "deepseek-harness",
      "deepseek-harness-plugin",
      "dsh-plugin",
      "ai-video",
      "ai-video-generation",
      "seedance",
      "seedance-2",
      "long-video",
      "video-generation",
      "image-to-video",
      "text-to-video",
      "video-continuation",
      "video-extension",
      "storyboard",
      "ffmpeg",
      "new-api",
      "video-director"
    ],
    repository: {
      type: "git",
      url: "git+https://github.com/wxsimon2022/metaontic-video.git"
    },
    homepage: "https://github.com/wxsimon2022/metaontic-video#readme",
    bugs: {
      url: "https://github.com/wxsimon2022/metaontic-video/issues"
    },
    exports: {
      ".": "./index.js",
      "./client": "./client.js",
      "./locale/*.json": "./locale/*.json",
      "./icon": "./icon.svg",
      "./package.json": "./package.json",
      "./presets/video-director": "./presets/video-director.js",
      "./presets/video-director/locale/*.json": "./locale/presets/video-director/*.json",
      "./presets/promo-video": "./presets/promo-video.js",
      "./presets/promo-video/locale/*.json": "./locale/presets/promo-video/*.json",
      "./presets/video-director/icon": "./presets/icons/video-director.svg",
      "./presets/promo-video/icon": "./presets/icons/promo-video.svg"
    },
    files: [
      "index.js",
      "client.js",
      "cordis.patch.yml",
      "skills",
      "locale/*.json",
      "icon.svg",
      "logo.svg",
      "README.en.md",
      "MetaOnticVideo\u4F7F\u7528\u8BF4\u660E\u4E66.md",
      "MetaOnticVideo\u4F7F\u7528\u8BF4\u660E\u4E66.pdf",
      "CHANGELOG.md",
      "LICENSE",
      "docs/guide/*.svg",
      "docs/guide/*.png",
      "THIRD_PARTY_NOTICES.md",
      "presets/*.js",
      "locale/presets/**/*.json",
      "presets/icons/*.svg"
    ],
    engines: {
      node: ">=20",
      dsh: ">=0.2.0"
    },
    publishConfig: {
      access: "public",
      registry: "https://registry.npmjs.org/"
    },
    dsh: {
      bundle: {
        patch: "./cordis.patch.yml"
      },
      client: {
        platform: "web",
        inject: [
          "@deepseek-ai/dsh-client-locale",
          "@deepseek-ai/dsh-client-ui-settings",
          "@deepseek-ai/dsh-client-ui-tool",
          "@deepseek-ai/dsh-client-ui-session",
          "@deepseek-ai/dsh-client-ui-plugin-manager",
          "@deepseek-ai/dsh-api-remotes"
        ]
      }
    },
    devDependencies: {
      "@types/node": "^20.19.43",
      esbuild: "^0.28.2",
      react: "^19.3.1",
      "react-dom": "^19.3.1",
      typescript: "^5.9.3",
      hyperframes: "0.8.223",
      "@deepseek-ai/schemastery": "~3.18.5"
    },
    scripts: {
      typecheck: "tsc -p tsconfig.json",
      "build:locale": "node scripts/build.mjs locale",
      "build:host": "node scripts/build.mjs host",
      "build:client": "node scripts/build.mjs client",
      build: "npm run typecheck && node scripts/build.mjs",
      preview: "node scripts/preview.mjs",
      release: "node scripts/release.mjs",
      "clean:releases": "node scripts/clean-releases.mjs",
      "pack:test": "node scripts/pack-test.mjs",
      "market:index": "node scripts/market-index.mjs",
      "npm:publish": "node scripts/publish-npm.mjs",
      "npm:token": "node scripts/npm-token.mjs"
    },
    dependencies: {},
    releaseNotes: {
      version: "3.30.1",
      prerelease: false,
      publishedAt: "2026-11-17T06:04:21.353Z",
      items: [
        "\u4F18\u5316\uFF1A\u589E\u5F3A\u521B\u610F\u770B\u70B9\u3001\u5267\u60C5\u7EC6\u8282\u4E0E\u89C6\u89C9\u53D9\u4E8B\uFF0C\u6539\u5584\u4EBA\u7269\u52A8\u4F5C\u53CD\u5E94\u3001\u5206\u6BB5\u8854\u63A5\u548C\u58F0\u97F3\u5EF6\u7EED\uFF0C\u4FEE\u6B63\u5355\u6BB5\u4F5C\u54C1\u7ED3\u5C3E\u6536\u675F\u3002"
      ]
    }
  };

  // src/businesses/video/client/settings.ts
  function createSettingsPage(deps) {
    const {
      useSnapshot,
      React,
      h,
      TOKENS,
      same,
      validateSettings,
      persistConnection,
      PLUGIN_OWNED_KEYS,
      persistBatch,
      PLUGIN_VERSION,
      UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2,
      UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2,
      fetchLatestVersion,
      SELECTS,
      inputStyle,
      optionLabel,
      FIELD_BY_KEY,
      SECTIONS,
      formatMoney,
      PLUGIN_PACKAGE: PLUGIN_PACKAGE2,
      UPDATE_SPEC: UPDATE_SPEC2,
      UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2,
      isNewerVersion,
      updateBell,
      PAGE_CSS
    } = deps;
    function makePage({ form, t, manager }) {
      return function ConfigPage(props) {
        const snapshot = useSnapshot(form);
        const value = snapshot.value || {};
        const [draft, setDraft] = React.useState({});
        const selectedMode = draft.connectionMode ?? value.connectionMode ?? "metaontic";
        const directMode = selectedMode === "volcengine";
        const [visibleKey, setVisibleKey] = React.useState("");
        const [supportOpen, setSupportOpen] = React.useState(false);
        const supportDialog = React.useRef(null);
        React.useEffect(() => {
          if (supportOpen && supportDialog.current && !supportDialog.current.open) supportDialog.current.showModal();
        }, [supportOpen]);
        React.useEffect(() => {
          setSupportOpen(false);
        }, [selectedMode]);
        React.useEffect(() => {
          setVisibleKey("");
        }, [selectedMode]);
        const [status, setStatus] = React.useState("idle");
        const [saveError, setSaveError] = React.useState("");
        const [connectionCheck, setConnectionCheck] = React.useState({ status: "idle", checks: [] });
        const checkController = React.useRef(null);
        if (!checkController.current) checkController.current = createConnectionCheckController({ setState: setConnectionCheck, readSnapshot: () => form.getSnapshot() });
        React.useEffect(() => {
          checkController.current.invalidate();
          return () => checkController.current.dispose();
        }, [snapshot.revision]);
        const statusTimer = React.useRef(null);
        const connectionBusy = React.useRef(false);
        const saveInFlight = React.useRef(false);
        const [showAllFfmpeg, setShowAllFfmpeg] = React.useState(false);
        const [copiedFfmpeg, setCopiedFfmpeg] = React.useState("");
        const [updateStatus, setUpdateStatus] = React.useState("idle");
        const [updateMessage, setUpdateMessage] = React.useState("");
        const [updateLatest, setUpdateLatest] = React.useState("");
        const updateRequest = React.useRef(0);
        const releaseNotes = package_default.releaseNotes;
        const [updateAt, setUpdateAt] = React.useState("");
        const [updateConfirm, setUpdateConfirm] = React.useState(false);
        const [updateDeferred, setUpdateDeferred] = React.useState(() => {
          try {
            return window.localStorage.getItem(`${UPDATE_CACHE_KEY2}.deferred`) || "";
          } catch {
            return "";
          }
        });
        const { readUpdateCache, rememberUpdateCheck, forgetUpdateCheck, checkForUpdate, runOnlineUpdate, deferUpdate } = createUpdateActions({
          get UPDATE_CACHE_KEY() {
            return UPDATE_CACHE_KEY2;
          },
          get PLUGIN_VERSION() {
            return PLUGIN_VERSION;
          },
          get isNewerVersion() {
            return isNewerVersion;
          },
          get updateRequest() {
            return updateRequest;
          },
          get UPDATE_MAX_AGE_MS() {
            return UPDATE_MAX_AGE_MS2;
          },
          get setUpdateStatus() {
            return setUpdateStatus;
          },
          get setUpdateMessage() {
            return setUpdateMessage;
          },
          get fetchLatestVersion() {
            return fetchLatestVersion;
          },
          get setUpdateLatest() {
            return setUpdateLatest;
          },
          get setUpdateAt() {
            return setUpdateAt;
          },
          get t() {
            return t;
          },
          get setUpdateConfirm() {
            return setUpdateConfirm;
          },
          get manager() {
            return manager;
          },
          get PLUGIN_PACKAGE() {
            return PLUGIN_PACKAGE2;
          },
          get updateLatest() {
            return updateLatest;
          },
          get updateConfirm() {
            return updateConfirm;
          },
          get setUpdateDeferred() {
            return setUpdateDeferred;
          },
          get UPDATE_SPEC() {
            return UPDATE_SPEC2;
          },
          get UPDATE_ATTEMPTS() {
            return UPDATE_ATTEMPTS2;
          }
        });
        const updateTried = React.useRef(false);
        React.useEffect(() => {
          if (props?.view === "summary") {
            updateTried.current = false;
            return;
          }
          if (updateTried.current) return;
          updateTried.current = true;
          setUpdateLatest("");
          setUpdateConfirm(false);
          setUpdateAt("");
          setUpdateStatus("idle");
          setUpdateMessage("");
          try {
            setUpdateDeferred(window.localStorage.getItem(`${UPDATE_CACHE_KEY2}.deferred`) || "");
          } catch {
            setUpdateDeferred("");
          }
          const cached = readUpdateCache();
          if (cached.latest) {
            setUpdateLatest(cached.latest);
            if (cached.at) setUpdateAt(new Date(cached.at).toLocaleTimeString());
            setUpdateStatus("ok");
          }
          checkForUpdate(true).catch(() => {
          });
        }, [props?.view]);
        if (props && props.view === "summary") {
          const configured = Boolean(value.model) || Boolean(snapshot.secrets?.apiKey);
          const text = configured ? t("summary", { provider: t(selectedMode), model: value.model || "-" }) : t("summaryEmpty");
          return h("span", { style: { color: TOKENS.muted } }, text);
        }
        const pending = Object.entries(draft).filter(([key, next]) => !same(value[key], next));
        const edit = (key, next) => {
          checkController.current.invalidate();
          clearStatusTimer();
          setStatus((current) => current === "idle" ? current : "idle");
          setDraft((current) => ({ ...current, [key]: next }));
        };
        const clear = (key) => setDraft((current) => {
          const next = { ...current };
          delete next[key];
          return next;
        });
        function clearStatusTimer() {
          if (statusTimer.current) {
            window.clearTimeout(statusTimer.current);
            statusTimer.current = null;
          }
        }
        function flashStatus(next, holdMs = 2500) {
          clearStatusTimer();
          setStatus(next);
          statusTimer.current = window.setTimeout(() => {
            statusTimer.current = null;
            setStatus("idle");
          }, holdMs);
        }
        function settingsError(error) {
          const message = error?.message || String(error);
          return ["unknownConnection", "atomicUnsupported", "atomicRejected", "settingsUnavailable", "settingsConflict", "settingsTransport", "readOnly", "invalidWait", "invalidSeam"].includes(message) ? t(message) : message;
        }
        const { save, reset, control } = createSettingsActions({
          saveInFlight,
          connectionBusy,
          setSaveError,
          setStatus,
          form,
          draft,
          same,
          validateSettings,
          persistConnection,
          persistBatch,
          setDraft,
          flashStatus,
          settingsError,
          t,
          snapshot,
          PLUGIN_OWNED_KEYS,
          setVisibleKey,
          value,
          h,
          SELECTS,
          inputStyle,
          optionLabel,
          edit,
          visibleKey,
          confirm: (message) => window.confirm(message)
        });
        const hints = {
          connectionMode: selectedMode === "metaontic" ? [t("connectionMetaonticHint"), " ", h("a", { key: "metaontic-register", href: RELAY.signupUrl, target: "_blank", rel: "noopener noreferrer", style: { textDecoration: "underline" } }, t("connectionMetaonticRegister"))] : directMode && !VOLCENGINE_MODE_AVAILABLE ? t("connectionVolcengineUnavailable") : t("connectionModeHint"),
          metaonticApiKey: t("metaonticKeyHint"),
          volcengineApiKey: t("volcengineKeyHint"),
          model: t("modelHint"),
          imageModel: t("imageModelHint"),
          textModel: t("textModelHint"),
          seamTrimSeconds: t("seamTrimSecondsHint"),
          canvasEnabled: t("canvasEnabledHint"),
          autoCreateCanvas: t("autoCreateCanvasHint"),
          maxWaitMs: t("waitSecondsHint")
        };
        function fieldCell(field) {
          const classes = ["mov-field"];
          if (field.kind === "switch") classes.push("mov-field-switch");
          if (field.wide) classes.push("mov-field-wide");
          return h("div", { key: field.key, className: classes.join(" ") }, [
            field.kind === "switch" ? null : h("label", { key: "label", className: "mov-label", htmlFor: `metaontic-video-${field.key}` }, t(["metaonticApiKey", "volcengineApiKey"].includes(field.key) ? !directMode && (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false ? "sharedModelKey" : "videoModelKey" : field.key)),
            control(field),
            hints[field.key] ? h("span", { key: "hint", className: "mov-hint", style: { marginTop: 4 } }, hints[field.key]) : null
          ]);
        }
        const renderGrid = (section) => {
          if (section.key === "sectionModels") {
            const shared2 = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
            const common = !directMode ? [fieldCell(FIELD_BY_KEY.imageUseVideoKey), ...shared2 ? [fieldCell(FIELD_BY_KEY.metaonticApiKey)] : []] : [];
            const videoFields = ["model", ...shared2 ? ["textModel"] : [], ...directMode || !shared2 ? [directMode ? "volcengineApiKey" : "metaonticApiKey"] : []];
            const imageFields = ["imageModel", ...!shared2 ? ["imageApiKey"] : []];
            const textFields = !directMode && !shared2 ? ["textModel", "textApiKey"] : [];
            return h("div", { key: section.key, className: "mov-model-settings" }, [
              ...common,
              h("div", { key: "models", className: `mov-model-grid${directMode ? " mov-model-grid-single" : ""}` }, [
                h("div", { key: "video", className: "mov-model-card", "data-group": "video-model" }, videoFields.map((key) => fieldCell(FIELD_BY_KEY[key]))),
                !directMode ? h("div", { key: "image", className: "mov-model-card", "data-group": "image-model" }, imageFields.map((key) => fieldCell(FIELD_BY_KEY[key]))) : null,
                textFields.length ? h("div", { key: "text", className: "mov-model-card", "data-group": "text-model" }, textFields.map((key) => fieldCell(FIELD_BY_KEY[key]))) : null
              ])
            ]);
          }
          if (section.key === "sectionVideo") {
            return h("div", { key: section.key, className: "mov-av-grid" }, [
              h("div", { key: "picture", className: "mov-av-card" }, [
                fieldCell(FIELD_BY_KEY.ratio),
                h("span", { key: "hint", className: "mov-hint" }, t("ratioLayoutHint"))
              ]),
              h("div", { key: "audio", className: "mov-av-card mov-av-audio" }, [
                h("span", { key: "label", className: "mov-label" }, t("audioSettings")),
                control(FIELD_BY_KEY.generateAudio),
                h("span", { key: "hint", className: "mov-hint" }, t("audioLayoutHint"))
              ])
            ]);
          }
          const shared = (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
          const videoKey = directMode ? "volcengineApiKey" : "metaonticApiKey";
          const canvasOn = (draft.canvasEnabled ?? value.canvasEnabled ?? false) === true;
          const fields = section.key === "sectionModels" ? directMode ? ["model", videoKey] : shared ? ["imageUseVideoKey", videoKey, "model", "imageModel"] : ["imageUseVideoKey", "model", videoKey, "imageModel", "imageApiKey"] : section.fields;
          return h(
            "div",
            { key: section.key, className: "mov-grid" },
            fields.filter((key) => (key !== "volcengineApiKey" || directMode) && (!["imageModel", "imageUseVideoKey", "imageApiKey"].includes(key) || !directMode) && (key !== "imageApiKey" || (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) === false) && (key !== "metaonticApiKey" || selectedMode === "metaontic") && (key !== "autoCreateCanvas" || canvasOn)).map((key) => fieldCell(FIELD_BY_KEY[key])).filter(Boolean)
          );
        };
        const connectionBox = h("div", { key: "connection-check", className: "mov-section", "data-field": "connectionCheck", style: { marginTop: 20 } }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("connectionCheckTitle")),
            h("button", { key: "button", type: "button", className: "mov-btn", "data-action": "check-connection", disabled: pending.length > 0 || status === "saving" || snapshot.status !== "ready" || connectionCheck.status === "working", onClick: () => checkController.current.run(!pending.length && status !== "saving" && form.getSnapshot()?.status === "ready") }, t(connectionCheck.status === "working" ? "connectionChecking" : "connectionCheckButton"))
          ]),
          h("p", { key: "hint", className: "mov-hint" }, t(pending.length ? "connectionCheckSaveFirst" : "connectionCheckHint")),
          h("div", { key: "result", role: "status", "aria-live": "polite" }, connectionCheck.status === "failed" ? h("p", { style: { color: TOKENS.error } }, t("connectionCheckFailed")) : connectionCheck.checks.map((check) => h("p", { key: check.target, style: { color: check.level === "error" ? TOKENS.error : check.level === "success" ? TOKENS.success : TOKENS.muted } }, `${t("connectionTarget_" + check.target)}\uFF1A${t("connectionResult_" + check.code)}`)))
        ]);
        const settingsRows = () => [
          h("div", { key: "generation", className: "mov-section" }, [
            h("div", { key: "title", className: "mov-section-title" }, t("sectionGeneration")),
            ...SECTIONS.map((section) => h("div", { key: section.key, className: "mov-parameter-group" }, [
              h("div", { key: "heading", className: "mov-parameter-heading" }, t(section.key)),
              renderGrid(section)
            ]))
          ]),
          h("details", { key: "advanced", className: "mov-section mov-advanced" }, [
            h("summary", { key: "toggle", className: "mov-advanced-toggle" }, [
              h("span", { key: "title" }, t("sectionCombined")),
              h("span", { key: "hint", className: "mov-hint" }, t("sectionCombinedHint"))
            ]),
            h("div", { key: "body", className: "mov-advanced-body" }, [
              ...[
                { key: "advancedPicture", fields: ["watermark"] },
                { key: "advancedMerge", fields: ["mergeMode", "seamTrimSeconds"], hint: "segmentsRetained" },
                { key: "advancedWait", fields: ["pollIntervalMs", "maxWaitMs"] },
                { key: "advancedTools", fields: ["ffmpegBinary", "ffprobeBinary"], hint: "toolsHint" },
                { key: "advancedStats", fields: ["usageStatsEnabled"], hint: "usageStatsHint" }
              ].map((group) => h("div", { key: group.key, className: `mov-advanced-group${group.key === "advancedTools" ? " mov-advanced-tools" : ""}`, "data-group": group.key }, [
                h("div", { key: "title", className: "mov-parameter-heading" }, t(group.key)),
                renderGrid(group),
                group.hint ? h("p", { key: "hint", className: "mov-hint", style: { margin: 0 } }, t(group.hint)) : null
              ]))
            ])
          ])
        ];
        const overrides = Object.keys(snapshot.user || {});
        const footerMessage = status === "saved" ? t("saved") : status === "reset" ? t("resetDone") : status === "failed" ? saveError || t("saveFailed") : pending.length ? t("dirty") : "";
        const footer = pending.length || status !== "idle" ? h("div", { key: "footer", className: "mov-footer" }, [
          footerMessage ? h("span", {
            key: "status",
            style: {
              fontSize: 12,
              color: status === "failed" ? TOKENS.error : status === "saved" || status === "reset" ? TOKENS.success : TOKENS.muted
            }
          }, footerMessage) : null
        ]) : null;
        const resetRow = overrides.length || pending.length ? h("div", { key: "reset-row", className: "mov-footer mov-reset-row" }, [
          h("span", { key: "hint", className: "mov-hint", style: { flex: "1 1 200px" } }, t("resetHint")),
          pending.length ? h("button", {
            key: "save",
            "data-action": "save",
            type: "button",
            className: "mov-btn mov-btn-primary",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: save
          }, status === "saving" ? t("saving") : t("save")) : null,
          h("button", {
            key: "reset",
            "data-action": "reset",
            type: "button",
            className: "mov-btn",
            disabled: status === "saving" || snapshot.writable === false,
            onClick: reset
          }, t("reset"))
        ]) : null;
        const updateAvailable = Boolean(updateLatest) && Boolean(PLUGIN_VERSION) && isNewerVersion(updateLatest, PLUGIN_VERSION);
        const updateText = updateStatus === "working" ? t("versionChecking") : updateStatus === "failed" ? updateMessage : updateStatus === "installing" ? t("versionUpdating") : updateStatus === "restart" || updateStatus === "applied" ? updateMessage : updateStatus === "ok" ? updateAvailable ? t("versionNew", { version: updateLatest }) : t("versionLatest") : "";
        const updateTone = updateStatus === "failed" ? TOKENS.error : updateStatus === "restart" || updateStatus === "applied" || updateAvailable ? TOKENS.success : TOKENS.muted;
        const versionBox = h("div", {
          key: "version",
          "data-field": "version",
          className: "mov-card"
        }, [
          h("div", { key: "head", className: "mov-card-head" }, [
            h("span", { key: "title", className: "mov-card-title" }, t("versionTitle")),
            h("span", {
              key: "current",
              "data-field": "versionCurrent",
              className: "mov-hint mov-current-version"
            }, [
              h("span", { key: "label" }, PLUGIN_VERSION ? t("versionCurrent", { version: PLUGIN_VERSION }) : ""),
              updateBell(t, updateLatest, PLUGIN_VERSION)
            ]),
            h("a", { key: "history", className: "mov-hint", href: "${CHANGELOG_URL}", target: "_blank", rel: "noopener noreferrer" }, t("versionHistory")),
            h("button", {
              key: "check",
              "data-action": "update-check",
              type: "button",
              className: "mov-btn mov-btn-sm mov-trailing",
              disabled: updateStatus === "working" || updateStatus === "installing",
              onClick: () => {
                checkForUpdate(false).catch(() => {
                });
              }
            }, updateStatus === "working" ? t("versionChecking") : t("versionCheck"))
          ]),
          releaseNotes?.items?.length ? h("div", { key: "release-notes", "data-field": "releaseNotes" }, [
            h("div", { key: "heading", style: { display: "flex", alignItems: "baseline", gap: 12 } }, [
              h("span", { key: "title", className: "mov-card-title" }, `${releaseNotes.version} \xB7 ${t("releaseNotesTitle")}`),
              formatReleaseTime(releaseNotes.publishedAt) ? h("span", { key: "published-at", "data-field": "releasePublishedAt", className: "mov-foot-note" }, t("releaseUpdatedAt", { time: formatReleaseTime(releaseNotes.publishedAt) })) : null
            ]),
            h(
              "ul",
              { key: "items", style: { margin: "8px 0 0", paddingLeft: 18, fontSize: 12, lineHeight: 1.7, color: TOKENS.muted } },
              releaseNotes.items.map((item, index) => h("li", { key: index }, item))
            )
          ]) : null,
          updateText ? h("span", {
            key: "state",
            "data-field": "versionState",
            className: "mov-hint",
            style: { color: updateTone }
          }, updateText) : null,
          updateAvailable ? h("div", { key: "command", className: "mov-cmd-row" }, [
            // 点一下转成「确认更新」，再点一下让宿主重装本插件
            h("button", {
              key: "online",
              "data-action": "update-online",
              type: "button",
              className: "mov-btn mov-btn-sm mov-btn-primary",
              disabled: updateStatus === "installing",
              onClick: () => {
                if (updateConfirm) runOnlineUpdate().catch(() => {
                });
                else setUpdateConfirm(true);
              }
            }, updateStatus === "installing" ? t("versionUpdating") : updateConfirm ? t("versionUpdateConfirm", { version: updateLatest }) : t("versionUpdate"))
          ]) : null,
          updateAvailable && updateConfirm ? h("span", {
            key: "confirm-hint",
            "data-field": "updateConfirmHint",
            className: "mov-hint"
          }, t("versionUpdateConfirmHint")) : null,
          updateAvailable ? h("span", { key: "hint", className: "mov-hint" }, t("versionHint")) : null,
          updateStatus === "ok" && updateAt ? h("span", { key: "at", className: "mov-foot-note" }, t("versionCheckedAt", { time: updateAt })) : null
        ]);
        let notice = null;
        if (snapshot.status === "loading") notice = t("loading");
        else if (snapshot.value === void 0) notice = t("unavailable");
        else if (snapshot.writable === false) notice = t("readOnly");
        const blobs = notice && !snapshot.value ? [] : [footer, versionBox, connectionBox, resetRow];
        return h("div", { className: "mov-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
          h(
            "div",
            { key: "support-actions", className: "mov-card-head", style: { justifyContent: "flex-end", marginBottom: 12 } },
            h("button", {
              key: "support",
              type: "button",
              className: "mov-btn mov-btn-sm",
              "data-action": "contact-support",
              "aria-haspopup": "dialog",
              "aria-expanded": supportOpen,
              onClick: () => setSupportOpen(true)
            }, t("supportContact"))
          ),
          !notice || snapshot.value ? renderUpdateNotice({
            h,
            t,
            available: updateAvailable,
            latest: updateLatest,
            deferred: updateDeferred,
            status: updateStatus,
            confirmed: updateConfirm,
            onUpdate: () => {
              if (updateConfirm) runOnlineUpdate().catch(() => {
              });
              else setUpdateConfirm(true);
            },
            onLater: deferUpdate
          }) : null,
          notice ? h("p", { key: "notice", className: "mov-notice" }, notice) : null,
          ...notice && !snapshot.value ? [] : settingsRows(),
          ...blobs,
          supportOpen ? h("dialog", {
            key: "support-dialog",
            ref: supportDialog,
            className: "mov-support-dialog",
            "aria-labelledby": "mov-support-title",
            onCancel: () => setSupportOpen(false),
            onClose: () => setSupportOpen(false),
            onClick: (event) => {
              if (event.target === event.currentTarget) {
                const rect = event.currentTarget.getBoundingClientRect();
                if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setSupportOpen(false);
              }
            }
          }, h("div", { className: "mov-support-content" }, [
            h("div", { key: "heading", className: "mov-card-head" }, [
              h("strong", { key: "title", id: "mov-support-title" }, t("supportContact")),
              h("button", { key: "close", type: "button", className: "mov-btn mov-btn-sm mov-trailing", "aria-label": t("supportClose"), onClick: () => setSupportOpen(false) }, t("supportClose"))
            ]),
            h("p", { key: "hint", className: "mov-hint" }, t("supportScan")),
            h("iframe", { key: "qr", className: "mov-support-frame", title: t("supportContact"), src: SUPPORT_URL, referrerPolicy: "no-referrer" }),
            h("a", { key: "fallback", href: SUPPORT_URL, target: "_blank", rel: "noopener noreferrer" }, t("supportOpenPage"))
          ])) : null
        ]);
      };
    }
    return { makePage };
  }

  // src/client/update-hint.ts
  var UPDATE_HINT_CSS = `
  .mov-rail-hint { position: relative; display: inline-flex; align-items: center; }
  /* \u6536\u8D77\u4FA7\u680F\uFF1A\u7EA2\u70B9\u843D\u5728\u56FE\u6807\u53F3\u4E0A\u89D2 */
  .mov-rail-dot {
    position: absolute; top: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    box-shadow: 0 0 0 2px var(--dsw-specific-sidebar-fill, transparent);
  }
  /* \u5C55\u5F00\u4FA7\u680F\uFF1A\u8FD9\u4E00\u884C\u6709\u540D\u5B57\uFF0C\u7EC4\u4EF6\u91CC\u7684\u5706\u70B9\u6536\u8D77\uFF0C\u6539\u5728\u540D\u5B57\u6700\u540E\u4E00\u4E2A\u5B57\u7684\u53F3\u4E0A\u89D2\u70B9\u4E00\u4E2A\u89D2\u6807\uFF1B\u8D34\u7740\u5B57\u4E0D\u538B\u5B57\uFF0C\u6240\u4EE5\u4E0D\u63CF\u8FB9 */
  button:has(.mov-rail-dot):has(> span:nth-child(2)) .mov-rail-dot { display: none; }
  button:has(.mov-rail-dot):has(> span:nth-child(2)) > span:nth-child(2)::after {
    content: ""; display: inline-block; width: 8px; height: 8px; margin-left: -1px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    vertical-align: super;
  }
`;
  function ensureUpdateHintStyles(doc = typeof document === "undefined" ? null : document) {
    if (!doc || typeof doc.createElement !== "function" || !doc.head) return false;
    if (doc.head.querySelector("style[data-mov-update-hint]")) return true;
    const style = doc.createElement("style");
    style.setAttribute("data-mov-update-hint", "");
    style.textContent = UPDATE_HINT_CSS;
    doc.head.append(style);
    return true;
  }
  function createUpdateHint({ version = "", isNewerVersion, fetchRecentVersions, cacheKey, maxAge, deferKey = `${cacheKey}.deferred` }) {
    const listeners = /* @__PURE__ */ new Set();
    let latest = "", versions = [], at = 0, deferred = readDeferred(), checking = null;
    function storage() {
      try {
        return window.localStorage;
      } catch {
        return null;
      }
    }
    function readDeferred() {
      try {
        return String(storage()?.getItem(deferKey) || "");
      } catch {
        return "";
      }
    }
    function readCache() {
      try {
        const saved = JSON.parse(String(storage()?.getItem(cacheKey) || "null"));
        if (!saved || typeof saved !== "object") return { latest: "", versions: [], at: 0 };
        return {
          latest: String(saved.latest || ""),
          versions: Array.isArray(saved.versions) ? saved.versions.filter((item) => /^\d+\.\d+\.\d+$/.test(String(item))).slice(0, 3) : [],
          at: Number(saved.at) || 0
        };
      } catch {
        return { latest: "", versions: [], at: 0 };
      }
    }
    function writeCache() {
      try {
        storage()?.setItem(cacheKey, JSON.stringify({ at, latest, versions }));
      } catch {
      }
    }
    function newer(remote) {
      try {
        return isNewerVersion?.(remote, version) === true;
      } catch {
        return false;
      }
    }
    const pending = () => Boolean(latest) && latest !== deferred && newer(latest);
    function snapshot() {
      return { latest, versions: [...versions], at, deferred, version, checking: Boolean(checking), pending: pending() };
    }
    function emit() {
      for (const listener of [...listeners]) {
        try {
          listener(snapshot());
        } catch {
        }
      }
    }
    function subscribe(listener) {
      listeners.add(listener);
      return () => {
        listeners.delete(listener);
      };
    }
    function sync() {
      const cached = readCache(), nextDeferred = readDeferred();
      const changed = cached.latest !== latest || cached.at !== at || nextDeferred !== deferred;
      latest = cached.latest;
      versions = cached.versions;
      at = cached.at;
      deferred = nextDeferred;
      if (changed) emit();
      return snapshot();
    }
    function refresh(force = false) {
      sync();
      if (checking) return checking;
      if (!force && at && Date.now() - at < maxAge) return Promise.resolve(snapshot());
      checking = (async () => {
        try {
          const list = await fetchRecentVersions();
          const next = (Array.isArray(list) ? list : []).map(String).filter((item) => /^\d+\.\d+\.\d+$/.test(item)).slice(0, 3);
          if (next.length) {
            latest = next[0];
            versions = next;
            at = Date.now();
            writeCache();
          }
        } catch {
        } finally {
          checking = null;
          emit();
        }
        return snapshot();
      })();
      emit();
      return checking;
    }
    function defer() {
      deferred = latest;
      try {
        storage()?.setItem(deferKey, latest);
      } catch {
      }
      emit();
      return snapshot();
    }
    function forget() {
      latest = "";
      versions = [];
      at = 0;
      deferred = "";
      try {
        storage()?.removeItem(cacheKey);
        storage()?.removeItem(deferKey);
      } catch {
      }
      emit();
      return snapshot();
    }
    return { snapshot, pending, subscribe, sync, refresh, defer, forget, readCache };
  }
  function createUpdateHintView({
    React,
    h,
    t,
    hint,
    version,
    isNewerVersion,
    manager,
    pluginPackage,
    updateSpec,
    updateAttempts,
    cacheKey,
    maxAge
  }) {
    function useUpdateHint() {
      const [value, setValue] = React.useState(() => hint.snapshot());
      React.useEffect(() => hint.subscribe(() => setValue(hint.snapshot())), []);
      return value;
    }
    function UpdateHintDot() {
      const state = useUpdateHint();
      if (!state.pending) return null;
      return h("span", { key: "dot", className: "mov-rail-dot", "aria-hidden": true, title: t("sidebarUpdateBadge") });
    }
    function UpdateHintBanner() {
      const state = useUpdateHint();
      const [status, setStatus] = React.useState("idle");
      const [message, setMessage] = React.useState("");
      const [confirm, setConfirm] = React.useState(false);
      const { forgetUpdateCheck, runOnlineUpdate } = createUpdateActions({
        get UPDATE_CACHE_KEY() {
          return cacheKey;
        },
        get UPDATE_MAX_AGE_MS() {
          return maxAge;
        },
        get PLUGIN_VERSION() {
          return version;
        },
        get isNewerVersion() {
          return isNewerVersion;
        },
        get PLUGIN_PACKAGE() {
          return pluginPackage;
        },
        get UPDATE_SPEC() {
          return updateSpec;
        },
        get UPDATE_ATTEMPTS() {
          return updateAttempts;
        },
        get manager() {
          return manager;
        },
        get t() {
          return t;
        },
        get updateLatest() {
          return hint.snapshot().latest;
        },
        get updateConfirm() {
          return confirm === true;
        },
        get forgetUpdateCheck() {
          return forgetUpdateCheck;
        },
        setUpdateConfirm(value) {
          setConfirm(value === true);
        },
        setUpdateStatus(value) {
          setStatus(value);
        },
        setUpdateMessage(value) {
          setMessage(value);
        },
        setUpdateLatest() {
        },
        setUpdateAt() {
        },
        setUpdateDeferred() {
        }
      });
      React.useEffect(() => {
        void hint.refresh(false);
      }, []);
      if (!state.pending && status === "idle") return null;
      const line = status === "installing" ? t("versionUpdating") : message;
      return h("div", { key: "update-hint", className: "mov-panel-update", "data-field": "panel-update" }, [
        renderUpdateNotice({
          h,
          t,
          available: state.pending,
          latest: state.latest,
          deferred: state.deferred,
          status,
          confirmed: confirm,
          onLater: () => {
            setConfirm(false);
            hint.defer();
          },
          onUpdate: () => {
            if (!confirm) {
              setConfirm(true);
              return;
            }
            void runOnlineUpdate().then(() => hint.sync());
          }
        }),
        line ? h("p", { key: "line", className: "mov-panel-update-line", "data-field": "panel-update-line" }, line) : null
      ]);
    }
    return { useUpdateHint, UpdateHintDot, UpdateHintBanner };
  }

  // src/businesses/video/client/panel.ts
  function createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID: PANEL_ID2, GUIDE_URL: GUIDE_URL2, LOGO_SVG }) {
    const LOGO_SRC = LOGO_SVG ? `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}` : "";
    const PANEL_CSS = `
      .mov-panel { width: 100%; max-width: 880px; margin: 0 auto; padding: 30px 32px 44px; display: flex; flex-direction: column; gap: 18px; }
      /* \u6709\u66F4\u65B0\u65F6\u7684\u9876\u90E8\u63D0\u793A\uFF1A\u6CBF\u7528\u8BBE\u7F6E\u9875\u7684 .mov-notice\uFF0C\u53EA\u8865\u9762\u677F\u91CC\u7684\u95F4\u8DDD\u4E0E\u5DE6\u4FA7\u8272\u6761 */
      .mov-panel-update { display: flex; flex-direction: column; gap: 8px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-left: 3px solid ${TOKENS.primaryFill}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .mov-panel-update .mov-notice strong { display: block; font-size: 13px; color: ${TOKENS.text}; }
      .mov-panel-update-line { margin: 0; font-size: 12px; line-height: 1.5; color: ${TOKENS.muted}; }
      /* \u54C1\u724C\u5934\u56FE\uFF1A\u63D2\u4EF6 logo + \u6807\u9898/\u7B80\u4ECB\uFF0C\u7ED9\u7A7A\u8361\u7684\u5185\u5BB9\u533A\u4E00\u4E2A\u89C6\u89C9\u951A\u70B9 */
      .mov-panel-hero { display: flex; align-items: center; gap: 14px; }
      .mov-panel-mark { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: ${TOKENS.primaryFill}; }
      .mov-panel-logo { width: 100%; height: 100%; object-fit: contain; }
      /* \u5DE6\u4FA7\u680F\u90A3\u4E00\u884C\u7684 logo\uFF1A\u6309\u5BBF\u4E3B\u7ED9\u7684\u5C3A\u5BF8\u539F\u6837\u94FA\u5F00\uFF0C\u4E0D\u53C2\u4E0E\u4E3B\u9898\u53D6\u8272 */
      .mov-rail-logo { display: block; object-fit: contain; }
      .mov-panel-head { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .mov-panel-title { margin: 0; font-size: 19px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-intro { margin: 0; font-size: 13px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* \u4E3B\u6309\u94AE\u5403\u6389\u591A\u4F59\u5BBD\u5EA6\uFF0C\u6B21\u8981\u6309\u94AE\u4E0E\u94FE\u63A5\u9000\u5230\u7B2C\u4E8C\u6392 */
      .mov-panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .mov-panel-actions .mov-btn-primary { flex: 1 1 220px; width: auto; min-width: 160px; height: 38px; }
      .mov-panel-actions .mov-btn:not(.mov-btn-primary) { min-width: 132px; }
      .mov-panel-link { margin-left: auto; font-size: 12px; color: ${TOKENS.primaryFill}; text-decoration: none; border-bottom: 1px solid transparent; }
      .mov-panel-link:hover { border-bottom-color: currentColor; }
      /* \u4E24\u5757\u4EF7\u503C\u70B9\u5361\u7247\uFF1A\u56FE\u6807 + \u6807\u9898 + \u4E00\u53E5\u8BF4\u660E\uFF0C\u7A84\u5BB9\u5668\u81EA\u52A8\u843D\u6210\u4E00\u5217 */
      .mov-panel-highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
      .mov-panel-highlight { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .mov-panel-highlight-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; }
      .mov-panel-highlight-body { min-width: 0; }
      .mov-panel-highlight-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-highlight-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* \u6D41\u7A0B\u6F14\u793A\uFF1A\u56DB\u6B65\u5361\u7247\u6A2A\u6392\uFF0C\u5361\u7247\u4E4B\u95F4\u7528\u7BAD\u5934\u8FDE\u8D77\u6765\uFF1B\u7A84\u5BB9\u5668\u843D\u6210\u4E00\u5217 */
      .mov-panel-flow { display: flex; align-items: stretch; }
      .mov-panel-step { position: relative; overflow: hidden; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 7px; padding: 13px 14px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; animation: mov-flow-card 9s ease-in-out infinite; }
      .mov-panel-step-head { display: flex; align-items: center; gap: 8px; }
      .mov-panel-step-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 600; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; animation: mov-flow-badge 9s ease-in-out infinite; }
      .mov-panel-step-title { min-width: 0; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-step-desc { margin: 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* \u53F3\u4E0A\u89D2\u7684\u6DE1\u8272\u6C34\u5370\u56FE\u6807\uFF0C\u53EA\u505A\u88C5\u9970 */
      .mov-panel-step-icon { position: absolute; top: 10px; right: 10px; color: ${TOKENS.primaryFill}; opacity: .14; pointer-events: none; }
      /* \u5361\u7247\u4E4B\u95F4\u7684\u7BAD\u5934\uFF1A\u6A2A\u6392\u65F6\u5411\u53F3\uFF0C\u7A84\u5BB9\u5668\u91CC\u8F6C\u6210\u5411\u4E0B */
      .mov-panel-conn { flex: 0 0 26px; align-self: center; height: 2px; border-radius: 1px; background: ${TOKENS.border}; position: relative; }
      .mov-panel-conn::after { content: ''; position: absolute; top: 50%; right: -1px; width: 5px; height: 5px; border-top: 2px solid ${TOKENS.border}; border-right: 2px solid ${TOKENS.border}; transform: translateY(-50%) rotate(45deg); }
      /* \u56DB\u6B65\u4F9D\u6B21\u70B9\u4EAE\uFF0C\u5F62\u6210\u4E00\u6761\u8D70\u52A8\u7684\u6D41\u7A0B\uFF1B\u5EF6\u8FDF\u6309\u6B65\u53F7\u9519\u5F00 */
      @keyframes mov-flow-card { 0%, 16% { border-color: ${TOKENS.primaryFill}; } 28%, 100% { border-color: ${TOKENS.border}; } }
      @keyframes mov-flow-badge { 0%, 16% { color: #fff; background: ${TOKENS.primaryFill}; } 28%, 100% { color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; } }
      .mov-panel-step[data-step="1"], .mov-panel-step[data-step="1"] .mov-panel-step-badge { animation-delay: 2.25s; }
      .mov-panel-step[data-step="2"], .mov-panel-step[data-step="2"] .mov-panel-step-badge { animation-delay: 4.5s; }
      .mov-panel-step[data-step="3"], .mov-panel-step[data-step="3"] .mov-panel-step-badge { animation-delay: 6.75s; }
      .mov-panel { container-type: inline-size; }
      @container (max-width: 620px) {
        .mov-panel-flow { flex-direction: column; align-items: stretch; }
        /* \u7AD6\u5411\u6392\u5E03\u65F6\u4E0D\u80FD\u518D\u6309\u5269\u4F59\u7A7A\u95F4\u62C9\u4F38\uFF0C\u5426\u5219\u5361\u7247\u4F1A\u88AB\u538B\u6241 */
        .mov-panel-step { flex: 0 0 auto; }
        .mov-panel-conn { flex: 0 0 18px; width: 2px; height: 18px; align-self: flex-start; margin-left: 24px; }
        .mov-panel-conn::after { top: auto; right: 50%; bottom: -1px; transform: translateX(50%) rotate(135deg); }
      }
      @container (max-width: 560px) {
        .mov-panel { padding: 22px 18px 34px; }
        .mov-panel-link { margin-left: 0; }
      }
      @media (prefers-reduced-motion: reduce) {
        .mov-panel-step, .mov-panel-step-badge { animation: none; }
      }
    `;
    function PanelIcon({ size = 18 }) {
      const pixels = Number(size) || 18;
      if (LOGO_SRC) {
        return h("img", {
          className: "mov-rail-logo",
          src: LOGO_SRC,
          alt: "",
          width: pixels,
          height: pixels,
          "aria-hidden": true
        });
      }
      return h("svg", {
        width: pixels,
        height: pixels,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.7,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
      }, [
        h("rect", { key: "frame", x: 2.5, y: 4.5, width: 13.5, height: 15, rx: 2.5 }),
        h("path", { key: "lens", d: "M16 10.4 21.5 7.3v9.4L16 13.6z" })
      ]);
    }
    function flowIcon(name, size = 22) {
      const common = {
        width: size,
        height: size,
        viewBox: "0 0 24 24",
        fill: "none",
        stroke: "currentColor",
        strokeWidth: 1.6,
        strokeLinecap: "round",
        strokeLinejoin: "round",
        "aria-hidden": true
      };
      if (name === "idea") {
        return h("svg", common, [
          h("path", { key: "bulb", d: "M12 3.5a5.5 5.5 0 0 0-3.2 9.9V16h6.4v-2.6A5.5 5.5 0 0 0 12 3.5Z" }),
          h("path", { key: "base", d: "M9.5 18.5h5M10.5 21h3" })
        ]);
      }
      if (name === "script") {
        return h("svg", common, [
          h("rect", { key: "frame", x: 3, y: 4.5, width: 18, height: 15, rx: 2.2 }),
          h("path", { key: "split", d: "M3 12h18M11 12v7.5" })
        ]);
      }
      if (name === "generate") {
        return h("svg", common, [
          h("rect", { key: "frame", x: 3, y: 5, width: 18, height: 14, rx: 2.2 }),
          h("path", { key: "play", d: "M10.4 9.4 15 12l-4.6 2.6z" })
        ]);
      }
      if (name === "easy") {
        return h("svg", common, [
          h("path", { key: "star", d: "M12 4.2l1.9 5.1 5.1 1.9-5.1 1.9L12 18.2l-1.9-5.1L5 11.2l5.1-1.9z" }),
          h("path", { key: "spark", d: "M19 4.2v3M17.5 5.7h3" })
        ]);
      }
      if (name === "cheap") {
        return h("svg", common, [
          h("path", { key: "tag", d: "M11.2 3.8H5.4A1.6 1.6 0 0 0 3.8 5.4v5.8l8.8 8.8a1.6 1.6 0 0 0 2.3 0l5.8-5.8a1.6 1.6 0 0 0 0-2.3z" }),
          h("circle", { key: "hole", cx: 7.6, cy: 7.6, r: 1.2 })
        ]);
      }
      return h("svg", common, [
        h("path", { key: "down", d: "M12 3.5v10m0 0 3.6-3.6M12 13.5 8.4 9.9" }),
        h("path", { key: "tray", d: "M4.5 16.5v2.2a2 2 0 0 0 2 2h11a2 2 0 0 0 2-2v-2.2" })
      ]);
    }
    function highlight(key, icon, title, desc) {
      return h("div", { key, className: "mov-panel-highlight" }, [
        h("span", { key: "icon", className: "mov-panel-highlight-icon" }, flowIcon(icon, 20)),
        h("div", { key: "body", className: "mov-panel-highlight-body" }, [
          h("div", { key: "title", className: "mov-panel-highlight-title" }, title),
          h("p", { key: "desc", className: "mov-panel-highlight-desc" }, desc)
        ])
      ]);
    }
    function VideoPanel(props) {
      const flow = [
        { icon: "idea", title: t("panelStep1Title"), desc: t("panelStep1Desc") },
        { icon: "script", title: t("panelStep2Title"), desc: t("panelStep2Desc") },
        { icon: "generate", title: t("panelStep3Title"), desc: t("panelStep3Desc") },
        { icon: "merge", title: t("panelStep4Title"), desc: t("panelStep4Desc") }
      ];
      const flowChildren = flow.flatMap((step, index) => {
        const card = h("div", {
          key: `step-${index}`,
          className: "mov-panel-step",
          "data-step": String(index)
        }, [
          h("div", { key: "head", className: "mov-panel-step-head" }, [
            h("span", { key: "badge", className: "mov-panel-step-badge" }, String(index + 1)),
            h("span", { key: "title", className: "mov-panel-step-title" }, step.title)
          ]),
          h("p", { key: "desc", className: "mov-panel-step-desc" }, step.desc),
          h("span", { key: "icon", className: "mov-panel-step-icon" }, flowIcon(step.icon))
        ]);
        return index === 0 ? [card] : [h("span", { key: `conn-${index}`, className: "mov-panel-conn", "aria-hidden": true }), card];
      });
      return h("div", { className: "mov-panel" }, [
        h("style", { key: "styles" }, PAGE_CSS + PANEL_CSS),
        // 有更新时面板最上面插一条提示：入口由 client.ts 用真实 React 渲染，面板本身不持有更新状态。
        props?.updateBanner?.() || null,
        h("header", { key: "hero", className: "mov-panel-hero" }, [
          h(
            "span",
            { key: "mark", className: "mov-panel-mark" },
            LOGO_SRC ? h("img", { key: "logo", className: "mov-panel-logo", src: LOGO_SRC, alt: "", "aria-hidden": true }) : PanelIcon({ size: 24 })
          ),
          h("div", { key: "head", className: "mov-panel-head" }, [
            h("h1", { key: "title", className: "mov-panel-title" }, t("panelTitle")),
            h("p", { key: "intro", className: "mov-panel-intro" }, t("panelIntro"))
          ])
        ]),
        h("section", { key: "highlights", className: "mov-section" }, [
          h("div", { key: "highlights-label", className: "mov-section-title" }, t("panelHighlights")),
          h("div", { key: "highlights-cards", className: "mov-panel-highlights" }, [
            highlight("easy", "easy", t("panelHighlight1Title"), t("panelHighlight1Desc")),
            highlight("cheap", "cheap", t("panelHighlight2Title"), t("panelHighlight2Desc"))
          ])
        ]),
        h("section", { key: "start", className: "mov-section" }, [
          h("div", { key: "start-label", className: "mov-section-title" }, t("panelStart")),
          h("div", { key: "start-actions", className: "mov-panel-actions" }, [
            h("button", {
              key: "new",
              type: "button",
              className: "mov-btn mov-btn-primary",
              onClick: () => props?.startSession?.()
            }, t("panelNew")),
            h("button", {
              key: "settings",
              type: "button",
              className: "mov-btn",
              disabled: typeof props?.openSettings !== "function",
              onClick: () => props?.openSettings?.()
            }, t("panelSettings")),
            h("a", {
              key: "guide",
              className: "mov-panel-link",
              href: GUIDE_URL2,
              target: "_blank",
              rel: "noopener noreferrer"
            }, t("panelGuide"))
          ])
        ]),
        h("section", { key: "flow", className: "mov-section" }, [
          h("div", { key: "flow-label", className: "mov-section-title" }, t("panelFlow")),
          h("div", { key: "flow-steps", className: "mov-panel-flow" }, flowChildren)
        ])
      ]);
    }
    return { PANEL_ID: PANEL_ID2, PanelIcon, VideoPanel };
  }

  // src/businesses/video/integrations/canvas-stages.ts
  var STAGE_REV = 2;
  var STAGE_KEYS = ["requirement", "script", "storyboard", "assets", "cost", "segments", "film"];
  var STAGE_LABELS = {
    requirement: "\u2460 \u9700\u6C42\u786E\u8BA4",
    script: "\u2461 \u811A\u672C\u5BA1\u6838",
    storyboard: "\u2462 \u5206\u955C\u786E\u8BA4",
    assets: "\u2463 \u7D20\u6750\u51C6\u5907",
    cost: "\u2464 \u8D39\u7528\u786E\u8BA4",
    segments: "\u2465 \u9010\u6BB5\u5236\u4F5C",
    film: "\u2466 \u5408\u6210\u6210\u7247"
  };
  var STAGE_STATE_TEXT = { done: "\u5DF2\u5B8C\u6210", active: "\u8FDB\u884C\u4E2D", review: "\u5F85\u5BA1\u6838", ready: "\u5F85\u5408\u6210", pending: "\u672A\u5F00\u59CB" };
  var STAGE_ACTIONS = {
    requirement: { label: "\u586B\u9700\u6C42", hint: "\u5199\u60F3\u62CD\u4EC0\u4E48\u3001\u603B\u65F6\u957F\u3001\u6BCF\u6BB5\u65F6\u957F\u3001\u753B\u5E45\u4E0E\u6E05\u6670\u5EA6\uFF0C\u4E5F\u53EF\u4EE5\u8BA9\u6587\u672C\u6A21\u578B\u628A\u60F3\u6CD5\u5199\u6210\u5267\u672C\uFF08\u6587\u672C\u6309\u7528\u91CF\u5355\u72EC\u8BA1\u8D39\uFF09\uFF1B\u94FA\u8282\u70B9\u672C\u8EAB\u4E0D\u4EA7\u751F\u89C6\u9891\u8D39\u7528" },
    script: { label: "\u770B\u5267\u672C", hint: "\u6253\u5F00\u5267\u672C\u8282\u70B9\u6838\u5BF9\u6216\u4FEE\u6539\u5185\u5BB9\uFF0C\u5206\u955C\u4E0E\u5206\u6BB5\u8BA1\u5212\u968F\u811A\u672C\u4E00\u8D77\u94FA\u5F00\uFF1B\u8FD9\u4E00\u6B65\u53EA\u6539\u8282\u70B9\u5185\u5BB9\uFF0C\u4E0D\u751F\u6210\u89C6\u9891\u3001\u4E0D\u8BA1\u8D39" },
    storyboard: { label: "\u770B\u5206\u955C", hint: "\u6253\u5F00\u5206\u955C\u8282\u70B9\u6838\u5BF9\u6BCF\u4E2A\u955C\u5934\u7684\u753B\u9762\u3001\u666F\u522B\u3001\u89C6\u89D2\u4E0E\u8FD0\u955C\uFF1B\u6CA1\u8BC6\u522B\u5230\u5206\u955C\u8868\u65F6\u6309\u573A\u666F\u4E0E\u53E5\u5B50\u5207\u6BB5\uFF0C\u8FD9\u4E00\u6B65\u53EA\u6539\u5185\u5BB9\u3001\u4E0D\u751F\u6210\u89C6\u9891\u3001\u4E0D\u8BA1\u8D39" },
    assets: { label: "\u51C6\u5907\u7D20\u6750", hint: "\u9010\u6BB5\u751F\u6210\u524D\u628A\u89D2\u8272\u56FE\u3001\u9996\u5E27\u6216\u53C2\u8003\u56FE\u51C6\u5907\u597D\uFF1A\u53EF\u4EE5\u5BFC\u5165\u81EA\u5DF1\u7684\u56FE\uFF0C\u4E5F\u53EF\u4EE5\u5728\u56FE\u7247\u8282\u70B9\u91CC\u8BA9\u6A21\u578B\u751F\u6210\uFF08\u56FE\u7247\u5355\u72EC\u8BA1\u8D39\u5E76\u8981\u5BA1\u6838\uFF09\uFF1B\u771F\u4EBA\u7167\u7247\u8981\u5148\u8F6C\u6210\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u98CE\u683C" },
    cost: { label: "\u770B\u4F30\u4EF7", hint: "\u5217\u51FA\u6BCF\u6BB5\u63D0\u793A\u8BCD\u3001\u65F6\u957F\u4E0E\u6574\u6761\u94FE\u8DEF\u7684\u9884\u4F30\u5408\u8BA1\uFF0C\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528\u540E\u624D\u5F00\u8DD1" },
    segments: { label: "\u505A\u8FD9\u4E00\u6BB5", hint: "\u6253\u5F00\u5F53\u524D\u8FD8\u6CA1\u6210\u679C\u7684\u5236\u4F5C\u8282\u70B9\uFF0C\u6838\u5BF9\u5236\u4F5C\u65B9\u6848\u5E76\u5355\u72EC\u786E\u8BA4\u8D39\u7528\u540E\u624D\u4F1A\u8C03\u7528\u6A21\u578B" },
    film: { label: "\u5408\u6210\u6210\u7247", hint: "\u628A\u5DF2\u6709\u6210\u679C\u6309\u8FDE\u7EBF\u987A\u5E8F\u62FC\u6210\u4E00\u6761\u6210\u7247\uFF0C\u53EA\u8BFB\u6210\u679C\u3001\u4E0D\u91CD\u65B0\u751F\u6210\u3001\u4E0D\u989D\u5916\u8BA1\u8D39" }
  };
  function stageAction(key) {
    return STAGE_ACTIONS[key] || null;
  }
  var STAGE_DRAFT_ACTION = {
    script: { label: "\u5199\u811A\u672C", hint: "\u6309\u7B2C\u4E00\u6B65\u521B\u5EFA\u7684\u9700\u6C42\u5199\u5267\u672C\u4E0E\u5206\u955C\uFF08\u53EF\u4EE5\u8BA9\u6587\u672C\u6A21\u578B\u5199\uFF0C\u4E5F\u53EF\u4EE5\u81EA\u5DF1\u5199\uFF0C\u6587\u672C\u6309\u7528\u91CF\u5355\u72EC\u8BA1\u8D39\uFF09\uFF1B\u8FD9\u4E00\u6B65\u53EA\u51FA\u5267\u672C\u4E0E\u5206\u955C\u3001\u4E0D\u751F\u6210\u89C6\u9891\u3001\u4E0D\u4EA7\u751F\u89C6\u9891\u8D39\u7528\uFF0C\u5199\u597D\u540E\u5148\u6838\u5BF9\u6BCF\u6BB5\u63D0\u793A\u8BCD\uFF0C\u518D\u786E\u8BA4\u811A\u672C" }
  };
  var STAGE_STORYBOARD_ACTION = {
    storyboard: { label: "\u751F\u6210\u5206\u955C", hint: "\u6309\u5DF2\u5BA1\u6838\u7684\u811A\u672C\u5207\u5206\u955C\u4E0E\u6BCF\u6BB5\u63D0\u793A\u8BCD\uFF1A\u5199\u6210 Markdown \u5206\u955C\u8868\u5C31\u6309\u955C\u53F7\u5207\u6BB5\uFF0C\u5426\u5219\u6309\u573A\u666F\u4E0E\u53E5\u5B50\u5207\u6BB5\uFF1B\u8FD9\u4E00\u6B65\u53EA\u94FA\u8282\u70B9\u3001\u4E0D\u751F\u6210\u89C6\u9891\u3001\u4E0D\u4EA7\u751F\u89C6\u9891\u8D39\u7528" }
  };
  var STAGE_REVIEW_ACTION = {
    script: { label: "\u786E\u8BA4\u811A\u672C", hint: "\u6838\u5BF9\u8FC7\u5267\u672C\u4E0E\u6BCF\u6BB5\u63D0\u793A\u8BCD\u5C31\u70B9\u8FD9\u91CC\uFF1A\u811A\u672C\u5BA1\u6838\u901A\u8FC7\u540E\u9636\u6BB5\u5361\u2461\u6807\u4E3A\u5DF2\u5B8C\u6210\uFF0C\u63A5\u7740\u770B\u6574\u6761\u94FE\u8DEF\u4F30\u4EF7\uFF1B\u8D39\u7528\u4ECD\u9010\u6BB5\u5355\u72EC\u786E\u8BA4" }
  };
  var STAGE_EDIT_ACTION = {
    requirement: { label: "\u6539\u9700\u6C42", hint: "\u9700\u6C42\u5DF2\u521B\u5EFA\uFF1A\u8981\u6539\u60F3\u62CD\u4EC0\u4E48\u3001\u603B\u65F6\u957F\u3001\u6BCF\u6BB5\u65F6\u957F\u3001\u753B\u5E45\u6216\u6E05\u6670\u5EA6\u5C31\u70B9\u8FD9\u91CC\uFF0C\u6539\u7684\u662F\u9700\u6C42\u8282\u70B9\u4E0E\u9636\u6BB5\u5361\u3001\u4E0D\u8C03\u7528\u6A21\u578B\u4E5F\u4E0D\u8BA1\u8D39\uFF1B\u5DF2\u94FA\u5F00\u7684\u811A\u672C\u4E0E\u5236\u4F5C\u6BB5\u4E0D\u53D7\u5F71\u54CD\uFF0C\u8981\u987A\u7740\u65B0\u89C4\u683C\u91CD\u505A\u5C31\u5220\u9664\u65E7\u8282\u70B9\u518D\u8D70\u4E00\u904D" }
  };
  function pendingStageAction(key, facts) {
    if (key === "requirement") return facts?.requirementSettled ? STAGE_EDIT_ACTION.requirement : null;
    if (key === "storyboard") return facts?.storyboardReady ? null : STAGE_STORYBOARD_ACTION.storyboard;
    if (key !== "script") return null;
    if (!facts?.scriptDrafted) return STAGE_DRAFT_ACTION.script;
    return facts?.scriptApproved !== true ? STAGE_REVIEW_ACTION.script : null;
  }
  function stageNodeId(prefix, key) {
    return `${prefix}_stage_${key}`;
  }
  var REQUIREMENT_MARK = "metaonticRequirement";
  function requirementNodeData(brief, seconds, segmentSeconds, ratio, resolution, workType) {
    const text = [
      `\u60F3\u62CD\u4EC0\u4E48\uFF1A${brief}`,
      `\u76EE\u6807\u603B\u65F6\u957F\uFF1A${seconds} \u79D2`,
      `\u6BCF\u6BB5\u65F6\u957F\uFF1A${segmentSeconds} \u79D2`,
      `\u753B\u5E45\uFF1A${ratio}`,
      `\u6E05\u6670\u5EA6\uFF1A${String(resolution).toUpperCase()}`
    ].join("\n");
    return {
      label: "\u9700\u6C42",
      text,
      status: "done",
      [REQUIREMENT_MARK]: true,
      metaonticRequirementBrief: brief,
      metaonticRequirementSpec: { seconds, segmentSeconds, ratio, resolution, ...workType ? { work_type: workType } : {} }
    };
  }
  function requirementNodeOf(doc) {
    return Object.values(doc?.nodes || {}).find((node) => node?.data?.[REQUIREMENT_MARK]) || null;
  }
  function stagePrefixOf(doc) {
    const id = Object.keys(doc?.nodes || {}).find((key) => /_stage_requirement$/.test(key));
    return id ? id.slice(0, id.length - "_stage_requirement".length) : "";
  }
  function stageSpot(index) {
    return { x: 40 + index * 400, y: -340, w: 340, h: 180 };
  }
  function stageSeal(label, text, state, facts) {
    const source = JSON.stringify([label, text, state, facts]);
    let hash = 2166136261;
    for (let i = 0; i < source.length; i++) {
      hash ^= source.charCodeAt(i);
      hash = Math.imul(hash, 16777619) >>> 0;
    }
    return hash.toString(16).padStart(8, "0");
  }
  function sealedStageData(key, state, text, facts) {
    const label = STAGE_LABELS[key] || key;
    return {
      label,
      text,
      status: state === "done" ? "done" : "idle",
      metaonticStage: key,
      metaonticStageState: state,
      metaonticStageRev: STAGE_REV,
      metaonticStageFacts: facts || {},
      metaonticStageSeal: stageSeal(label, text, state, facts || {})
    };
  }
  function stageNodeOwned(node) {
    const data = node?.data;
    return Boolean(data?.metaonticStage) && Number(data.metaonticStageRev) === STAGE_REV && data.metaonticStageSeal === stageSeal(data.label, data.text, data.metaonticStageState, data.metaonticStageFacts || {});
  }
  function stageNodeRewriteable(node) {
    if (!node?.data?.metaonticStage) return false;
    return stageNodeOwned(node) || Number(node.data.metaonticStageRev) !== STAGE_REV;
  }
  var MATERIAL_MARK = "metaonticMaterial";
  var FRAME_MARK = "metaonticFrameOf";
  function flowAuthors(doc) {
    return Object.values(doc?.nodes || {}).filter((node) => ["image", "video"].includes(node?.type) && !node?.metaonticSourceNode && !node?.data?.assetId && !node?.data?.[MATERIAL_MARK]);
  }
  function canvasSegments(doc) {
    return flowAuthors(doc).filter((node) => !node?.data?.[FRAME_MARK]);
  }
  function canvasAssets(doc) {
    return Object.values(doc?.nodes || {}).filter((node) => node?.type === "image" && Boolean(node?.data?.assetId || node?.metaonticSourceNode));
  }
  function canvasAssetLinks(doc) {
    const edges = Array.isArray(doc?.edges) ? doc.edges : [];
    const segments = new Set(canvasSegments(doc).map((node) => String(node.id)));
    const feeds = (id) => [...new Set(edges.filter((edge) => String(edge?.fromNode || "") === id && segments.has(String(edge?.toNode || ""))).map((edge) => String(edge.toNode)))];
    return canvasAssets(doc).map((node) => {
      const explicit = String(node?.data?.metaonticSegmentOf || "");
      const owner = String(node?.metaonticSourceNode || "");
      const serving = segments.has(explicit) ? [explicit] : feeds(owner || String(node.id));
      return { nodeId: String(node.id), label: String(node?.data?.label || "\u7D20\u6750\u56FE"), segments: serving };
    });
  }
  function canvasSegmentStats(doc) {
    const nodes = Object.values(doc?.nodes || {});
    const authors = new Set(canvasSegments(doc).map((node) => node.id));
    const produced = nodes.filter((node) => authors.has(node?.metaonticSourceNode) && (node?.data?.assetId || node?.data?.metaonticVideoUrl)).length;
    const shots = nodes.filter((node) => node?.type === "storyboard").reduce((sum, node) => sum + (Array.isArray(node?.data?.shots) ? node.data.shots.length : 0), 0);
    const links = canvasAssetLinks(doc);
    return {
      total: authors.size,
      produced,
      shots,
      assets: links.length,
      assetsBound: links.filter((link) => link.segments.length).length,
      assetsOrphan: links.filter((link) => !link.segments.length).length,
      filmReady: Boolean(doc?.film?.assetId),
      filmCount: Number(doc?.film?.count || 0)
    };
  }
  function canvasReadiness(doc) {
    const nodes = Object.values(doc?.nodes || {});
    const edges = Array.isArray(doc?.edges) ? doc.edges : [];
    const ids = new Set(nodes.map((node) => String(node.id)));
    const stats = canvasSegmentStats(doc);
    const issues = [];
    for (const edge of edges) {
      if (ids.has(String(edge?.fromNode || "")) && ids.has(String(edge?.toNode || ""))) continue;
      issues.push({
        code: "DANGLING_EDGE",
        severity: "error",
        scope: "edge",
        nodeId: String(edge?.id || ""),
        message: "\u6709\u4E00\u6761\u8FDE\u7EBF\u6307\u5411\u5DF2\u88AB\u5220\u9664\u7684\u8282\u70B9\u3002",
        suggestedAction: "\u9009\u4E2D\u90A3\u6761\u7EBF\u65AD\u5F00\uFF0C\u6216\u91CD\u65B0\u8FDE\u5230\u8FD8\u5728\u7684\u8282\u70B9\u4E0A\u3002"
      });
    }
    for (const node of canvasSegments(doc)) {
      const done = nodes.some((item) => item?.metaonticSourceNode === node.id && (item?.data?.assetId || item?.data?.metaonticVideoUrl));
      if (done) continue;
      issues.push({
        code: "SEGMENT_MISSING_OUTPUT",
        severity: "warning",
        scope: "segment",
        nodeId: String(node.id),
        message: `\u5236\u4F5C\u6BB5\u300C${String(node?.data?.label || "\u672A\u547D\u540D")}\u300D\u8FD8\u6CA1\u6709\u6210\u679C\u3002`,
        suggestedAction: "\u70B9\u8FD9\u4E2A\u8282\u70B9\u7684\u300C\u5236\u4F5C\u300D\uFF0C\u6838\u5BF9\u65B9\u6848\u5E76\u786E\u8BA4\u8D39\u7528\u540E\u751F\u6210\u3002"
      });
    }
    const hasResult = (id) => nodes.some((item) => String(item?.metaonticSourceNode || "") === id && (item?.data?.assetId || item?.data?.metaonticVideoUrl));
    for (const node of flowAuthors(doc)) {
      if (!node?.data?.[FRAME_MARK] || hasResult(String(node.id))) continue;
      issues.push({
        code: "FRAME_MISSING_IMAGE",
        severity: "warning",
        scope: "frame",
        nodeId: String(node.id),
        message: `\u753B\u9762\u300C${String(node?.data?.label || "\u672C\u6BB5\u753B\u9762")}\u300D\u8FD8\u6CA1\u6709\u51FA\u56FE\u3002`,
        suggestedAction: "\u5148\u70B9\u8FD9\u4E2A\u753B\u9762\u8282\u70B9\u7684\u300C\u5236\u4F5C\u300D\u51FA\u4E00\u5F20\u56FE\uFF1B\u51FA\u56FE\u540E\u5B83\u4F1A\u4F5C\u4E3A\u8FD9\u4E00\u6BB5\u7684\u9996\u5E27\u63A5\u7ED9\u540E\u9762\u7684\u89C6\u9891\u8282\u70B9\uFF0C\u56FE\u7247\u6309\u7528\u91CF\u5355\u72EC\u8BA1\u8D39\u5E76\u8981\u5BA1\u6838\u3002"
      });
    }
    for (const link of canvasAssetLinks(doc)) {
      if (link.segments.length) continue;
      issues.push({
        code: "ORPHAN_ASSET",
        severity: "info",
        scope: "asset",
        nodeId: link.nodeId,
        message: `\u7D20\u6750\u56FE\u300C${link.label}\u300D\u8FD8\u6CA1\u63A5\u5230\u4EFB\u4F55\u5236\u4F5C\u6BB5\u3002`,
        suggestedAction: "\u628A\u5B83\u8FDE\u5230\u67D0\u4E2A\u5236\u4F5C\u8282\u70B9\u7684\u300C\u53C2\u8003\u56FE\u300D\u6216\u300C\u9996\u5E27\u300D\u7AEF\u53E3\uFF0C\u4E0D\u7528\u7684\u7D20\u6750\u53EF\u4EE5\u5220\u6389\u3002"
      });
    }
    for (const node of nodes) {
      const owner = String(node?.metaonticSourceNode || "");
      if (!owner || ids.has(owner) || node?.type !== "video") continue;
      if (!(node?.data?.assetId || node?.data?.metaonticVideoUrl)) continue;
      issues.push({
        code: "ORPHAN_RESULT",
        severity: "info",
        scope: "media",
        nodeId: String(node.id),
        message: `\u6210\u679C\u300C${String(node?.data?.label || "\u89C6\u9891\u6210\u679C")}\u300D\u5BF9\u5E94\u7684\u5236\u4F5C\u6BB5\u5DF2\u88AB\u5220\u9664\u3002`,
        suggestedAction: "\u5B83\u4E0D\u53C2\u4E0E\u5236\u4F5C\u6BB5\u8BA1\u6570\uFF0C\u4E5F\u4E0D\u4F1A\u8FDB\u5165\u6210\u7247\uFF1B\u8981\u91CD\u505A\u5148\u6309\u6D41\u7A0B\u94FA\u51FA\u5236\u4F5C\u6BB5\uFF0C\u6210\u679C\u6587\u4EF6\u4ECD\u4FDD\u7559\u5728\u753B\u5E03\u6570\u636E\u76EE\u5F55\u3002"
      });
    }
    const videoSegments = canvasSegments(doc).filter((node) => node?.type === "video");
    const videoDone = videoSegments.filter((node) => nodes.some((item) => item?.metaonticSourceNode === node.id && (item?.data?.assetId || item?.data?.metaonticVideoUrl))).length;
    const filmCount = Number(doc?.film?.count);
    if (stats.filmReady && Number.isFinite(filmCount) && filmCount !== videoDone) {
      issues.push({
        code: "FILM_STALE",
        severity: "warning",
        scope: "film",
        nodeId: "",
        message: `\u5DF2\u5408\u6210\u7684\u6210\u7247\u662F ${filmCount} \u6BB5\uFF0C\u753B\u5E03\u4E0A\u73B0\u5728\u7684\u89C6\u9891\u6210\u679C\u6709 ${videoDone} \u6BB5\u3002`,
        // 建议按「画布上还有没有视频制作段」分岔：一段都不剩时合并没有任何输入，会直接报错，
        // 也就不能再劝用户「每段都出成果后重新合成」。
        suggestedAction: videoSegments.length ? "\u6BCF\u6BB5\u90FD\u51FA\u6210\u679C\u540E\u91CD\u65B0\u70B9\u300C\u5408\u6210\u6210\u7247\u300D\uFF0C\u6210\u7247\u4F1A\u6309\u5F53\u524D\u8FDE\u7EBF\u987A\u5E8F\u91CD\u62FC\u3002" : "\u753B\u5E03\u4E0A\u5DF2\u7ECF\u6CA1\u6709\u89C6\u9891\u5236\u4F5C\u6BB5\u4E86\uFF1A\u8981\u91CD\u505A\u5148\u6309\u6D41\u7A0B\u94FA\u51FA\u5236\u4F5C\u6BB5\uFF1B\u5DF2\u5408\u6210\u7684\u6210\u7247\u6587\u4EF6\u4ECD\u4FDD\u7559\u5728\u753B\u5E03\u6570\u636E\u76EE\u5F55\u3002"
      });
    }
    return issues;
  }
  var CHOICE_TEXT = {
    not_needed: "\u4E0D\u9700\u8981\u89D2\u8272\u56FE",
    provided_images: "\u4F7F\u7528\u5DF2\u6709\u89D2\u8272\u56FE",
    generate_first: "\u5148\u751F\u6210\u89D2\u8272\u56FE\u518D\u5236\u4F5C",
    text_only: "\u7EAF\u6587\u672C\u751F\u6210"
  };
  function stageSummary(facts = {}, stats = {}) {
    const duration = Number.isFinite(Number(facts.duration)) && facts.duration !== null && facts.duration !== void 0 ? Number(facts.duration) : null;
    const produced = Number(stats.produced || 0), total = Math.max(Number(facts.segmentTotal || 0), Number(stats.total || 0));
    const shots = Number(stats.shots || 0), assets = Number(stats.assets || 0);
    const choice = CHOICE_TEXT[facts.choice] || facts.choice || "\u5F85\u786E\u8BA4";
    const requirementText = [
      `\u76EE\u6807\u65F6\u957F\uFF1A${duration === null ? "\u5F85\u786E\u8BA4" : `${duration} \u79D2`}`,
      `\u753B\u5E45\uFF1A${facts.ratio || "\u5F85\u786E\u8BA4"}`,
      `\u6E05\u6670\u5EA6\uFF1A${String(facts.resolution || "\u5F85\u786E\u8BA4").toUpperCase()}`,
      `\u89D2\u8272\u56FE\u8DEF\u7EBF\uFF1A${choice}`
    ].join("\n");
    const scriptText = [
      `\u5267\u672C\uFF1A${facts.scriptDrafted || facts.scriptApproved ? "\u5DF2\u540C\u6B65" : "\u672A\u5F00\u59CB"}`,
      `\u5BA1\u6838\uFF1A${facts.scriptApproved ? "\u5DF2\u901A\u8FC7" : facts.scriptDrafted ? "\u7B49\u5F85\u7528\u6237\u5BA1\u6838" : "\u672A\u5F00\u59CB"}`
    ].join("\n");
    const storyboardText = shots > 0 ? [`\u5206\u955C\uFF1A${shots} \u4E2A\u955C\u5934`, `\u6BCF\u6BB5\u63D0\u793A\u8BCD\u89C1\u5236\u4F5C\u8282\u70B9`].join("\n") : total > 0 ? [`\u5206\u955C\uFF1A\u6309\u573A\u666F\u4E0E\u53E5\u5B50\u5207\u6BB5\uFF0C\u5171 ${total} \u6BB5`, `\u6BCF\u6BB5\u63D0\u793A\u8BCD\u89C1\u5236\u4F5C\u8282\u70B9`].join("\n") : "\u8FD8\u6CA1\u6709\u5206\u955C\uFF1A\u5148\u5199\u811A\u672C\u5E76\u786E\u8BA4\u5BA1\u6838\uFF0C\u518D\u6309\u5206\u955C\u8868\u6216\u53E5\u5B50\u5207\u6BB5\u3002";
    const bound = Number.isFinite(Number(stats.assetsBound)) ? Number(stats.assetsBound) : assets;
    const assetsText = [
      `\u89D2\u8272\u56FE\u8DEF\u7EBF\uFF1A${choice}`,
      `\u7D20\u6750\u56FE\uFF1A${assets} \u5F20\uFF08\u89D2\u8272\u56FE / \u9996\u5E27 / \u53C2\u8003\u56FE\uFF09${assets > bound ? `\uFF0C\u5176\u4E2D ${assets - bound} \u5F20\u8FD8\u6CA1\u63A5\u5230\u5236\u4F5C\u6BB5` : ""}`
    ].join("\n");
    const costText = [
      `\u5236\u4F5C\u65B9\u6848\uFF1A${facts.specApproved ? "\u5DF2\u5BA1\u6838" : "\u672A\u4EA7\u51FA"}`,
      `\u8D39\u7528\uFF1A${produced > 0 ? "\u5DF2\u786E\u8BA4\uFF08\u5DF2\u6709\u751F\u6210\u8BB0\u5F55\uFF09" : "\u751F\u6210\u524D\u4ECD\u8981\u5355\u72EC\u786E\u8BA4"}`
    ].join("\n");
    const segmentsText = total > 0 ? [`\u5236\u4F5C\u6BB5\uFF1A${total} \u6BB5`, `\u5DF2\u5B8C\u6210\uFF1A${Math.min(produced, total)} \u6BB5`].join("\n") : "\u6682\u65E0\u5236\u4F5C\u6BB5\uFF1A\u5148\u5728\u753B\u5E03\u4E0A\u5199\u811A\u672C\u3001\u786E\u8BA4\u811A\u672C\u5BA1\u6838\u4E0E\u5236\u4F5C\u65B9\u6848\u3002";
    const filmText = stats.filmReady ? `\u5DF2\u5408\u6210\u6210\u7247\uFF08${Number(stats.filmCount || 0)} \u6BB5\uFF09` : total > 0 && produced >= total ? "\u6BCF\u6BB5\u90FD\u6709\u6210\u679C\uFF0C\u53EF\u4EE5\u70B9\u300C\u5408\u6210\u6210\u7247\u300D" : "\u7B49\u5F85\u6BCF\u6BB5\u90FD\u4EA7\u51FA\u6210\u679C";
    const needsAssets = !["not_needed", "text_only"].includes(String(facts.choice || ""));
    const state = {
      requirement: { state: facts.requirementSettled ? "done" : "active", text: requirementText },
      script: { state: facts.scriptApproved ? "done" : facts.scriptDrafted ? "review" : "pending", text: scriptText },
      storyboard: { state: shots > 0 || total > 0 ? "done" : facts.scriptApproved ? "active" : "pending", text: storyboardText },
      assets: { state: !needsAssets || assets > 0 ? "done" : facts.requirementSettled ? "active" : "pending", text: assetsText },
      cost: { state: produced > 0 ? "done" : facts.specApproved ? "active" : "pending", text: costText },
      segments: { state: total > 0 && produced >= total ? "done" : produced > 0 || total > 0 ? "active" : "pending", text: segmentsText },
      film: { state: stats.filmReady ? "done" : total > 0 && produced >= total ? "ready" : "pending", text: filmText }
    };
    return STAGE_KEYS.map((key) => ({ key, ...state[key] }));
  }
  function rewriteStageNodes(doc, patch = {}) {
    const nodes = { ...doc?.nodes || {} };
    const ids = Object.keys(nodes).filter((id) => nodes[id]?.data?.metaonticStage);
    if (!ids.length) return { nodes, changed: [] };
    const stats = canvasSegmentStats({ ...doc, nodes });
    const changed = [];
    for (const id of ids) {
      const node = nodes[id];
      if (!stageNodeRewriteable(node) || !node.data.metaonticStageFacts) continue;
      const facts = { ...node.data.metaonticStageFacts || {}, ...patch };
      const key = String(node.data.metaonticStage);
      const found = stageSummary(facts, stats).find((stage) => stage.key === key);
      if (!found) continue;
      const data = sealedStageData(key, found.state, found.text, facts);
      if (JSON.stringify(data) === JSON.stringify(node.data)) continue;
      nodes[id] = { ...node, data };
      changed.push(id);
    }
    return { nodes, changed };
  }

  // src/businesses/film-director/profiles/dimensions.ts
  var entry = (label, creative, screenwriter, storyboard, criterion) => ({ label, rules: { creative, screenwriter, storyboard, reviewer: criterion }, criterion });
  var REGISTRY = {
    genre: {
      comedy: entry("\u559C\u5267", "\u5BFB\u627E\u4EBA\u7269\u6B32\u671B\u4E0E\u60C5\u5883\u53CD\u5DEE\uFF0C\u4E0D\u5F3A\u5236\u53CD\u8F6C\u3002", "\u4EE5\u94FA\u57AB\u3001\u5347\u7EA7\u3001\u884C\u4E3A\u7B11\u70B9\u4E0E\u56DE\u5E94\u63A8\u8FDB\u3002", "\u4E3A\u7B11\u70B9\u5151\u73B0\u548C\u53CD\u5E94\u7559\u65F6\u95F4\uFF0C\u4E0D\u9760\u5BC6\u96C6\u5207\u955C\u3002", "\u7B11\u70B9\u6709\u94FA\u57AB\u4E14\u7B26\u5408\u4EBA\u7269\u903B\u8F91\u3002"),
      drama: entry("\u5267\u60C5", "\u5EFA\u7ACB\u76EE\u6807\u3001\u963B\u788D\u3001\u9009\u62E9\u4E0E\u540E\u679C\u3002", "\u4E8B\u4EF6\u56E0\u679C\u63A8\u52A8\u4EBA\u7269\u6216\u5173\u7CFB\u53D8\u5316\u3002", "\u5448\u73B0\u51B3\u5B9A\u4E0E\u540E\u679C\uFF0C\u4E0D\u7528\u7A7A\u955C\u4EE3\u66FF\u884C\u52A8\u3002", "\u4EBA\u7269\u9009\u62E9\u4E0E\u53EF\u89C1\u540E\u679C\u6210\u7ACB\u3002"),
      documentary: entry("\u7EAA\u5F55", "\u5EFA\u7ACB\u771F\u5B9E\u95EE\u9898\u3001\u89C2\u5BDF\u5BF9\u8C61\u4E0E\u7D20\u6750\u6765\u6E90\u3002", "\u4F7F\u7528\u771F\u5B9E\u6750\u6599\u3001\u91C7\u8BBF\u95EE\u9898\u6216\u660E\u786E\u6807\u6CE8\u7684\u620F\u5267\u5316\u91CD\u73B0\uFF0C\u4E0D\u7F16\u9020\u53D7\u8BBF\u8005\u539F\u8BDD\u3002", "\u533A\u5206\u62DF\u62CD\u6444\u65B9\u6848\u3001\u771F\u5B9E\u7D20\u6750\u548C\u91CD\u73B0\u955C\u5934\u3002", "\u9648\u8FF0\u6709\u6765\u6E90\uFF0CVERIFIED_FACT/USER_PROVIDED/UNVERIFIED/DRAMATIZATION \u5206\u79BB\u3002"),
      animation: entry("\u52A8\u753B", "\u660E\u786E\u4E16\u754C\u89C4\u5219\u3001\u89D2\u8272\u8FA8\u8BC6\u4E0E\u76EE\u6807\u53D7\u4F17\u3002", "\u52A8\u4F5C\u6709\u89C6\u89C9\u56E0\u679C\uFF0C\u9075\u5B88\u4E16\u754C\u89C4\u5219\u3002", "\u52A8\u4F5C\u8DEF\u5F84\u6E05\u695A\uFF0C\u89D2\u8272\u6BD4\u4F8B\u4E0E\u7A7A\u95F4\u89C4\u5219\u7A33\u5B9A\u3002", "\u4E16\u754C\u89C4\u5219\u3001\u89D2\u8272\u548C\u52A8\u4F5C\u53EF\u8BFB\u6027\u4E00\u81F4\u3002"),
      romance: entry("\u7231\u60C5", "\u56F4\u7ED5\u5177\u4F53\u5173\u7CFB\u53D8\u5316\u4E0E\u60C5\u611F\u969C\u788D\u63D0\u70BC\u4F53\u9A8C\u3002", "\u7528\u4E92\u52A8\u3001\u8BD5\u63A2\u3001\u56DE\u5E94\u63A8\u8FDB\u5173\u7CFB\uFF0C\u4E0D\u9760\u544A\u767D\u53E3\u53F7\u3002", "\u901A\u8FC7\u8DDD\u79BB\u3001\u89C6\u7EBF\u4E0E\u56DE\u5E94\u5448\u73B0\u5173\u7CFB\u53D8\u5316\u3002", "\u60C5\u611F\u53D8\u5316\u6709\u5177\u4F53\u4E92\u52A8\u4E0E\u56DE\u5E94\u652F\u6491\u3002"),
      thriller: entry("\u60AC\u7591\u60CA\u609A", "\u89C4\u5212\u89C2\u4F17\u5DF2\u77E5\u548C\u672A\u77E5\u4FE1\u606F\u53CA\u7EBF\u7D22\u3002", "\u60AC\u5FF5\u6709\u56E0\u679C\u94FA\u57AB\u4E0E\u56DE\u6536\uFF0C\u4E0D\u4F9D\u8D56\u65E0\u539F\u56E0\u53CD\u8F6C\u3002", "\u63A7\u5236\u89C6\u70B9\u4E0E\u4FE1\u606F\u63ED\u793A\uFF0C\u4E0D\u80FD\u85CF\u6389\u7406\u89E3\u6240\u9700\u8BC1\u636E\u3002", "\u7EBF\u7D22\u516C\u5E73\u3001\u56E0\u679C\u6210\u7ACB\u4E14\u5173\u952E\u60AC\u5FF5\u5F97\u5230\u5904\u7406\u3002")
    },
    format: {
      skit: entry("\u60C5\u666F\u5C0F\u54C1", "\u96C6\u4E2D\u5728\u5355\u4E00\u60C5\u5883\u4E0E\u6838\u5FC3\u4E92\u52A8\u3002", "\u51CF\u5C11\u652F\u7EBF\uFF0C\u52A8\u4F5C\u3001\u5BF9\u767D\u548C\u53CD\u5E94\u53EF\u5728\u9884\u7B97\u5185\u5B8C\u6210\u3002", "\u5C11\u91CF\u5FC5\u8981\u673A\u4F4D\u4FDD\u6301\u4E92\u52A8\u53EF\u8BFB\u3002", "\u5355\u4E00\u60C5\u5883\u5B8C\u6574\uFF0C\u5173\u952E\u53CD\u5E94\u6709\u65F6\u957F\u3002"),
      short_film: entry("\u77ED\u7247", "\u6784\u5EFA\u9002\u5408\u65F6\u957F\u7684\u5B8C\u6574\u4F53\u9A8C\u3002", "\u6BCF\u573A\u6709\u529F\u80FD\u4E0E\u72B6\u6001\u53D8\u5316\u3002", "\u955C\u5934\u8986\u76D6\u5173\u952E\u4E8B\u4EF6\u5E76\u63A7\u5236\u8282\u594F\u3002", "\u7ED3\u6784\u5B8C\u6574\uFF0C\u573A\u666F\u63A8\u8FDB\u6709\u5FC5\u8981\u6027\u3002"),
      micro_drama: entry("\u5FAE\u77ED\u5267", "\u8BBE\u8BA1\u5355\u96C6\u6838\u5FC3\u4E8B\u4EF6\u4E0E\u8FDE\u7EED\u4EBA\u7269\u5173\u7CFB\u3002", "\u8BB0\u5F55\u5173\u7CFB\u53D8\u5316\u548C\u672A\u89E3\u51B3\u7EBF\u7D22\uFF0C\u4E0D\u91CD\u7F6E\u89D2\u8272\u3002", "\u5173\u952E\u51B2\u7A81\u4E0E\u56DE\u5E94\u6E05\u695A\uFF0C\u4E0D\u80FD\u7528\u5FEB\u5207\u63A9\u76D6\u56E0\u679C\u3002", "\u5355\u96C6\u6210\u7ACB\u5E76\u4E0E\u8FDE\u7EED\u4EBA\u7269\u7EBF\u4E00\u81F4\u3002"),
      series: entry("\u8FDE\u7EED\u4F5C\u54C1", "\u5EFA\u7ACB\u5168\u7247\u4E3B\u7EBF\u3001\u5355\u96C6\u529F\u80FD\u4E0E\u8DE8\u96C6\u72B6\u6001\u3002", "\u7EF4\u62A4\u4F0F\u7B14\u3001\u524D\u60C5\u4E0E\u4EBA\u7269\u72B6\u6001\uFF0C\u6309\u7AE0\u4EA4\u4ED8\u3002", "\u5206\u7AE0\u573A\u955C\u5206\u5C42\u89C4\u5212\uFF0C\u590D\u67E5\u8DE8\u7AE0\u8FB9\u754C\u3002", "\u5355\u96C6\u8FDB\u5EA6\u548C\u5168\u7247\u5B8C\u6210\u72B6\u6001\u51C6\u786E\uFF0C\u7EBF\u7D22\u53EF\u8FFD\u8E2A\u3002"),
      interview: entry("\u8BBF\u8C08", "\u660E\u786E\u95EE\u9898\u3001\u5BF9\u8C61\u4E0E\u771F\u5B9E\u7D20\u6750\u9700\u6C42\u3002", "\u63D0\u4F9B\u91C7\u8BBF\u95EE\u9898\uFF1B\u672A\u53D6\u5F97\u7684\u56DE\u7B54\u4E0D\u5F97\u5F53\u6210\u771F\u5B9E\u539F\u8BDD\u3002", "\u5B89\u6392\u91C7\u8BBF\u3001\u53CD\u5E94\u4E0E\u76F8\u5173\u8BC1\u636E\u753B\u9762\uFF0C\u4E0D\u865A\u6784\u5DF2\u62CD\u7D20\u6750\u3002", "\u91C7\u8BBF\u6765\u6E90\u771F\u5B9E\uFF0C\u62DF\u95EE\u4E0E\u5DF2\u56DE\u7B54\u5185\u5BB9\u533A\u5206\u3002"),
      commercial: entry("\u5E7F\u544A\u7247", "\u56F4\u7ED5\u9700\u6C42\u3001\u53EF\u4FE1\u5229\u76CA\u4E0E\u884C\u52A8\u76EE\u6807\u8BBE\u8BA1\u3002", "\u53EA\u4F7F\u7528\u6709\u4F9D\u636E\u7684\u4EA7\u54C1\u4E3B\u5F20\u4E0E\u6F14\u793A\u3002", "\u5C55\u793A\u4EA7\u54C1\u4F7F\u7528\u8FC7\u7A0B\u548C\u8BC1\u636E\uFF0C\u907F\u514D\u6697\u793A\u672A\u8BC1\u5B9E\u529F\u6548\u3002", "\u4EA7\u54C1\u4E3B\u5F20\u6709\u4F9D\u636E\uFF0C\u4F7F\u7528\u4E0E\u884C\u52A8\u76EE\u6807\u6E05\u695A\u3002"),
      vlog: entry("\u751F\u6D3B\u8BB0\u5F55", "\u5BFB\u627E\u65E5\u5E38\u89C2\u5BDF\u3001\u7EC6\u8282\u4E0E\u4F53\u9A8C\u53D8\u5316\u3002", "\u4FDD\u7559\u81EA\u7136\u884C\u52A8\u548C\u73AF\u5883\u53CD\u9988\uFF0C\u4E0D\u5F3A\u52A0\u620F\u5267\u51B2\u7A81\u3002", "\u89C2\u5BDF\u6027\u6784\u56FE\u4E0E\u81EA\u7136\u8282\u594F\uFF0C\u907F\u514D\u65E0\u610F\u4E49\u8FD0\u955C\u3002", "\u65E5\u5E38\u7EC6\u8282\u6709\u89C2\u5BDF\u4EF7\u503C\uFF0C\u8282\u594F\u81EA\u7136\u3002"),
      music_video: entry("\u97F3\u4E50\u5F71\u50CF", "\u5EFA\u7ACB\u97F3\u4E50\u4E0E\u89C6\u89C9\u6BCD\u9898\u7684\u5173\u8054\u3002", "\u7528\u52A8\u4F5C\u548C\u610F\u8C61\u9012\u8FDB\uFF0C\u4E0D\u5F3A\u585E\u5BF9\u767D\u6216\u5267\u60C5\u3002", "\u6309\u97F3\u4E50\u6BB5\u843D\u89C4\u5212\u8282\u594F\u4E0E\u89C6\u89C9\u53D8\u5316\u3002", "\u58F0\u753B\u5173\u8054\u548C\u610F\u8C61\u9012\u8FDB\u660E\u786E\u3002")
    },
    purpose: {
      entertainment: entry("\u5A31\u4E50", "\u660E\u786E\u89C2\u4F17\u7684\u60C5\u7EEA\u6536\u76CA\u3002", "\u4FDD\u6301\u4EBA\u7269\u4E0E\u4E8B\u4EF6\u5438\u5F15\u529B\uFF0C\u907F\u514D\u7A7A\u6D1E\u523A\u6FC0\u3002", "\u4FDD\u8BC1\u770B\u70B9\u53EF\u89C1\u4E14\u8282\u594F\u53EF\u8BFB\u3002", "\u89C2\u4F17\u4F53\u9A8C\u6709\u4E8B\u4EF6\u6216\u753B\u9762\u652F\u6491\u3002"),
      promotion: entry("\u5BA3\u4F20", "\u63D0\u70BC\u5730\u57DF\u6216\u54C1\u724C\u8FA8\u8BC6\u4E0E\u8BB0\u5FC6\u70B9\u3002", "\u7528\u5177\u4F53\u53EF\u6838\u5B9E\u7EC6\u8282\u4EE3\u66FF\u53E3\u53F7\u3002", "\u5C55\u793A\u53EF\u8FA8\u8BC6\u5730\u70B9\u3001\u4EBA\u7269\u548C\u751F\u6D3B\u7EC6\u8282\u3002", "\u8FA8\u8BC6\u5EA6\u4E0E\u4F20\u64AD\u4FE1\u606F\u5177\u4F53\u4E14\u53EF\u4FE1\u3002"),
      education: entry("\u79D1\u666E\u6559\u80B2", "\u786E\u5B9A\u89C2\u4F17\u8981\u7406\u89E3\u7684\u95EE\u9898\u4E0E\u8FB9\u754C\u3002", "\u6309\u95EE\u9898\u3001\u8BC1\u636E\u3001\u89E3\u91CA\u63A8\u8FDB\uFF0C\u4E8B\u5B9E\u4E0D\u786E\u5B9A\u5904\u6807\u5F85\u6838\u5B9E\u3002", "\u7528\u6F14\u793A\u6216\u5BF9\u6BD4\u89E3\u91CA\u4FE1\u606F\uFF0C\u4E0D\u53EA\u5806\u5B57\u5E55\u3002", "\u77E5\u8BC6\u51C6\u786E\uFF0C\u89E3\u91CA\u6E05\u695A\uFF0C\u6709\u8BC1\u636E\u4E0E\u9002\u7528\u8FB9\u754C\u3002"),
      sales: entry("\u9500\u552E\u8F6C\u5316", "\u5B9A\u4E49\u9700\u6C42\u3001\u8BC1\u636E\u4E0E\u884C\u52A8\u76EE\u6807\u3002", "\u4E0D\u7F16\u9020\u6027\u80FD\u3001\u6570\u636E\u3001\u8BA4\u8BC1\u6216\u627F\u8BFA\u3002", "\u8BA9\u4F7F\u7528\u8FC7\u7A0B\u4E0E\u5229\u76CA\u8BC1\u636E\u53EF\u89C1\u3002", "\u5356\u70B9\u53EF\u4FE1\uFF0C\u884C\u52A8\u6E05\u695A\uFF0C\u65E0\u5938\u5927\u4E3B\u5F20\u3002")
    },
    style_profile: {
      rural_documentary: entry("\u4E61\u6751\u89C2\u5BDF", "\u4ECE\u5177\u4F53\u751F\u6D3B\u89C2\u5BDF\u5BFB\u627E\u7EC6\u8282\uFF0C\u4E0D\u523B\u677F\u5316\u519C\u6751\u3002", "\u8BED\u8A00\u81EA\u7136\uFF0C\u5730\u57DF\u4E8B\u5B9E\u9700\u6765\u6E90\u3002", "\u81EA\u7136\u5149\u3001\u73B0\u573A\u58F0\u4E0E\u53EF\u8FA8\u7A7A\u95F4\uFF0C\u4E0D\u81EA\u52A8\u6DFB\u52A0\u7834\u8D25\u8D2B\u56F0\u3002", "\u751F\u6D3B\u7EC6\u8282\u53EF\u4FE1\uFF0C\u5730\u57DF\u4E8B\u5B9E\u4E0E\u89C2\u5BDF\u8FB9\u754C\u6E05\u695A\u3002"),
      minidv: entry("\u5343\u79A7 MiniDV", "\u4EE5\u751F\u6D3B\u7247\u6BB5\u4E0E\u81EA\u7136\u89C2\u5BDF\u7EC4\u7EC7\u89C6\u89C9\u6BCD\u9898\u3002", "\u5BF9\u767D\u5C0F\u58F0\u81EA\u7136\uFF0C\u52A8\u4F5C\u4E0E\u505C\u987F\u6709\u751F\u6D3B\u611F\u3002", "\u6309\u9700\u8F7B\u5FAE\u624B\u6301\u3001\u5BF9\u7126\u641C\u7D22\u3001\u4F4E\u9971\u548C\u539F\u751F\u8272\u5F69\u548C\u9897\u7C92\uFF0C\u4E0D\u63A9\u76D6\u5173\u952E\u52A8\u4F5C\u3002", "DV \u8868\u73B0\u514B\u5236\uFF0C\u4EBA\u7269\u52A8\u4F5C\u4E0E\u5173\u952E\u4FE1\u606F\u4FDD\u6301\u6E05\u695A\u3002"),
      cinematic_realism: entry("\u5199\u5B9E\u7535\u5F71", "\u4EE5\u5177\u4F53\u4E8B\u4EF6\u627F\u8F7D\u8868\u8FBE\u3002", "\u884C\u4E3A\u548C\u5BF9\u767D\u81EA\u7136\uFF0C\u4E0D\u7528\u62BD\u8C61\u5F62\u5BB9\u8BCD\u4EE3\u66FF\u5267\u60C5\u3002", "\u4EE5\u5149\u6E90\u3001\u6750\u8D28\u3001\u7A7A\u95F4\u548C\u52A8\u4F5C\u63CF\u8FF0\u98CE\u683C\uFF0C\u4E0D\u5806\u53C2\u6570\u3002", "\u89C6\u89C9\u7EC6\u8282\u771F\u5B9E\u5E76\u670D\u52A1\u53D9\u4E8B\u3002"),
      stylized_animation: entry("\u98CE\u683C\u5316\u52A8\u753B", "\u660E\u786E\u7EDF\u4E00\u7684\u9020\u578B\u548C\u4E16\u754C\u89C4\u5219\u3002", "\u8868\u6F14\u4E0E\u52A8\u4F5C\u7B26\u5408\u8BBE\u5B9A\u3002", "\u7EDF\u4E00\u6BD4\u4F8B\u3001\u6750\u8D28\u3001\u8272\u5F69\u548C\u52A8\u4F5C\u7269\u7406\u89C4\u5219\u3002", "\u9020\u578B\u98CE\u683C\u4E0E\u4E16\u754C\u7269\u7406\u89C4\u5219\u8DE8\u955C\u4E00\u81F4\u3002")
    }
  };

  // src/businesses/film-director/profiles/drama.ts
  var drama_default = {
    "id": "DRAMA",
    "revision": "1",
    "label": "\u5267\u60C5\u77ED\u7247",
    "strategy": "\u4EBA\u7269\u76EE\u6807\u2192\u963B\u788D\u2192\u9009\u62E9\u2192\u53EF\u89C1\u540E\u679C",
    "boundary": "\u5141\u8BB8\u514B\u5236\u7684\u65E5\u5E38\u77DB\u76FE\uFF0C\u4E0D\u673A\u68B0\u6DFB\u52A0\u60B2\u60C5\u6216\u53CD\u8F6C\u3002",
    "creative_fields": {
      "character_goal": "\u4EBA\u7269\u6B64\u523B\u7684\u5177\u4F53\u76EE\u6807",
      "choice_and_consequence": "\u5173\u952E\u9009\u62E9\u4E0E\u540E\u679C"
    },
    "script_fields": {
      "causal_progression": "\u4E8B\u4EF6\u4E4B\u95F4\u7684\u56E0\u679C\u63A8\u8FDB",
      "character_change": "\u4EBA\u7269\u6216\u5173\u7CFB\u7684\u53D8\u5316"
    },
    "review_criteria": [
      {
        "id": "drama_1",
        "description": "\u52A8\u673A\u662F\u5426\u7531\u884C\u52A8\u4F53\u73B0"
      },
      {
        "id": "drama_2",
        "description": "\u9009\u62E9\u548C\u7ED3\u679C\u662F\u5426\u6709\u56E0\u679C\u4F9D\u636E"
      }
    ],
    "role_rules": {
      "screenwriter": "\u56F4\u7ED5\u4EBA\u7269\u9009\u62E9\u5199\u573A\u666F\uFF0C\u914D\u89D2\u6709\u81EA\u8EAB\u7406\u7531\uFF0C\u4E0D\u7528\u673A\u68B0\u8BEF\u4F1A\u5236\u9020\u963B\u788D\u3002",
      "storyboard": "\u8BA9\u89C2\u4F17\u770B\u6E05\u9009\u62E9\u53D1\u751F\u7684\u77AC\u95F4\u4E0E\u540E\u679C\uFF0C\u53CD\u5E94\u955C\u5934\u627F\u62C5\u5173\u7CFB\u53D8\u5316\u3002"
    }
  };

  // src/businesses/film-director/profiles/comedy.ts
  var comedy_default = {
    "id": "COMEDY",
    "revision": "1",
    "label": "\u60C5\u666F\u559C\u5267",
    "strategy": "\u9884\u671F\u2192\u5347\u7EA7\u2192\u53CD\u5DEE\u2192\u56DE\u6536",
    "boundary": "\u7B11\u70B9\u6765\u81EA\u4EBA\u7269\u4E0E\u60C5\u5883\uFF0C\u4E0D\u4F9D\u8D56\u523B\u677F\u5370\u8C61\u3001\u5938\u5F20\u8868\u60C5\u6216\u97F3\u6548\u3002",
    "creative_fields": {
      "comic_premise": "\u89C2\u4F17\u9884\u671F\u4E0E\u559C\u5267\u524D\u63D0",
      "payoff": "\u53CD\u5DEE\u843D\u70B9\u4E0E\u56DE\u6536"
    },
    "script_fields": {
      "setup_payoff": "\u94FA\u57AB\u4E0E\u7B11\u70B9\u7684\u5BF9\u5E94",
      "reaction_budget": "\u7B11\u70B9\u524D\u540E\u53CD\u5E94\u4E0E\u505C\u987F\u7684\u65F6\u95F4\u5B89\u6392"
    },
    "review_criteria": [
      {
        "id": "comedy_1",
        "description": "\u7B11\u70B9\u662F\u5426\u6709\u53EF\u8FA8\u8BC6\u7684\u94FA\u57AB"
      },
      {
        "id": "comedy_2",
        "description": "\u53CD\u5DEE\u662F\u5426\u7531\u4EBA\u7269\u884C\u4E3A\u5F15\u53D1\u4E14\u6709\u53CD\u5E94\u65F6\u95F4"
      }
    ],
    "role_rules": {
      "screenwriter": "\u5148\u8BA9\u9884\u671F\u6210\u7ACB\u518D\u504F\u79BB\uFF0C\u907F\u514D\u89D2\u8272\u4E3A\u7B11\u8BDD\u7A81\u7136\u5931\u53BB\u5E38\u8BC6\u3002",
      "storyboard": "\u5173\u952E\u7B11\u70B9\u4FE1\u606F\u4E0D\u53EF\u88AB\u8FD0\u955C\u906E\u4F4F\uFF0C\u7ED9\u89C2\u4F17\u8BFB\u61C2\u53CD\u5DEE\u548C\u4EBA\u7269\u53CD\u5E94\u7684\u65F6\u95F4\u3002"
    }
  };

  // src/businesses/film-director/profiles/lifestyle.ts
  var lifestyle_default = {
    "id": "LIFESTYLE",
    "revision": "1",
    "label": "\u751F\u6D3BVlog\uFF0F\u6C1B\u56F4\u7247",
    "strategy": "\u4F53\u9A8C\u8D77\u70B9\u2192\u7EC6\u8282\u53D1\u73B0\u2192\u611F\u53D7\u53D8\u5316",
    "boundary": "\u53EF\u4EE5\u65E0\u51B2\u7A81\u3001\u65E0\u5BF9\u767D\u3001\u65E0\u4EBA\u50CF\uFF1B\u751F\u6D3B\u8D28\u611F\u4E0E\u89C2\u5BDF\u987A\u5E8F\u6210\u7ACB\u5373\u53EF\uFF0C\u4E0D\u5F3A\u9020\u620F\u5267\u3002",
    "creative_fields": {
      "experience_line": "\u672C\u7247\u4F53\u9A8C\u6216\u89C2\u5BDF\u4E3B\u7EBF",
      "detail_discovery": "\u503C\u5F97\u89C2\u770B\u7684\u5177\u4F53\u7EC6\u8282\u53D1\u73B0"
    },
    "script_fields": {
      "observation_progression": "\u7EC6\u8282\u5982\u4F55\u9010\u6B65\u88AB\u53D1\u73B0",
      "sensory_rhythm": "\u751F\u6D3B\u52A8\u4F5C\u3001\u73AF\u5883\u58F0\u53CA\u7559\u767D\u7684\u8282\u594F"
    },
    "review_criteria": [
      {
        "id": "lifestyle_1",
        "description": "\u89C2\u5BDF\u662F\u5426\u6709\u63A8\u8FDB\u800C\u975E\u91CD\u590D\u98CE\u666F"
      },
      {
        "id": "lifestyle_2",
        "description": "\u751F\u6D3B\u52A8\u4F5C\u548C\u58F0\u97F3\u662F\u5426\u53EF\u4FE1\u4E14\u7B26\u5408\u7528\u6237\u6C1B\u56F4"
      }
    ],
    "role_rules": {
      "screenwriter": "\u4EE5\u751F\u6D3B\u52A8\u4F5C\u548C\u611F\u5B98\u53D1\u73B0\u7EC4\u7EC7\u5185\u5BB9\uFF0C\u5141\u8BB8\u7559\u767D\uFF0C\u4E0D\u865A\u6784\u82E6\u96BE\u6216\u786C\u52A0\u53CD\u8F6C\u3002",
      "storyboard": "\u6784\u56FE\u8BA9\u89C2\u4F17\u53D1\u73B0\u7EC6\u8282\uFF0C\u7A7A\u95F4\u5149\u7EBF\u4E0E\u73AF\u5883\u58F0\u97F3\u53C2\u4E0E\u53D9\u4E8B\uFF0C\u56FA\u5B9A\u673A\u4F4D\u53EF\u4EE5\u6210\u7ACB\u3002"
    }
  };

  // src/businesses/film-director/profiles/documentary.ts
  var documentary_default = {
    "id": "DOCUMENTARY",
    "revision": "1",
    "label": "\u7EAA\u5F55\uFF0F\u77E5\u8BC6\u7247",
    "strategy": "\u6838\u5FC3\u95EE\u9898\u2192\u8BC1\u636E\u4E0E\u4F8B\u5B50\u2192\u89E3\u91CA\u2192\u56DE\u5E94",
    "boundary": "\u533A\u5206\u5DF2\u6838\u5B9E\u4E8B\u5B9E\u3001\u7528\u6237\u6750\u6599\u3001\u5F85\u6838\u5B9E\u5185\u5BB9\u4E0E\u620F\u5267\u5316\u91CD\u73B0\uFF1B\u4E0D\u7F16\u9020\u91C7\u8BBF\u548C\u771F\u5B9E\u7ECF\u5386\u3002",
    "creative_fields": {
      "central_question": "\u8981\u56DE\u5E94\u7684\u5177\u4F53\u95EE\u9898",
      "evidence_plan": "\u5DF2\u6709\u6765\u6E90\u4E0E\u5F85\u8865\u8BC1\u636E\u8BA1\u5212"
    },
    "script_fields": {
      "evidence_sources": "\u8BBA\u636E\u4E0E\u5BF9\u5E94\u6765\u6E90\uFF0C\u7F3A\u5931\u6807\u5F85\u6838\u5B9E",
      "fact_fiction_boundary": "\u4E8B\u5B9E\u3001\u89E3\u91CA\u548C\u91CD\u73B0\u7684\u8FB9\u754C"
    },
    "review_criteria": [
      {
        "id": "documentary_1",
        "description": "\u5173\u952E\u9648\u8FF0\u662F\u5426\u6709\u6765\u6E90\u6216\u660E\u786E\u5F85\u6838\u5B9E"
      },
      {
        "id": "documentary_2",
        "description": "\u4E8B\u5B9E\u4E0E\u865A\u6784\u91CD\u73B0\u662F\u5426\u6E05\u695A\u533A\u5206"
      }
    ],
    "role_rules": {
      "screenwriter": "\u7528\u53EF\u6838\u5B9E\u6750\u6599\u652F\u6491\u8BF4\u660E\uFF0C\u4E0D\u4E3A\u5236\u9020\u51B2\u7A81\u7F16\u9020\u771F\u5B9E\u4EBA\u7269\u5FC3\u7406\u3002",
      "storyboard": "\u8BC1\u636E\u753B\u9762\u4E0E\u89E3\u91CA\u5BF9\u5E94\uFF0C\u91CD\u73B0\u987B\u660E\u786E\u6807\u8BC6\uFF0C\u753B\u9762\u4E0D\u80FD\u6697\u793A\u672A\u7ECF\u8BC1\u5B9E\u7684\u56E0\u679C\u3002"
    }
  };

  // src/businesses/film-director/profiles/commercial.ts
  var commercial_default = {
    "id": "COMMERCIAL",
    "revision": "1",
    "label": "\u4EA7\u54C1\u5E7F\u544A",
    "strategy": "\u9700\u6C42\u2192\u4F7F\u7528\u8FC7\u7A0B\u2192\u4EF7\u503C\u8BC1\u636E\u2192\u884C\u52A8",
    "boundary": "\u4EA7\u54C1\u5916\u89C2\u3001\u529F\u6548\u3001\u6570\u636E\u4E0E\u8BA4\u8BC1\u987B\u6709\u4F9D\u636E\uFF0C\u4E0D\u901A\u8FC7\u753B\u9762\u6697\u793A\u672A\u8BC1\u5B9E\u6548\u679C\u3002",
    "creative_fields": {
      "user_need": "\u5177\u4F53\u7528\u6237\u9700\u6C42",
      "supported_benefit": "\u6709\u8D44\u6599\u652F\u6301\u7684\u4EA7\u54C1\u5229\u76CA"
    },
    "script_fields": {
      "claims_and_evidence": "\u5356\u70B9\u53CA\u5BF9\u5E94\u4F9D\u636E\uFF0C\u7F3A\u5931\u6807\u5F85\u6838\u5B9E",
      "usage_and_action": "\u53EF\u89C2\u5BDF\u4F7F\u7528\u8FC7\u7A0B\u4E0E\u884C\u52A8\u5F15\u5BFC"
    },
    "review_criteria": [
      {
        "id": "commercial_1",
        "description": "\u5356\u70B9\u662F\u5426\u7531\u6750\u6599\u652F\u6301"
      },
      {
        "id": "commercial_2",
        "description": "\u4F7F\u7528\u8FC7\u7A0B\u662F\u5426\u6E05\u695A\u4E14\u4EA7\u54C1\u8EAB\u4EFD\u51C6\u786E"
      }
    ],
    "role_rules": {
      "screenwriter": "\u5C55\u793A\u771F\u5B9E\u9700\u6C42\u4E0E\u4F7F\u7528\u8FC7\u7A0B\uFF0C\u907F\u514D\u5806\u5356\u70B9\u53CA\u65E0\u4F9D\u636E\u524D\u540E\u6548\u679C\u3002",
      "storyboard": "\u5173\u952E\u4EA7\u54C1\u7EC6\u8282\u548C\u4F7F\u7528\u6B65\u9AA4\u6E05\u695A\u53EF\u89C1\uFF0C\u54C1\u724C\u6587\u5B57\u4E0ELogo\u4F9D\u8D56\u6388\u6743\u7D20\u6750\u53CA\u540E\u671F\u80FD\u529B\u3002"
    }
  };

  // src/businesses/film-director/profiles/promotional.ts
  var promotional_default = {
    "id": "PROMOTIONAL",
    "revision": "1",
    "label": "\u54C1\u724C\uFF0F\u5730\u57DF\u5BA3\u4F20",
    "strategy": "\u8BC6\u522B\u7279\u5F81\u2192\u5177\u4F53\u751F\u6D3B\u2192\u4EBA\u7269\u6216\u89C2\u5BDF\u5BF9\u8C61\u2192\u60C5\u7EEA\u843D\u70B9",
    "boundary": "\u5730\u57DF\u548C\u54C1\u724C\u7279\u5F81\u5177\u4F53\u53EF\u4FE1\uFF0C\u4E0D\u7528\u7A7A\u6CDB\u8D5E\u7F8E\u66FF\u4EE3\u5185\u5BB9\uFF1B\u4E0D\u5F3A\u5236\u589E\u52A0\u4EBA\u7269\u3002",
    "creative_fields": {
      "recognizable_identity": "\u54C1\u724C\u6216\u5730\u57DF\u7684\u53EF\u8FA8\u8BC6\u7279\u5F81",
      "emotional_anchor": "\u60C5\u7EEA\u843D\u70B9\u53CA\u5176\u5177\u4F53\u8F7D\u4F53"
    },
    "script_fields": {
      "distinctive_details": "\u5177\u6709\u8FA8\u8BC6\u5EA6\u7684\u751F\u6D3B\u6216\u54C1\u724C\u7EC6\u8282",
      "identity_progression": "\u7EC6\u8282\u5982\u4F55\u5171\u540C\u5448\u73B0\u4E3B\u9898"
    },
    "review_criteria": [
      {
        "id": "promotional_1",
        "description": "\u753B\u9762\u662F\u5426\u5177\u6709\u5F53\u5730\u6216\u54C1\u724C\u8FA8\u8BC6\u5EA6"
      },
      {
        "id": "promotional_2",
        "description": "\u60C5\u7EEA\u662F\u5426\u7531\u5177\u4F53\u7EC6\u8282\u800C\u975E\u53E3\u53F7\u652F\u6491"
      }
    ],
    "role_rules": {
      "screenwriter": "\u628A\u8EAB\u4EFD\u7279\u5F81\u843D\u5728\u5177\u4F53\u4F7F\u7528\u6216\u751F\u6D3B\u7EC6\u8282\uFF0C\u771F\u5B9E\u5730\u70B9\u8D44\u6599\u4E0D\u8DB3\u6807\u5F85\u6838\u5B9E\u3002",
      "storyboard": "\u7A7A\u95F4\u3001\u4EBA\u7269\u6216\u7269\u4EF6\u5173\u7CFB\u4F53\u73B0\u5730\u57DF\u54C1\u724C\u7279\u5F81\uFF0C\u4E0D\u7528\u901A\u7528\u822A\u62CD\u548C\u7D20\u6750\u5806\u780C\u66FF\u4EE3\u3002"
    }
  };

  // src/businesses/film-director/profiles/index.ts
  var REGISTRY2 = Object.fromEntries([drama_default, comedy_default, lifestyle_default, documentary_default, commercial_default, promotional_default].map((p) => [p.id, p]));
  var WORK_TYPES = Object.keys(REGISTRY2);
  function availableProfiles() {
    return Object.values(REGISTRY2).map((p) => ({ work_type: p.id, label: p.label, profile_revision: p.revision, strategy: p.strategy }));
  }

  // src/businesses/video/client/canvas-view.ts
  var TEXT_WRITE_TIMEOUT_MS = 18e4;
  async function canvasNativeRpc(args, fetcher = fetch, timeoutMs = 2e4) {
    const response = await fetcher("/metaontic-video/canvas-native", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args), signal: AbortSignal.timeout(timeoutMs) });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("\u753B\u5E03\u5236\u4F5C\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u6838\u5BF9\u63D2\u4EF6\u52A0\u8F7D\u72B6\u6001\u3002");
    }
    if (!response.ok || body?.error) throw new Error(body?.error || "\u5236\u4F5C\u8BF7\u6C42\u672A\u5B8C\u6210\uFF0C\u8BF7\u67E5\u8BE2\u539F\u8BB0\u5F55\uFF0C\u4E0D\u8981\u91CD\u590D\u751F\u6210\u3002");
    return body;
  }
  function duplicateNodePayload(node, spot) {
    const data = {};
    for (const key of ["label", "prompt", "text", "output", "script", "requirement", "ratio", "resolution", "duration"]) {
      if (node?.data?.[key] !== void 0) data[key] = node.data[key];
    }
    if (node?.data?.[MATERIAL_MARK]) {
      data[MATERIAL_MARK] = true;
      if (node.data.metaonticSegmentOf) data.metaonticSegmentOf = node.data.metaonticSegmentOf;
    }
    return { type: node?.type || "text", x: Number(spot?.x || 0) + 40, y: Number(spot?.y || 0) + 40, w: spot?.w, h: spot?.h, data };
  }
  function producedNodeIds(canvas) {
    return new Set(Object.values(canvas?.nodes || {}).map((node) => node?.metaonticSourceNode).filter(Boolean));
  }
  function flowSteps(canvas) {
    const nodes = Object.values(canvas?.nodes || {});
    const edges = Array.isArray(canvas?.edges) ? canvas.edges : [];
    const produced = producedNodeIds(canvas);
    const author = flowAuthors(canvas);
    const byId = new Map(author.map((node) => [node.id, node]));
    const inbound = new Map(author.map((node) => [node.id, []]));
    for (const edge of edges) {
      if (edge?.metaonticResult) continue;
      if (byId.has(edge?.toNode) && byId.has(edge?.fromNode)) inbound.get(edge.toNode).push(edge.fromNode);
    }
    const ordered = [], seen = /* @__PURE__ */ new Set();
    const visit = (node) => {
      if (!node || seen.has(node.id)) return;
      seen.add(node.id);
      for (const up of inbound.get(node.id) || []) visit(byId.get(up));
      ordered.push(node);
    };
    for (const node of author) visit(node);
    return ordered.map((node) => ({ id: node.id, type: node.type, label: String(node?.data?.label || (node.type === "image" ? "\u56FE\u7247" : "\u89C6\u9891")), done: produced.has(node.id) }));
  }
  function filmStatus(canvas) {
    const nodes = Object.values(canvas?.nodes || {});
    const order = flowSteps(canvas).filter((step) => step.type === "video");
    const missing = order.filter((step) => !nodes.some((node) => node?.metaonticSourceNode === step.id && node?.type === "video" && (node?.data?.assetId || node?.data?.metaonticVideoUrl)));
    return { total: order.length, readyCount: order.length - missing.length, missing: missing.map((step) => step.label) };
  }
  var NODE_SIZE = { script: [420, 320], storyboard: [460, 340], text: [360, 200], video: [360, 300], image: [360, 300] };
  function nodeSize(node) {
    const fallback = NODE_SIZE[node?.type] || [360, 260];
    return { w: Number(node?.w) || fallback[0], h: Number(node?.h) || fallback[1] };
  }
  function tidyLayout(canvas) {
    const nodes = Object.values(canvas?.nodes || {}).filter((node) => !node?.data?.metaonticStage);
    const positions = {};
    if (!nodes.length) return { positions, moved: 0, width: 0, height: 0 };
    const GAP_X = 140, GAP_Y = 56, MARGIN = 60, GRID = 10;
    const ids = new Set(nodes.map((node) => node.id));
    const links = (Array.isArray(canvas?.edges) ? canvas.edges : []).filter((edge) => ids.has(edge?.fromNode) && ids.has(edge?.toNode) && edge.fromNode !== edge.toNode);
    const inbound = new Map(nodes.map((node) => [node.id, []]));
    const outbound = new Map(nodes.map((node) => [node.id, []]));
    for (const edge of links) {
      inbound.get(edge.toNode).push(edge.fromNode);
      outbound.get(edge.fromNode).push(edge.toNode);
    }
    const layer = new Map(nodes.map((node) => [node.id, 0]));
    const indegree = new Map(nodes.map((node) => [node.id, (inbound.get(node.id) || []).length]));
    const queue = nodes.filter((node) => (indegree.get(node.id) || 0) === 0).map((node) => node.id);
    const settled = /* @__PURE__ */ new Set();
    const settle = (id) => {
      if (settled.has(id)) return;
      settled.add(id);
      for (const down of outbound.get(id) || []) {
        if (settled.has(down)) continue;
        layer.set(down, Math.max(layer.get(down) || 0, (layer.get(id) || 0) + 1));
        indegree.set(down, (indegree.get(down) || 0) - 1);
        if ((indegree.get(down) || 0) <= 0) queue.push(down);
      }
    };
    const drain = () => {
      while (queue.length) settle(queue.shift());
    };
    drain();
    for (const node of nodes) {
      if (!settled.has(node.id)) {
        settle(node.id);
        drain();
      }
    }
    const ranks = [...new Set(nodes.map((node) => layer.get(node.id) || 0))].sort((a, b) => a - b);
    const columnOf = new Map(ranks.map((rank, index) => [rank, index]));
    const columns = ranks.map(() => []);
    for (const node of nodes) columns[columnOf.get(layer.get(node.id) || 0)].push(node);
    const widthOfColumn = columns.map((column) => Math.max(...column.map((node) => nodeSize(node).w)));
    const lefts = [];
    let cursor = MARGIN;
    for (const width2 of widthOfColumn) {
      lefts.push(cursor);
      cursor += width2 + GAP_X;
    }
    const width = cursor - GAP_X + MARGIN;
    const stack = (order2) => {
      const tops = /* @__PURE__ */ new Map();
      let height = 0;
      for (const column of order2) {
        let y = MARGIN;
        for (const node of column) {
          tops.set(node.id, y);
          y += nodeSize(node).h + GAP_Y;
        }
        height = Math.max(height, y - GAP_Y + MARGIN);
      }
      const centers = /* @__PURE__ */ new Map();
      for (const column of order2) for (const node of column) centers.set(node.id, (tops.get(node.id) || 0) + nodeSize(node).h / 2);
      return { tops, centers, height };
    };
    const barycenter = (node, centers) => {
      const around = [...inbound.get(node.id) || [], ...outbound.get(node.id) || []].map((id) => centers.get(id)).filter((value) => typeof value === "number");
      return around.length ? around.reduce((sum, value) => sum + value, 0) / around.length : Number.POSITIVE_INFINITY;
    };
    let order = columns;
    let draft = stack(order);
    for (let round = 0; round < 3; round += 1) {
      order = order.map((column) => [...column].sort((a, b) => barycenter(a, draft.centers) - barycenter(b, draft.centers) || String(a.id).localeCompare(String(b.id))));
      draft = stack(order);
    }
    const snap = (value) => Math.round(value / GRID) * GRID;
    let moved = 0;
    order.forEach((column, index) => {
      const columnHeight = column.reduce((sum, node) => sum + nodeSize(node).h + GAP_Y, -GAP_Y);
      const offset = snap((draft.height - columnHeight) / 2);
      for (const node of column) {
        const x = snap(lefts[index]);
        const y = snap((draft.tops.get(node.id) || 0) + offset);
        positions[node.id] = { x, y };
        if (Math.round(Number(node.x) || 0) !== x || Math.round(Number(node.y) || 0) !== y) moved += 1;
      }
    });
    return { positions, moved, width, height: draft.height };
  }
  function createCanvasView({ React, h, TOKENS, PAGE_CSS = "" }) {
    const ROOT_CLASS = "mov-section movc";
    const rpc = async (method, args = {}) => {
      const response = await fetch("/metaontic-video/canvas", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ method, args }) });
      const body = await response.json().catch(() => ({}));
      if (!response.ok || body?.error) throw new Error(body?.error || "\u6D41\u7A0B\u753B\u5E03\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\uFF0C\u8BF7\u6838\u5BF9\u63D2\u4EF6\u52A0\u8F7D\u72B6\u6001\u3002");
      return body;
    };
    const mediaUrl = (assetId) => `/metaontic-video/canvas-media?assetId=${encodeURIComponent(assetId)}`;
    const sizeOf = (node) => nodeSize(node);
    const labelOf = (node) => String(node?.data?.label || { script: "\u5267\u672C", storyboard: "\u5206\u955C", text: "\u8BF4\u660E", video: "\u89C6\u9891", image: "\u56FE\u7247" }[node?.type] || "\u8282\u70B9");
    const textOf2 = (node) => String(node?.data?.output || node?.data?.text || node?.data?.prompt || "");
    const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
    const RESOLUTIONS = ["480p", "720p"];
    const money2 = (value) => Number.isFinite(Number(value)) ? `\xA5${(Math.round(Number(value) * 1e4) / 1e4).toFixed(4)}` : "\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39";
    const phaseText = (state) => ({
      succeeded: "\u751F\u6210\u6210\u529F",
      running: "\u6B63\u5728\u5236\u4F5C",
      interrupted: "\u5DF2\u4E2D\u65AD\uFF0C\u53EF\u67E5\u8BE2\u539F\u4EFB\u52A1",
      failed: "\u5236\u4F5C\u5931\u8D25\uFF0C\u672A\u81EA\u52A8\u91CD\u8BD5",
      unknown: "\u4EFB\u52A1\u72B6\u6001\u5F85\u786E\u8BA4",
      submission_unknown: "\u63D0\u4EA4\u7ED3\u679C\u672A\u786E\u8BA4",
      cancelled: "\u5DF2\u53D6\u6D88"
    })[state] || "\u72B6\u6001\u672A\u77E5";
    const CSS = `
.movc { display: flex; flex-direction: column; gap: 14px; }
.movc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.movc-top { display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 4px; padding: 12px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
.movc-list { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; overflow-y: hidden; padding-bottom: 2px; }
.movc-pick { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; }
.movc-name-empty { font-size: 13px; font-weight: 600; color: ${TOKENS.muted}; }
/* \u753B\u5E03\u5185\u6309\u94AE\u7EDF\u4E00\u6210\u4E00\u5957\uFF1A\u63CF\u8FB9 + \u4E3B\u8272\u60AC\u505C\uFF0C\u4E0D\u5403\u5BBF\u4E3B\u9ED8\u8BA4\u7684\u7070\u5E95\uFF1B\u4E3B\u6309\u94AE\u624D\u7528\u5B9E\u5FC3\u4E3B\u8272\u3002 */
.movc .mov-btn, .movc-modal .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
.movc .mov-btn:hover:not(:disabled), .movc-modal .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; background: transparent; color: ${TOKENS.primaryFill}; }
.movc .mov-btn:disabled, .movc-modal .mov-btn:disabled { opacity: .5; cursor: default; }
.movc .mov-btn-primary, .movc-modal .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
.movc .mov-btn-primary:hover:not(:disabled), .movc-modal .mov-btn-primary:hover:not(:disabled) { background: ${TOKENS.primaryFill}; color: #fff; opacity: .88; }
.movc .movc-danger:hover:not(:disabled), .movc-modal .movc-danger:hover:not(:disabled) { border-color: ${TOKENS.error}; color: ${TOKENS.error}; }
/* \u5DE5\u5177\u6761\u6309\u94AE\uFF1A\u53EA\u628A\u56FA\u5B9A 120px \u5BBD\u6539\u6210\u6309\u5185\u5BB9\u6392\u5E03\uFF0C\u9AD8\u5EA6\u4E0E\u5185\u8DDD\u548C\u9009\u62E9\u753B\u5E03\u80F6\u56CA\u5BF9\u9F50\u3002 */
.movc-ops { flex: 1 1 auto; min-width: 0; gap: 6px; row-gap: 8px; container-type: inline-size; }
.movc-ops .mov-btn { flex: 0 0 auto; width: auto; min-width: 0; height: 32px; min-height: 32px; padding: 0 14px; overflow-wrap: normal; }
.movc-flow { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; white-space: nowrap; }
/* \u6D41\u7A0B\u4E3B\u884C\u52A8\uFF1A\u7528\u4E3B\u8272\u63CF\u8FB9\u7A81\u51FA\uFF0C\u4F46\u4E0D\u548C\u300C\u65B0\u5EFA\u753B\u5E03\u2026\u300D\u7684\u5B9E\u5FC3\u4E3B\u6309\u94AE\u62A2\u6CE8\u610F\u529B\u3002 */
.movc-ops .movc-run { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-ops .movc-run:disabled { border-color: ${TOKENS.border}; color: ${TOKENS.text}; }
.movc-sep { flex: 0 0 auto; width: 1px; height: 18px; margin: 0 2px; background: ${TOKENS.border}; }
/* \u9762\u677F\u7A84\u7684\u65F6\u5019\u6309\u94AE\u672C\u6765\u5C31\u4F1A\u6362\u884C\uFF0C\u5206\u7EC4\u7AD6\u7EBF\u4F1A\u843D\u5728\u884C\u9996\uFF0C\u76F4\u63A5\u4E0D\u6536\u3002 */
@container (max-width: 460px) { .movc-sep { display: none; } }
.movc-ops .mov-btn:focus-visible, .movc-chip:focus-visible, .movc-mini:focus-visible, .movc-name-text:focus-visible { outline: 2px solid ${TOKENS.primaryFill}; outline-offset: 1px; }
.movc-ops .mov-btn:active:not(:disabled), .movc-chip:active, .movc-mini:active { opacity: .82; }
.movc-chip { display: inline-flex; align-items: center; box-sizing: border-box; height: 32px; padding: 0 14px; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; white-space: nowrap; cursor: pointer; transition: background .15s, border-color .15s, color .15s; }
.movc-chip:hover { border-color: ${TOKENS.primaryFill}; background: transparent; color: ${TOKENS.primaryFill}; }
.movc-chip[data-active="true"] { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
.movc-hint { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.6; }
.movc-stage { position: relative; height: clamp(520px, calc(100vh - 320px), 1400px); border: 1px solid ${TOKENS.border}; border-radius: 12px; background-color: ${TOKENS.controlFill}; background-image: radial-gradient(${TOKENS.border} 1px, transparent 1px); background-size: 22px 22px; overflow: hidden; cursor: grab; touch-action: none; }
.movc-stage[data-panning="true"] { cursor: grabbing; }
.movc-stage[data-connect="true"] { cursor: crosshair; }
.movc-world { position: absolute; inset: 0; transform-origin: 0 0; }
.movc-edge { stroke: ${TOKENS.primaryFill}; stroke-width: 2; fill: none; opacity: .75; }
.movc-edge-hit { stroke: transparent; stroke-width: 14; fill: none; cursor: pointer; }
.movc-node { position: absolute; display: flex; flex-direction: column; gap: 6px; padding: 10px 12px; border: 1px solid ${TOKENS.border}; border-radius: 10px; background: ${TOKENS.cardFill}; box-shadow: 0 1px 4px #0000000f; overflow: hidden; cursor: grab; }
.movc-node:hover { box-shadow: 0 3px 12px #0000001f; }
.movc-node[data-selected="true"] { border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 1px ${TOKENS.primaryFill}, 0 3px 12px #0000001f; }
.movc-node[data-current="true"]:not([data-selected="true"]) { outline: 2px dashed ${TOKENS.primaryFill}; outline-offset: 2px; }
.movc-node[data-stage-state="active"] { border-color: ${TOKENS.primaryFill}; }
.movc-node[data-stage-state="active"] .movc-node-title { color: ${TOKENS.primaryFill}; }
.movc-stage-edge { stroke: ${TOKENS.primaryFill}; stroke-width: 1.6; stroke-dasharray: 6 5; fill: none; opacity: .7; }
.movc-stage-arrowhead { fill: ${TOKENS.primaryFill}; opacity: .75; }
.movc-stage-text { font-size: 12px; line-height: 1.7; white-space: pre-wrap; }
.movc-node[data-stage-state] .movc-body { display: flex; flex-direction: column; gap: 8px; }
.movc-stage-action { margin-top: auto; align-self: flex-start; display: inline-flex; align-items: center; height: 28px; padding: 0 12px; border: 1px solid ${TOKENS.primaryFill}; border-radius: 8px; background: transparent; color: ${TOKENS.primaryFill}; font: inherit; font-size: 12px; cursor: pointer; transition: background .15s, color .15s; }
.movc-stage-action:hover { background: ${TOKENS.primaryFill}; color: #fff; }
.movc-stage-active { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; font-weight: 600; }
.movc-stage-review { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-node-head { display: flex; align-items: center; gap: 6px; flex-wrap: wrap; }
.movc-node-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
.movc-badge { color: ${TOKENS.muted}; }
.movc-actions { display: flex; flex-wrap: wrap; gap: 4px; margin-left: auto; }
.movc-mini { flex: 0 0 auto; font: inherit; font-size: 11px; padding: 3px 10px; border: 1px solid ${TOKENS.border}; border-radius: 6px; background: transparent; color: ${TOKENS.text}; cursor: pointer; transition: border-color .15s, color .15s, opacity .15s; }
.movc-mini:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-mini-danger:hover { border-color: ${TOKENS.error}; color: ${TOKENS.error}; }
.movc-mini-primary { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-body { font-size: 12px; line-height: 1.6; color: ${TOKENS.muted}; white-space: pre-wrap; overflow: auto; flex: 1; }
.movc-media { width: 100%; height: 100%; object-fit: contain; border-radius: 6px; background: #0001; }
.movc-shots { margin: 0; padding-left: 16px; }
.movc-modal { position: fixed; inset: 0; background: #0006; display: flex; align-items: center; justify-content: center; z-index: 2147483000; }
.movc-modal-body { width: min(640px, calc(100vw - 32px)); max-height: 86vh; overflow: auto; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 12px; padding: 18px 20px; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; display: flex; flex-direction: column; gap: 8px; }
.movc-modal-body h4 { margin: 0; font-size: 14px; }
.movc-field { display: flex; flex-direction: column; gap: 4px; font-size: 12px; }
.movc-field textarea, .movc-field input, .movc-field select { width: 100%; box-sizing: border-box; font: inherit; color: inherit; background: ${TOKENS.controlFill}; border: 1px solid ${TOKENS.border}; border-radius: 8px; padding: 6px 8px; }
.movc-field textarea { min-height: 88px; resize: vertical; }
.movc-row { display: flex; gap: 8px; flex-wrap: wrap; }
.movc-row > * { flex: 1 1 120px; }
.movc-check { display: block; font-size: 12px; line-height: 1.6; margin: 4px 0; }
.movc-status { font-size: 12px; color: ${TOKENS.muted}; line-height: 1.6; }
.movc-status[data-error="true"] { color: #c0392b; }
.movc-plan { font-size: 12px; line-height: 1.7; background: ${TOKENS.controlFill}; border-radius: 8px; padding: 10px 12px; }
.movc-link { display: inline-flex; align-items: center; box-sizing: border-box; height: 32px; padding: 0 14px; border: 1px solid ${TOKENS.border}; border-radius: 8px; color: ${TOKENS.text}; font-size: 12px; text-decoration: none; white-space: nowrap; transition: border-color .15s, color .15s; }
.movc-link:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-marquee { position: absolute; border: 1px dashed ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}1f; pointer-events: none; border-radius: 4px; }
.movc-flow-entry { position: absolute; left: 12px; top: 12px; z-index: 2; display: inline-flex; align-items: center; height: 30px; padding: 0 12px; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: ${TOKENS.cardFill}; color: ${TOKENS.text}; font: inherit; font-size: 12px; cursor: pointer; transition: border-color .15s, color .15s; }
.movc-flow-entry:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-invite { position: absolute; left: 50%; top: 50%; transform: translate(-50%, -50%); z-index: 2; display: flex; flex-direction: column; align-items: center; gap: 8px; padding: 22px 26px; border: 1px dashed ${TOKENS.border}; border-radius: 14px; background: ${TOKENS.cardFill}; color: ${TOKENS.muted}; cursor: pointer; text-align: center; }
.movc-invite:hover { border-color: ${TOKENS.primaryFill}; }
.movc-invite strong { font-size: 14px; color: ${TOKENS.text}; }
.movc-invite span { font-size: 12px; line-height: 1.6; max-width: 340px; }
.movc-name { display: inline-flex; align-items: center; gap: 6px; flex: 1 1 160px; min-width: 0; }
.movc-name-text { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; border: 1px solid transparent; border-radius: 8px; padding: 5px 12px; font-size: 14px; font-weight: 600; color: ${TOKENS.text}; background: transparent; cursor: text; }
.movc-name-text:hover { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-name input { flex: 1 1 auto; min-width: 0; font: inherit; font-size: 13px; color: inherit; background: ${TOKENS.controlFill}; border: 1px solid ${TOKENS.primaryFill}; border-radius: 8px; padding: 5px 12px; }
.movc-name-err { flex: 1 1 100%; font-size: 12px; color: #c0392b; }
/* \u5F39\u7A97\u91CC\u7684\u6309\u94AE\u6309\u5185\u5BB9\u81EA\u9002\u5E94\uFF0C\u4E0D\u6491\u6210\u8BBE\u7F6E\u9875\u90A3\u79CD 120px \u65B9\u5757\u3002 */
.movc-modal .mov-btn { flex: 0 0 auto; width: auto; min-width: 104px; border-radius: 8px; white-space: nowrap; overflow-wrap: normal; }
`;
    function shotVisual(shot) {
      const visual = String(shot?.visual || shot?.text || shot?.scene || "").trim();
      const line = visual.split(/\r?\n/).map((part) => part.trim()).find((part) => /^(?:画面|visual)[:：]/.test(part));
      return (line ? line.replace(/^(?:画面|visual)[:：]\s*/, "") : visual).trim();
    }
    function nodeBody(node) {
      const data = node?.data || {};
      if (data.assetId) return h(node.type === "image" ? "img" : "video", {
        key: "media",
        className: "movc-media",
        ...node.type === "image" ? { src: mediaUrl(data.assetId), alt: data.label || "" } : { src: mediaUrl(data.assetId), controls: true, preload: "metadata" }
      });
      if (node.type === "storyboard" && Array.isArray(data.shots) && data.shots.length) return h("div", { key: "shots", className: "movc-body" }, [
        h("ul", { key: "list", className: "movc-shots" }, data.shots.slice(0, 12).map((shot, index) => h("li", { key: index }, `${shot?.index || index + 1}. ${[shot?.camera, shotVisual(shot).slice(0, 60)].filter(Boolean).join(" \xB7 ")}`))),
        data.shots.length > 12 ? h("div", { key: "more" }, `\u2026\u5171 ${data.shots.length} \u4E2A\u955C\u5934`) : null
      ]);
      const text = textOf2(node);
      return h("div", { key: "text", className: "movc-body" }, text ? text.slice(0, 600) : "\uFF08\u6682\u65E0\u5185\u5BB9\uFF0C\u53EF\u5148\u7F16\u8F91\uFF09");
    }
    const chainStatusText = (chain) => ({
      running: `\u8FDE\u62CD\u8FDB\u884C\u4E2D\uFF1A\u7B2C ${chain.index + 1}/${chain.total} \u6BB5\u751F\u6210\u4E2D\u2026`,
      review: `\u7B2C ${chain.index + 1}/${chain.total} \u6BB5\u5DF2\u6709\u6210\u679C\uFF0C\u7B49\u4F60\u5BA1\u6838`,
      done: `\u8FDE\u62CD\u5B8C\u6210\uFF1A${chain.total} \u6BB5\u90FD\u5DF2\u6709\u6210\u679C`,
      stopped: `\u8FDE\u62CD\u5DF2\u505C\u6B62\uFF1A\u5DF2\u5B8C\u6210 ${chain.done}/${chain.total} \u6BB5`,
      stale: `\u8FDE\u62CD\u9700\u8981\u91CD\u6392\uFF1A\u5DF2\u5B8C\u6210 ${chain.done}/${chain.total} \u6BB5`
    })[chain.state] || `\u8FDE\u62CD\u72B6\u6001\uFF1A${chain.state}`;
    function FlowCanvas() {
      const [list, setList] = React.useState([]);
      const [canvas, setCanvas] = React.useState(null);
      const [error, setError] = React.useState("");
      const [notice, setNotice] = React.useState("");
      const [view, setView] = React.useState({ x: 30, y: 24, scale: 1 });
      const [panning, setPanning] = React.useState(false);
      const [positions, setPositions] = React.useState({});
      const [selectedIds, setSelectedIds] = React.useState([]);
      const [marquee, setMarquee] = React.useState(null);
      const [connectFrom, setConnectFrom] = React.useState("");
      const [inline, setInline] = React.useState(null);
      const [createDialog, setCreateDialog] = React.useState(null);
      const [scriptDialog, setScriptDialog] = React.useState(null);
      const [clock, setClock] = React.useState(0);
      const [chainDialog, setChainDialog] = React.useState(null);
      const [filmDialog, setFilmDialog] = React.useState(null);
      const [importing, setImporting] = React.useState(false);
      const [confirmDelete, setConfirmDelete] = React.useState(false);
      const [dialog, setDialog] = React.useState(null);
      const pan = React.useRef(null);
      const moving = React.useRef(null);
      const marqueeDone = React.useRef(false);
      const timer = React.useRef(null);
      const chainTimer = React.useRef(null);
      const importRef = React.useRef(null);
      const alive = React.useRef(true);
      const stageRef = React.useRef(null);
      React.useEffect(() => () => {
        alive.current = false;
        if (timer.current) clearInterval(timer.current);
        if (chainTimer.current) clearInterval(chainTimer.current);
      }, []);
      React.useEffect(() => {
        if (!scriptDialog?.writing) return void 0;
        const ticker = setInterval(() => setClock(Date.now()), 1e3);
        return () => clearInterval(ticker);
      }, [scriptDialog?.writing]);
      const load = React.useCallback(async (projectId) => {
        try {
          setError("");
          const { canvases } = await rpc("list");
          const wanted = projectId || canvases[0]?.projectId;
          setList(canvases);
          if (!wanted) {
            setCanvas(null);
            setInline(null);
            return;
          }
          const { canvas: doc } = await rpc("get", { projectId: wanted });
          setCanvas(doc);
          setInline(null);
          setPositions({});
          setSelectedIds([]);
          setMarquee(null);
        } catch (e) {
          setError(e?.message || "\u6D41\u7A0B\u753B\u5E03\u8BFB\u53D6\u5931\u8D25");
        }
      }, []);
      React.useEffect(() => {
        void load();
      }, [load]);
      const refresh = React.useCallback(async () => {
        if (canvas?.projectId) await load(canvas.projectId);
      }, [canvas, load]);
      const saveNode = React.useCallback(async (id, patch) => {
        if (!canvas) return;
        const current = (canvas.nodes || {})[id] || {};
        const { canvas: saved } = await rpc("nodeSave", { projectId: canvas.projectId, node: { ...current, id, ...patch, data: { ...current.data || {}, ...patch.data || {} } } });
        setCanvas((doc) => doc ? { ...doc, nodes: { ...doc.nodes, [saved.node.id]: saved.node } } : doc);
        setPositions((all) => {
          const next = { ...all };
          delete next[id];
          return next;
        });
      }, [canvas]);
      const removeNodes = React.useCallback(async (ids) => {
        if (!canvas || !ids.length) return;
        for (const id of ids) await rpc("nodeDelete", { projectId: canvas.projectId, nodeId: id });
        setSelectedIds((all) => all.filter((id) => !ids.includes(id)));
        if (connectFrom && ids.includes(connectFrom)) setConnectFrom("");
        await refresh();
      }, [canvas, connectFrom, refresh]);
      const duplicateNode = React.useCallback(async (node) => {
        if (!canvas) return;
        const spot = { ...sizeOf(node), ...positions[node.id] || {} };
        const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        await saveNode(id, duplicateNodePayload(node, spot));
        setSelectedIds([id]);
        setNotice("\u5DF2\u590D\u5236\u8282\u70B9\uFF08\u4E0D\u542B\u6210\u679C\u7D20\u6750\u4E0E\u539F\u4EFB\u52A1\u6807\u8BC6\uFF09\uFF1B\u6539\u5B8C\u5185\u5BB9\u518D\u751F\u6210\uFF0C\u8D39\u7528\u7167\u5E38\u5355\u72EC\u786E\u8BA4\u3002");
      }, [canvas, positions, saveNode]);
      const exportCanvas = React.useCallback(() => {
        if (!canvas || typeof document === "undefined") return;
        try {
          const payload = { name: canvas.name, projectId: canvas.projectId, view: canvas.view, nodes: canvas.nodes, edges: canvas.edges, exportedAt: (/* @__PURE__ */ new Date()).toISOString() };
          const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
          const url = URL.createObjectURL(blob);
          const link = document.createElement("a");
          link.href = url;
          link.download = `${String(canvas.name || canvas.projectId).replace(/[\\/:*?"<>|]/g, "_")}.canvas.json`;
          document.body.append(link);
          link.click();
          link.remove();
          setTimeout(() => URL.revokeObjectURL(url), 1e3);
        } catch (e) {
          setError(e?.message || "\u5BFC\u51FA\u753B\u5E03\u5931\u8D25");
        }
      }, [canvas]);
      const importImages = React.useCallback(async (files, attachTo) => {
        const picked = Array.from(files || []);
        if (!canvas || !picked.length) return;
        setError("");
        setImporting(true);
        const made = [];
        try {
          for (const file of picked) {
            const response = await fetch(
              `/metaontic-video/canvas-import?projectId=${encodeURIComponent(canvas.projectId)}&name=${encodeURIComponent(String(file?.name || ""))}`,
              { method: "POST", headers: { "content-type": file?.type || "application/octet-stream" }, body: file }
            );
            const body = await response.json().catch(() => ({}));
            if (!response.ok || body?.error) throw new Error(body?.error || "\u5BFC\u5165\u56FE\u7247\u672A\u5B8C\u6210\u3002");
            const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const count = Object.keys(canvas.nodes || {}).length + made.length;
            await saveNode(id, {
              type: "image",
              x: 60 + count % 4 * 420,
              y: 60 + Math.floor(count / 4) * 360,
              w: NODE_SIZE.image[0],
              h: NODE_SIZE.image[1],
              data: {
                label: body.name || String(file?.name || "\u5BFC\u5165\u56FE\u7247"),
                assetId: body.assetId,
                ratio: "1:1",
                resolution: "720p",
                prompt: "",
                ...attachTo ? { metaonticSegmentOf: attachTo } : {}
              }
            });
            if (attachTo) await rpc("edgeAdd", { projectId: canvas.projectId, fromNode: id, toNode: attachTo, fromPort: "out", toPort: "ref" });
            made.push(id);
          }
          if (made.length) {
            setSelectedIds(made);
            await refresh();
            if (attachTo) setNotice(`\u5DF2\u5BFC\u5165 ${made.length} \u5F20\u53C2\u8003\u7D20\u6750\uFF0C\u5E76\u8FDE\u5230\u672C\u8282\u70B9\u7684\u300C\u53C2\u8003\u56FE\u300D\u7AEF\u53E3\uFF1B\u5728\u5236\u4F5C\u7A97\u53E3\u91CC\u4E5F\u53EF\u4EE5\u628A\u7AEF\u53E3\u5207\u6210\u300C\u9996\u5E27\u300D\u3002\u771F\u4EBA\u7167\u7247\u4F1A\u88AB\u89C6\u9891\u63A5\u53E3\u62D2\u7EDD\uFF0C\u5148\u628A\u7167\u7247\u8FDE\u5230\u56FE\u7247\u8282\u70B9\u751F\u6210\u4E00\u5F20\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u98CE\u683C\u7684\u56FE\uFF0C\u518D\u7528\u90A3\u5F20\u5F53\u9996\u5E27\u3002`);
            else setNotice(`\u5DF2\u5BFC\u5165 ${made.length} \u5F20\u56FE\u7247\u7D20\u6750\uFF1A\u8FDE\u5230\u89C6\u9891\u8282\u70B9\u7684\u300C\u9996\u5E27\u300D\u6216\u300C\u53C2\u8003\u56FE\u300D\u7AEF\u53E3\u5C31\u80FD\u76F4\u63A5\u7528\u4E8E\u5236\u4F5C\u3002\u771F\u4EBA\u7167\u7247\u4F1A\u88AB\u89C6\u9891\u63A5\u53E3\u62D2\u7EDD\uFF0C\u5148\u628A\u7167\u7247\u8FDE\u5230\u56FE\u7247\u8282\u70B9\u751F\u6210\u4E00\u5F20\u975E\u771F\u4EBA\u4E8C\u7EF4\u52A8\u753B\u98CE\u683C\u7684\u56FE\uFF0C\u518D\u7528\u90A3\u5F20\u5F53\u9996\u5E27\u3002`);
          }
        } catch (e) {
          setError(e?.message || "\u5BFC\u5165\u56FE\u7247\u5931\u8D25");
        } finally {
          setImporting(false);
          if (importRef.current) importRef.current.value = "";
        }
      }, [canvas, saveNode, refresh]);
      const mergeFilm = React.useCallback(async () => {
        if (!canvas) return;
        setError("");
        setFilmDialog({ busy: true, film: canvas.film || null, message: "" });
        try {
          const data = await canvasNativeRpc({ action: "mergeFilm", projectId: canvas.projectId }, fetch, 9e5);
          setFilmDialog({ busy: false, film: data?.film || null, message: "" });
          await refresh();
          setNotice(`\u6210\u7247\u5DF2\u5408\u6210\uFF1A${data?.film?.count || 0} \u6BB5${data?.film?.seconds ? ` \xB7 \u7EA6 ${Math.round(data.film.seconds)} \u79D2` : ""}\uFF0C\u53EF\u76F4\u63A5\u9884\u89C8\u6216\u4E0B\u8F7D\u3002`);
        } catch (e) {
          setFilmDialog((current) => ({ ...current || {}, busy: false, message: e?.message || "\u5408\u6210\u6210\u7247\u672A\u5B8C\u6210\u3002" }));
        }
      }, [canvas, refresh]);
      const applyLayout = React.useCallback(async (doc) => {
        const { positions: spots, moved } = tidyLayout(doc);
        for (const node of Object.values(doc?.nodes || {})) {
          const spot = spots[node.id];
          if (!spot) continue;
          if (Math.round(Number(node.x) || 0) === spot.x && Math.round(Number(node.y) || 0) === spot.y) continue;
          await rpc("nodeSave", { projectId: doc.projectId, node: { id: node.id, x: spot.x, y: spot.y } });
        }
        return { spots, moved };
      }, []);
      const fitStage = React.useCallback((doc, spots) => {
        const rect = stageRef.current?.getBoundingClientRect?.();
        if (!rect?.width || !rect?.height) return;
        const boxes = Object.values(doc?.nodes || {}).map((node) => ({ ...nodeSize(node), ...spots[node.id] || { x: Number(node.x) || 0, y: Number(node.y) || 0 } }));
        if (!boxes.length) return;
        const left = Math.min(...boxes.map((box) => box.x)), top = Math.min(...boxes.map((box) => box.y));
        const spanX = Math.max(1, Math.max(...boxes.map((box) => box.x + box.w)) - left), spanY = Math.max(1, Math.max(...boxes.map((box) => box.y + box.h)) - top);
        const scale = Math.min(1, Math.max(0.3, Math.min((rect.width - 80) / spanX, (rect.height - 80) / spanY)));
        setView({ scale, x: 40 - left * scale + Math.max(0, (rect.width - 80 - spanX * scale) / 2), y: 30 - top * scale + Math.max(0, (rect.height - 80 - spanY * scale) / 2) });
      }, []);
      const fitted = React.useRef("");
      React.useEffect(() => {
        if (!canvas?.projectId || fitted.current === canvas.projectId) return;
        fitted.current = canvas.projectId;
        if (!Object.values(canvas.nodes || {}).some((node) => node?.data?.metaonticStage)) return;
        const id = requestAnimationFrame(() => fitStage(canvas, {}));
        return () => cancelAnimationFrame(id);
      }, [canvas, fitStage]);
      const patchChainDialog = React.useCallback((patch) => setChainDialog((current) => current ? { ...current, ...patch } : current), []);
      const stopChainPolling = React.useCallback(() => {
        if (chainTimer.current) {
          clearInterval(chainTimer.current);
          chainTimer.current = void 0;
        }
      }, []);
      const pullChain = React.useCallback(async (id) => {
        try {
          const data = await canvasNativeRpc({ action: "chainStatus", ...id ? { id } : { projectId: canvas?.projectId } });
          if (!alive.current) return null;
          patchChainDialog({ chain: data?.chain || null, busy: false });
          if (!data?.chain || !["running"].includes(data.chain.state)) stopChainPolling();
          if (data?.chain && !["running", "review"].includes(data.chain.state)) await refresh();
          return data?.chain || null;
        } catch (e) {
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "\u8FDE\u62CD\u72B6\u6001\u6CA1\u8BFB\u5230\u3002" });
          return null;
        }
      }, [canvas, patchChainDialog, refresh, stopChainPolling]);
      const watchChain = React.useCallback((id) => {
        stopChainPolling();
        chainTimer.current = setInterval(() => {
          void pullChain(id);
        }, 3e3);
      }, [pullChain, stopChainPolling]);
      const openChain = React.useCallback(async () => {
        if (!canvas) return;
        setError("");
        setChainDialog({ loading: true, busy: false, error: "", chain: null, plan: null, confirm: { plan: false, cost: false } });
        try {
          const data = await canvasNativeRpc({ action: "chainPlan", projectId: canvas.projectId });
          if (!alive.current) return;
          patchChainDialog({ loading: false, plan: data, chain: data?.active || null });
          if (data?.active && data.active.state === "running") watchChain(data.active.id);
          else if (data?.active && ["done", "stopped", "stale"].includes(data.active.state)) {
            await pullChain(data.active.id);
          }
        } catch (e) {
          if (alive.current) patchChainDialog({ loading: false, error: e?.message || "\u8FDE\u62CD\u65B9\u6848\u6CA1\u7B97\u51FA\u6765\u3002" });
        }
      }, [canvas, patchChainDialog, pullChain, watchChain]);
      const startChain = React.useCallback(async () => {
        if (!canvas || !chainDialog?.plan) return;
        patchChainDialog({ busy: true, error: "" });
        try {
          const { chain } = await canvasNativeRpc({ action: "chainStart", projectId: canvas.projectId, confirmPlan: true, confirmCost: true, identity: chainDialog.plan.identity });
          if (!alive.current) return;
          patchChainDialog({ chain, busy: false });
          watchChain(chain?.id);
          setNotice("\u8FDE\u62CD\u5DF2\u5F00\u59CB\uFF1A\u4F1A\u6309\u987A\u5E8F\u9010\u6BB5\u751F\u6210\uFF0C\u6BCF\u6BB5\u51FA\u6210\u679C\u540E\u505C\u4E0B\u6765\u7B49\u4F60\u5BA1\u6838\uFF0C\u786E\u8BA4\u65E0\u8BEF\u518D\u7EE7\u7EED\u4E0B\u4E00\u6BB5\u3002");
        } catch (e) {
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "\u8FDE\u62CD\u6CA1\u5F00\u59CB\u3002" });
        }
      }, [canvas, chainDialog, patchChainDialog, watchChain]);
      const advanceChain = React.useCallback(async (accept) => {
        if (!chainDialog?.chain) return;
        patchChainDialog({ busy: true, error: "" });
        try {
          const { chain } = await canvasNativeRpc({ action: "chainNext", id: chainDialog.chain.id, accept });
          if (!alive.current) return;
          patchChainDialog({ chain, busy: false });
          await refresh();
          if (chain?.state === "running") watchChain(chain.id);
          else stopChainPolling();
        } catch (e) {
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "\u8FD9\u4E00\u6BB5\u6CA1\u80FD\u7EE7\u7EED\u3002" });
        }
      }, [chainDialog, patchChainDialog, refresh, stopChainPolling, watchChain]);
      const stopChain = React.useCallback(async () => {
        if (!chainDialog?.chain) return;
        patchChainDialog({ busy: true, error: "" });
        try {
          const { chain } = await canvasNativeRpc({ action: "chainStop", id: chainDialog.chain.id });
          if (!alive.current) return;
          stopChainPolling();
          patchChainDialog({ chain, busy: false });
        } catch (e) {
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "\u8FDE\u62CD\u6CA1\u80FD\u505C\u4E0B\u3002" });
        }
      }, [chainDialog, patchChainDialog, stopChainPolling]);
      const syncChainSegment = React.useCallback(async () => {
        const job = chainDialog?.chain?.job;
        if (!job) return;
        patchChainDialog({ busy: true, error: "" });
        try {
          await canvasNativeRpc({ action: "sync", id: job.id });
          await refresh();
          await pullChain(chainDialog.chain.id);
        } catch (e) {
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "\u8865\u56DE\u586B\u6CA1\u5B8C\u6210\u3002" });
        }
      }, [chainDialog, patchChainDialog, pullChain, refresh]);
      const tidy = React.useCallback(async () => {
        if (!canvas) return;
        try {
          setError("");
          const { canvas: doc } = await rpc("get", { projectId: canvas.projectId });
          const { spots, moved } = await applyLayout(doc);
          if (!moved) {
            setNotice("\u5F53\u524D\u5E03\u5C40\u5DF2\u7ECF\u6574\u9F50\uFF0C\u65E0\u9700\u8C03\u6574\u3002");
            return;
          }
          setPositions({});
          await refresh();
          fitStage(doc, spots);
          setNotice(`\u5DF2\u7F8E\u5316\u5E03\u5C40\uFF1A${moved} \u4E2A\u8282\u70B9\u6309\u8FDE\u7EBF\u91CD\u6392\uFF1B\u5185\u5BB9\u4E0E\u8FDE\u7EBF\u6CA1\u52A8\uFF0C\u4E4B\u540E\u4ECD\u53EF\u624B\u52A8\u5FAE\u8C03\u3002`);
        } catch (e) {
          setError(e?.message || "\u7F8E\u5316\u5E03\u5C40\u5931\u8D25");
        }
      }, [canvas, refresh, applyLayout, fitStage]);
      const patchScriptDialog = React.useCallback((patch) => setScriptDialog((current) => current ? { ...current, ...patch } : current), []);
      const openRequirement = React.useCallback(async () => {
        setError("");
        const requirement = requirementNodeOf(canvas);
        const spec = requirement?.data?.metaonticRequirementSpec || {};
        setScriptDialog({
          step: "requirement",
          text: "",
          idea: String(requirement?.data?.metaonticRequirementBrief || ""),
          totalSeconds: spec.seconds || 15,
          segmentSeconds: spec.segmentSeconds || 15,
          singleMax: 15,
          ratio: spec.ratio || "16:9",
          resolution: spec.resolution || "720p",
          workType: spec.work_type || "",
          busy: false,
          error: "",
          plan: null
        });
        try {
          const info = await canvasNativeRpc({ action: "info" });
          if (!alive.current) return;
          patchScriptDialog({
            singleMax: info?.singleMax || 15,
            textModel: info?.textModel || "",
            textReady: info?.textReady !== false,
            totalSeconds: Math.min(15, info?.singleMax || 15),
            segmentSeconds: info?.singleMax || 15,
            ...info?.videoReady === false ? { error: "\u8FD8\u6CA1\u914D\u7F6E\u89C6\u9891API\u5BC6\u94A5\uFF0C\u53EF\u4EE5\u5148\u521B\u5EFA\u9700\u6C42\uFF0C\u914D\u7F6E\u597D\u518D\u751F\u6210\u3002" } : {}
          });
        } catch (e) {
          if (alive.current) patchScriptDialog({ error: e?.message || "\u5236\u4F5C\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\u3002" });
        }
      }, [canvas, patchScriptDialog]);
      const openScript = React.useCallback(async () => {
        setError("");
        const requirement = requirementNodeOf(canvas);
        const spec = requirement?.data?.metaonticRequirementSpec || {};
        setScriptDialog({
          step: "script",
          text: "",
          idea: String(requirement?.data?.metaonticRequirementBrief || ""),
          totalSeconds: spec.seconds || 15,
          segmentSeconds: spec.segmentSeconds || 15,
          singleMax: 15,
          ratio: spec.ratio || "16:9",
          resolution: spec.resolution || "720p",
          workType: spec.work_type || "",
          busy: false,
          error: "",
          plan: null
        });
        try {
          const info = await canvasNativeRpc({ action: "info" });
          if (!alive.current) return;
          patchScriptDialog({
            singleMax: info?.singleMax || 15,
            textModel: info?.textModel || "",
            textReady: info?.textReady !== false,
            ...info?.videoReady === false ? { error: "\u8FD8\u6CA1\u914D\u7F6E\u89C6\u9891API\u5BC6\u94A5\uFF0C\u53EF\u4EE5\u5148\u5199\u811A\u672C\uFF0C\u914D\u7F6E\u597D\u518D\u751F\u6210\u3002" } : {}
          });
        } catch (e) {
          if (alive.current) patchScriptDialog({ error: e?.message || "\u5236\u4F5C\u670D\u52A1\u5C1A\u672A\u5C31\u7EEA\u3002" });
        }
      }, [canvas, patchScriptDialog]);
      const writeWithModel = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const idea = String(scriptDialog.idea || "").trim();
        if (!idea) {
          patchScriptDialog({ error: "\u5148\u5199\u4E00\u53E5\u60F3\u62CD\u4EC0\u4E48\uFF0C\u6587\u672C\u6A21\u578B\u624D\u6709\u5F97\u5199\u3002" });
          return;
        }
        patchScriptDialog({ busy: true, writing: true, writingSince: Date.now(), error: "", plan: null });
        try {
          const result = await canvasNativeRpc({
            action: "write",
            projectId: canvas.projectId,
            idea,
            totalSeconds: scriptDialog.totalSeconds,
            segmentSeconds: scriptDialog.segmentSeconds,
            ratio: scriptDialog.ratio,
            workType: scriptDialog.workType
          }, fetch, TEXT_WRITE_TIMEOUT_MS);
          if (!alive.current) return;
          patchScriptDialog({
            busy: false,
            writing: false,
            writingSince: 0,
            text: result.script,
            error: result.truncated === true ? "\u6587\u672C\u6A21\u578B\u5199\u5230\u4E86\u8F93\u51FA\u4E0A\u9650\uFF0C\u811A\u672C\u53EF\u80FD\u4E0D\u5B8C\u6574\uFF1A\u628A\u76EE\u6807\u65F6\u957F\u8C03\u77ED\u4E00\u4E9B\uFF0C\u6216\u5206\u4E24\u6B21\u5199\uFF0C\u518D\u6838\u5BF9\u5206\u955C\u8868\u3002" : ""
          });
          setNotice(`\u6587\u672C\u6A21\u578B\uFF08${result.model}\uFF09\u5DF2\u5199\u51FA\u5267\u672C\uFF1A\u6838\u5BF9\u5206\u955C\u8868\u540E\u70B9\u300C\u9884\u89C8\u5206\u6BB5\u300D\uFF0C\u518D\u751F\u6210\u5236\u4F5C\u8282\u70B9\u3002`);
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, writing: false, writingSince: 0, error: e?.message || "\u6587\u672C\u6A21\u578B\u6CA1\u6709\u5199\u51FA\u811A\u672C\u3002" });
        }
      }, [canvas, scriptDialog, patchScriptDialog]);
      const previewScript = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const text = String(scriptDialog.text || "").trim();
        if (!text) {
          patchScriptDialog({ error: "\u8BF7\u5148\u5199\u4E0B\u811A\u672C\u5185\u5BB9\u3002" });
          return;
        }
        patchScriptDialog({ busy: true, error: "", plan: null });
        try {
          const plan = await canvasNativeRpc({
            action: "plan",
            projectId: canvas.projectId,
            script: text,
            totalSeconds: scriptDialog.totalSeconds,
            segmentSeconds: scriptDialog.segmentSeconds
          });
          if (!alive.current) return;
          patchScriptDialog({ busy: false, plan });
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, error: e?.message || "\u5206\u6BB5\u8BA1\u5212\u6CA1\u7B97\u51FA\u6765\u3002" });
        }
      }, [canvas, scriptDialog, patchScriptDialog]);
      const createRequirement = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const brief = String(scriptDialog.idea || "").trim();
        if (!brief) {
          patchScriptDialog({ error: "\u5148\u5199\u4E00\u53E5\u60F3\u62CD\u4EC0\u4E48\uFF0C\u9700\u6C42\u624D\u6709\u5185\u5BB9\u3002" });
          return;
        }
        patchScriptDialog({ busy: true, error: "" });
        try {
          const projectId = canvas.projectId;
          const seconds = Math.max(4, Math.min(3600, Number(scriptDialog.totalSeconds) || 15));
          const resolution = scriptDialog.resolution;
          const ratio = scriptDialog.ratio;
          const segmentSeconds = Math.max(4, Math.min(Number(scriptDialog.segmentSeconds) || 15, scriptDialog.singleMax || 15));
          const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          const prefix = stagePrefixOf(canvas) || `usr_${stamp}`;
          const count = Object.keys(canvas.nodes || {}).length;
          const baseX = 60 + count % 3 * 60, baseY = 60 + count % 3 * 60;
          const existing = requirementNodeOf(canvas);
          const requirementId = existing?.id || `usr_${stamp}_requirement`;
          await saveNode(requirementId, {
            type: "text",
            x: Number(existing?.x ?? baseX),
            y: Number(existing?.y ?? baseY),
            w: 420,
            h: 260,
            data: requirementNodeData(brief, seconds, segmentSeconds, ratio, resolution, scriptDialog.workType)
          });
          const facts = {
            requirementSettled: true,
            duration: seconds,
            choice: "\u753B\u5E03\u5185\u521B\u4F5C",
            ratio,
            resolution,
            scriptDrafted: false,
            scriptApproved: false,
            specApproved: false,
            segmentTotal: 0
          };
          const stats = { total: 0, produced: 0, filmReady: false, filmCount: 0 };
          for (const [index, stage] of stageSummary(facts, stats).entries()) {
            const spot = stageSpot(index);
            await saveNode(stageNodeId(prefix, stage.key), {
              type: "text",
              x: spot.x,
              y: spot.y,
              w: spot.w,
              h: spot.h,
              data: { ...sealedStageData(stage.key, stage.state, stage.text, facts), label: STAGE_LABELS[stage.key] }
            });
          }
          const { canvas: doc } = await rpc("get", { projectId });
          const { spots } = await applyLayout(doc);
          await refresh();
          fitStage(doc, spots);
          setScriptDialog(null);
          setNotice("\u9700\u6C42\u5DF2\u521B\u5EFA\uFF1A\u2460 \u9700\u6C42\u786E\u8BA4\u6807\u4E3A\u5DF2\u5B8C\u6210\u3002\u518D\u70B9\u753B\u5E03\u7A7A\u767D\u5904\u6216\u9636\u6BB5\u5361\u2461\u7684\u300C\u5199\u811A\u672C\u300D\uFF0C\u6309\u8FD9\u4EFD\u9700\u6C42\u5199\u5267\u672C\u4E0E\u5206\u955C\u3002");
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, error: e?.message || "\u9700\u6C42\u8282\u70B9\u6CA1\u5EFA\u51FA\u6765\u3002" });
        }
      }, [canvas, scriptDialog, patchScriptDialog, saveNode, applyLayout, refresh, fitStage]);
      const createFromScript = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const text = String(scriptDialog.text || "").trim();
        if (!text) {
          patchScriptDialog({ error: "\u8BF7\u5148\u5199\u4E0B\u811A\u672C\u5185\u5BB9\u3002" });
          return;
        }
        patchScriptDialog({ busy: true, error: "" });
        try {
          const projectId = canvas.projectId;
          const plan = await canvasNativeRpc({
            action: "plan",
            projectId,
            script: text,
            totalSeconds: scriptDialog.totalSeconds,
            segmentSeconds: scriptDialog.segmentSeconds
          });
          const stamp = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 5)}`;
          const ratio = scriptDialog.ratio, resolution = scriptDialog.resolution;
          const count = Object.keys(canvas.nodes || {}).length;
          const baseX = 60 + count % 3 * 60, baseY = 60 + count % 3 * 60;
          const scriptId = `usr_${stamp}_script`;
          await saveNode(scriptId, { type: "script", x: baseX, y: baseY, w: 420, h: 320, data: { label: "\u5267\u672C", text } });
          let upstream = scriptId;
          if (plan.shots?.length) {
            const boardId = `usr_${stamp}_board`;
            const shots = plan.shots.map((shot) => ({ index: shot.index, visual: shot.visual, ...shot.camera ? { camera: shot.camera } : {}, ...shot.sfx ? { sfx: shot.sfx } : {}, ...shot.duration ? { duration: shot.duration } : {} }));
            await saveNode(boardId, { type: "storyboard", x: baseX + 560, y: baseY, w: 460, h: 340, data: { label: "\u5206\u955C", shots } });
            await rpc("edgeAdd", { projectId, fromNode: scriptId, toNode: boardId, fromPort: "out", toPort: "script" });
            upstream = boardId;
          }
          for (const [index, segment] of plan.segments.entries()) {
            const id = `usr_${stamp}_seg${index + 1}`, frameId = `usr_${stamp}_frame${index + 1}`;
            await saveNode(frameId, {
              type: "image",
              x: baseX + 1160,
              y: baseY + index * 340,
              w: 360,
              h: 300,
              data: { label: `\u7B2C${index + 1}\u6BB5 \xB7 \u753B\u9762`, prompt: segment.prompt, ratio, resolution, imageCount: 1, [FRAME_MARK]: id }
            });
            await saveNode(id, {
              type: "video",
              x: baseX + 1720,
              y: baseY + index * 340,
              w: 360,
              h: 300,
              data: { label: `\u7B2C${index + 1}\u6BB5 \xB7 ${segment.seconds}\u79D2`, prompt: segment.prompt, ratio, resolution, duration: segment.seconds }
            });
            await rpc("edgeAdd", { projectId, fromNode: upstream, toNode: frameId, fromPort: "out", toPort: "prompt" });
            await rpc("edgeAdd", { projectId, fromNode: frameId, toNode: id, fromPort: "out", toPort: "frame" });
          }
          if (!requirementNodeOf(canvas)) {
            const brief = String(scriptDialog.idea || "").trim() || text.split(/\r?\n/)[0].slice(0, 80);
            await saveNode(`usr_${stamp}_requirement`, {
              type: "text",
              x: baseX - 500,
              y: baseY,
              w: 420,
              h: 260,
              data: requirementNodeData(brief, Number(scriptDialog.totalSeconds) || 15, Number(scriptDialog.segmentSeconds) || 15, ratio, resolution, scriptDialog.workType)
            });
          }
          const facts = {
            requirementSettled: true,
            duration: Number(scriptDialog.totalSeconds) || null,
            choice: "\u753B\u5E03\u5185\u521B\u4F5C",
            ratio,
            resolution,
            scriptDrafted: true,
            scriptApproved: false,
            specApproved: true,
            segmentTotal: plan.segments.length
          };
          const { nodes: rewritten, changed } = rewriteStageNodes(canvas, facts);
          const existing = Object.values(rewritten).filter((node) => node?.data?.metaonticStage);
          if (existing.length) {
            for (const id of changed) await saveNode(id, { data: rewritten[id].data });
          } else {
            const stats = { total: plan.segments.length, produced: 0, filmReady: false, filmCount: 0 };
            for (const [index, stage] of stageSummary(facts, stats).entries()) {
              const spot = stageSpot(index);
              await saveNode(stageNodeId(stagePrefixOf(canvas) || `usr_${stamp}`, stage.key), {
                type: "text",
                x: spot.x,
                y: spot.y,
                w: spot.w,
                h: spot.h,
                data: { ...sealedStageData(stage.key, stage.state, stage.text, facts), label: STAGE_LABELS[stage.key] }
              });
            }
          }
          const { canvas: doc } = await rpc("get", { projectId });
          const { spots } = await applyLayout(doc);
          await refresh();
          fitStage(doc, spots);
          setScriptDialog(null);
          setNotice(`\u5DF2\u6309\u811A\u672C\u94FA\u5F00 ${plan.segments.length} \u6BB5\u6D41\u7A0B\uFF08\u5267\u672C \u2192 \u5206\u955C \u2192 \u753B\u9762 \u2192 \u89C6\u9891\uFF09\uFF1A\u5148\u6838\u5BF9\u6BCF\u6BB5\u63D0\u793A\u8BCD\uFF0C\u786E\u8BA4\u65E0\u8BEF\u540E\u70B9\u5267\u672C\u8282\u70B9\u6216\u9636\u6BB5\u5361\u2461\u7684\u300C\u786E\u8BA4\u811A\u672C\u300D\uFF0C\u518D\u70B9\u300C\u5236\u4F5C\u300C\u2026\u300D\u300D\u9010\u6BB5\u8D70\u2014\u2014\u5148\u51FA\u6BCF\u6BB5\u524D\u9762\u7684\u300C\u753B\u9762\u300D\uFF08\u5B83\u63A5\u6210\u8FD9\u4E00\u6BB5\u7684\u9996\u5E27\uFF09\uFF0C\u518D\u51FA\u89C6\u9891\uFF1B\u56FE\u7247\u4E0E\u89C6\u9891\u90FD\u5355\u72EC\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528\u3002`);
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, error: e?.message || "\u811A\u672C\u8282\u70B9\u6CA1\u5EFA\u51FA\u6765\u3002" });
        }
      }, [canvas, scriptDialog, patchScriptDialog, saveNode, applyLayout, refresh, fitStage]);
      const connectTo = React.useCallback(async (to) => {
        if (!canvas || !connectFrom || connectFrom === to) return;
        const from = (canvas.nodes || {})[connectFrom];
        const target = (canvas.nodes || {})[to];
        const media = ["image", "video"].includes(from?.type) && ["image", "video"].includes(target?.type);
        const toPort = ["image", "video"].includes(target?.type) ? media ? "ref" : "prompt" : "prompt";
        await rpc("edgeAdd", { projectId: canvas.projectId, fromNode: connectFrom, toNode: to, fromPort: "out", toPort });
        setConnectFrom("");
        await refresh();
      }, [canvas, connectFrom, refresh]);
      const removeEdge = React.useCallback(async (id) => {
        if (!canvas) return;
        await rpc("edgeDelete", { projectId: canvas.projectId, edgeId: id });
        await refresh();
      }, [canvas, refresh]);
      const setEdgePort = React.useCallback(async (edge, toPort) => {
        if (!canvas || !edge || edge.toPort === toPort) return;
        try {
          setError("");
          await rpc("edgeDelete", { projectId: canvas.projectId, edgeId: edge.id });
          await rpc("edgeAdd", { projectId: canvas.projectId, fromNode: edge.fromNode, toNode: edge.toNode, fromPort: "out", toPort });
          await refresh();
        } catch (e) {
          setError(e?.message || "\u5207\u6362\u7D20\u6750\u7AEF\u53E3\u672A\u5B8C\u6210\u3002");
        }
      }, [canvas, refresh]);
      const addReferenceImage = React.useCallback(async (nodeId) => {
        if (!canvas) return;
        const source = (canvas.nodes || {})[nodeId];
        const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
        try {
          setError("");
          await saveNode(id, {
            type: "image",
            x: Number(source?.x || 60) - 520,
            y: Number(source?.y || 60),
            w: NODE_SIZE.image[0],
            h: NODE_SIZE.image[1],
            data: {
              label: "\u53C2\u8003\u56FE",
              prompt: "",
              ratio: "1:1",
              resolution: "720p",
              imageCount: 1,
              [MATERIAL_MARK]: true,
              metaonticSegmentOf: nodeId
            }
          });
          await rpc("edgeAdd", { projectId: canvas.projectId, fromNode: id, toNode: nodeId, fromPort: "out", toPort: "ref" });
          setSelectedIds([id]);
          await refresh();
          setNotice("\u5DF2\u65B0\u5EFA\u53C2\u8003\u56FE\u8282\u70B9\u5E76\u63A5\u5230\u672C\u8282\u70B9\u7684\u300C\u53C2\u8003\u56FE\u300D\u7AEF\u53E3\uFF1A\u70B9\u5B83\u7684\u300C\u5236\u4F5C\u300D\u751F\u6210\u56FE\u7247\uFF0C\u751F\u6210\u524D\u4ECD\u8981\u5355\u72EC\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528\u3002");
        } catch (e) {
          setError(e?.message || "\u65B0\u5EFA\u53C2\u8003\u56FE\u8282\u70B9\u672A\u5B8C\u6210\u3002");
        }
      }, [canvas, saveNode, refresh]);
      const deleteCanvas = React.useCallback(async () => {
        if (!canvas) return;
        try {
          setError("");
          const gone = canvas.projectId;
          await rpc("delete", { projectId: gone });
          setConfirmDelete(false);
          const next = list.find((item) => item.projectId !== gone)?.projectId;
          await load(next);
          setNotice("\u753B\u5E03\u5DF2\u5220\u9664\uFF1B\u5DF2\u751F\u6210\u7684\u6210\u679C\u7D20\u6750\u6587\u4EF6\u4ECD\u4FDD\u7559\u5728\u63D2\u4EF6\u6570\u636E\u76EE\u5F55\uFF0C\u4FBF\u4E8E\u53E6\u884C\u53D6\u7528\u3002");
        } catch (e) {
          setConfirmDelete(false);
          setError(e?.message || "\u5220\u9664\u753B\u5E03\u5931\u8D25");
        }
      }, [canvas, list, load]);
      const commitRename = React.useCallback(async () => {
        if (!canvas || !inline) return;
        const name = String(inline.value || "").trim();
        if (!name) {
          setInline(null);
          setError("\u753B\u5E03\u540D\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u5DF2\u4FDD\u7559\u539F\u540D\u3002");
          return;
        }
        if (name === canvas.name) {
          setInline(null);
          return;
        }
        try {
          await rpc("rename", { projectId: canvas.projectId, name });
          setInline(null);
          setError("");
          await refresh();
        } catch (e) {
          setInline(null);
          setError(e?.message || "\u6539\u540D\u672A\u4FDD\u5B58\uFF0C\u5DF2\u4FDD\u7559\u539F\u540D\u3002");
        }
      }, [canvas, inline, refresh]);
      const submitCreate = React.useCallback(async () => {
        if (!createDialog) return;
        const name = String(createDialog.value || "").trim();
        if (!name) {
          setCreateDialog({ ...createDialog, error: "\u753B\u5E03\u540D\u4E0D\u80FD\u4E3A\u7A7A" });
          return;
        }
        try {
          const { canvas: made } = await rpc("create", { name });
          setCreateDialog(null);
          await load(made.projectId);
          setNotice("\u5DF2\u65B0\u5EFA\u6D41\u7A0B\u753B\u5E03\uFF1A\u53EF\u4EE5\u52A0\u8282\u70B9\u5F00\u59CB\u753B\u5E03\u5185\u7684\u5236\u4F5C\uFF0C\u4E5F\u53EF\u4EE5\u76F4\u63A5\u7528\u4E8E\u65E2\u6709\u521B\u4F5C\u9879\u76EE\u3002");
        } catch (e) {
          setCreateDialog({ ...createDialog, error: e?.message || "\u65B0\u5EFA\u753B\u5E03\u672A\u5B8C\u6210\u3002" });
        }
      }, [createDialog, load]);
      const stopPolling = React.useCallback(() => {
        if (timer.current) {
          clearInterval(timer.current);
          timer.current = void 0;
        }
      }, []);
      const closeDialog = React.useCallback(() => {
        stopPolling();
        setDialog(null);
      }, [stopPolling]);
      React.useEffect(() => {
        if (!dialog) stopPolling();
      }, [dialog, stopPolling]);
      const patchDialog = React.useCallback((patch) => setDialog((current) => current ? { ...current, ...patch } : current), []);
      const openDialog = React.useCallback(async (node) => {
        if (!canvas) return;
        setError("");
        const data = node.data || {};
        const isMedia = ["image", "video"].includes(node.type);
        setDialog({
          nodeId: node.id,
          type: node.type,
          stage: isMedia ? "form" : "edit",
          busy: false,
          form: {
            text: String(data.output || data.text || ""),
            prompt: String(data.prompt || ""),
            ratio: String(data.ratio || (node.type === "image" ? "1:1" : "16:9")),
            duration: Number(data.duration) || 5,
            resolution: String(data.resolution || "720p").toLowerCase(),
            generateAudio: false,
            transitionDescription: ""
          },
          confirm: { plan: false, cost: false, textOnly: false },
          plan: null,
          job: null,
          message: ""
        });
        if (!isMedia || Array.isArray(data.shots)) return;
        try {
          const { job } = await canvasNativeRpc({ action: "latest", projectId: canvas.projectId, nodeId: node.id });
          if (job && alive.current) patchDialog({ stage: "job", job });
        } catch (e) {
          if (alive.current) patchDialog({ message: e?.message || "" });
        }
      }, [canvas, patchDialog]);
      const openFlow = React.useCallback(() => {
        if (!canvas) return;
        if (selectedIds.length) {
          setSelectedIds([]);
          return;
        }
        const stages = Object.values(canvas.nodes || {}).filter((node) => node?.data?.metaonticStage);
        const factsOf = (key) => stages.find((node) => String(node.data.metaonticStage) === key)?.data?.metaonticStageFacts || {};
        if (!factsOf("requirement").requirementSettled) {
          void openRequirement();
          return;
        }
        if (factsOf("script").scriptApproved !== true) {
          void openScript();
          return;
        }
        const scriptNode = Object.values(canvas.nodes || {}).find((node) => node?.type === "script");
        if (scriptNode) {
          void openDialog(scriptNode);
          return;
        }
        void openScript();
      }, [canvas, selectedIds.length, openRequirement, openScript, openDialog]);
      const watch = React.useCallback((id) => {
        stopPolling();
        const tick = async () => {
          try {
            const { job } = await canvasNativeRpc({ action: "status", id });
            if (!alive.current) return;
            patchDialog({ job, stage: "job" });
            if (job.state !== "running") {
              stopPolling();
              await refresh();
            }
          } catch (e) {
            if (alive.current) patchDialog({ message: e?.message || "", busy: false });
          }
        };
        timer.current = setInterval(() => {
          void tick();
        }, 3e3);
        void tick();
      }, [patchDialog, refresh, stopPolling]);
      const prepare = React.useCallback(async (operation) => {
        if (!canvas || !dialog) return;
        patchDialog({ busy: true, message: "", stage: "plan" });
        try {
          const draft = { prompt: dialog.form.prompt, ratio: dialog.form.ratio };
          if (dialog.type === "video") {
            draft.duration = Number(dialog.form.duration);
            draft.resolution = dialog.form.resolution;
            draft.generateAudio = dialog.form.generateAudio === true;
          }
          if (operation === "extend") draft.transitionDescription = dialog.form.transitionDescription;
          const response = await canvasNativeRpc({ action: "prepare", projectId: canvas.projectId, nodeId: dialog.nodeId, operation, draft });
          if (!alive.current) return;
          if (response.job) patchDialog({ stage: "job", job: response.job, busy: false });
          else patchDialog({ plan: response.proposal, confirm: { plan: false, cost: false, textOnly: false }, busy: false });
        } catch (e) {
          if (alive.current) patchDialog({ busy: false, message: e?.message || "\u5236\u4F5C\u65B9\u6848\u672A\u751F\u6210\u3002" });
        }
      }, [canvas, dialog, patchDialog]);
      const start = React.useCallback(async () => {
        if (!dialog?.plan) return;
        patchDialog({ busy: true, message: "" });
        try {
          const { job } = await canvasNativeRpc({
            action: "start",
            id: dialog.plan.id,
            confirmPlan: dialog.confirm.plan === true,
            confirmCost: dialog.confirm.cost === true,
            textOnly: dialog.confirm.textOnly === true
          });
          if (!alive.current) return;
          patchDialog({ stage: "job", job, busy: false });
          watch(job.id);
        } catch (e) {
          if (alive.current) patchDialog({ busy: false, message: e?.message || "\u5236\u4F5C\u672A\u63D0\u4EA4\u3002" });
        }
      }, [dialog, patchDialog, watch]);
      const act = React.useCallback(async (action, extra = {}) => {
        if (!dialog?.job) return;
        patchDialog({ busy: true, message: "" });
        try {
          const { job } = await canvasNativeRpc({ action, id: dialog.job.id, ...extra });
          if (!alive.current) return;
          patchDialog({ job, busy: false });
          if (["sync", "review"].includes(action)) await refresh();
        } catch (e) {
          if (alive.current) patchDialog({ busy: false, message: e?.message || "\u64CD\u4F5C\u672A\u5B8C\u6210\u3002" });
        }
      }, [dialog, patchDialog, refresh]);
      const onWheel = (event) => {
        event.preventDefault();
        const rect = event.currentTarget.getBoundingClientRect();
        const scale = Math.min(2, Math.max(0.3, view.scale * (event.deltaY > 0 ? 0.92 : 1.08)));
        const ratio = scale / view.scale;
        setView({ scale, x: event.clientX - rect.left - (event.clientX - rect.left - view.x) * ratio, y: event.clientY - rect.top - (event.clientY - rect.top - view.y) * ratio });
      };
      const onPointerDown = (event) => {
        if (event.button !== 0) return;
        event.currentTarget.setPointerCapture?.(event.pointerId);
        if (event.shiftKey) {
          const rect = event.currentTarget.getBoundingClientRect();
          const local = { x: event.clientX - rect.left, y: event.clientY - rect.top };
          setMarquee({ x1: local.x, y1: local.y, x2: local.x, y2: local.y });
          return;
        }
        pan.current = { x: event.clientX, y: event.clientY, ox: view.x, oy: view.y, moved: false };
        setPanning(true);
      };
      const onPointerMove = (event) => {
        if (moving.current) {
          const { ids, x, y, origins } = moving.current;
          setPositions((all) => {
            const next = { ...all };
            for (const id of ids) {
              const origin = origins[id];
              if (!origin) continue;
              next[id] = { x: origin.x + (event.clientX - x) / view.scale, y: origin.y + (event.clientY - y) / view.scale };
            }
            return next;
          });
          return;
        }
        if (marquee) {
          const rect = event.currentTarget.getBoundingClientRect();
          setMarquee((current) => current ? { ...current, x2: event.clientX - rect.left, y2: event.clientY - rect.top } : current);
          return;
        }
        if (!pan.current) return;
        if (Math.abs(event.clientX - pan.current.x) > 4 || Math.abs(event.clientY - pan.current.y) > 4) pan.current.moved = true;
        setView((current) => ({ ...current, x: pan.current.ox + (event.clientX - pan.current.x), y: pan.current.oy + (event.clientY - pan.current.y) }));
      };
      const onPointerUp = () => {
        if (marquee) {
          const world = (value, offset) => (value - offset) / view.scale;
          const left = world(Math.min(marquee.x1, marquee.x2), view.x), top = world(Math.min(marquee.y1, marquee.y2), view.y);
          const right = world(Math.max(marquee.x1, marquee.x2), view.x), bottom = world(Math.max(marquee.y1, marquee.y2), view.y);
          const hits = nodes.map((raw) => geometry(raw)).filter((node) => node.x < right && node.x + node.w > left && node.y < bottom && node.y + node.h > top).map((node) => node.id);
          if (hits.length) {
            setSelectedIds(hits);
            marqueeDone.current = true;
          }
          setMarquee(null);
          return;
        }
        if (moving.current) {
          const { ids } = moving.current;
          const spots = ids.map((id) => [id, positions[id]]).filter(([, spot]) => spot);
          moving.current = null;
          for (const [id, spot] of spots) void saveNode(id, { x: spot.x, y: spot.y });
          return;
        }
        const clickedEmpty = Boolean(pan.current && !pan.current.moved);
        pan.current = null;
        setPanning(false);
        if (clickedEmpty) openFlow();
      };
      const startMove = (event, node) => {
        if (event.button !== 0) return;
        event.stopPropagation();
        const ids = selectedIds.includes(node.id) ? selectedIds : [node.id];
        if (!selectedIds.includes(node.id)) setSelectedIds([node.id]);
        const origins = {};
        for (const id of ids) {
          const raw = (canvas?.nodes || {})[id];
          if (!raw) continue;
          const spot = { ...sizeOf(raw), ...positions[id] || {} };
          origins[id] = { x: spot.x || 0, y: spot.y || 0 };
        }
        moving.current = { ids, x: event.clientX, y: event.clientY, origins };
        event.currentTarget.setPointerCapture?.(event.pointerId);
      };
      const steps = flowSteps(canvas);
      const film = canvas ? filmStatus(canvas) : null;
      const nextStep = steps.find((step) => !step.done) || null;
      const doneSteps = steps.filter((step) => step.done).length;
      const nodes = canvas ? Object.values(canvas.nodes || {}) : [];
      const edges = canvas?.edges || [];
      const producedIds = producedNodeIds(canvas);
      const achieved = (node) => node?.data?.status === "done" || node?.data?.status === void 0 && producedIds.has(node?.id);
      const materialOf = (node) => Boolean(node?.data?.assetId) && !node?.metaonticSourceNode;
      const nodeChip = (node) => {
        if (node?.data?.metaonticStage) {
          const state = String(node.data.metaonticStageState || "");
          return {
            text: STAGE_STATE_TEXT[state] || "\u5F85\u5236\u4F5C",
            className: state === "done" ? "mov-chip mov-chip-ok" : state === "pending" ? "mov-chip movc-badge" : `mov-chip movc-stage-${state === "active" ? "active" : "review"}`
          };
        }
        if (materialOf(node)) return { text: "\u7D20\u6750", className: "mov-chip movc-badge" };
        return achieved(node) ? { text: "\u5DF2\u5B8C\u6210", className: "mov-chip mov-chip-ok" } : { text: "\u5F85\u5236\u4F5C", className: "mov-chip movc-badge" };
      };
      const stageNodes = nodes.filter((node) => node?.data?.metaonticStage);
      const currentStage = stageNodes.find((node) => ["active", "review", "ready"].includes(String(node?.data?.metaonticStageState))) || stageNodes.find((node) => node?.data?.metaonticStageState !== "done");
      const activeStageId = String(currentStage?.id || "");
      const stageFactsOf = (key) => stageNodes.find((node) => String(node?.data?.metaonticStage) === key)?.data?.metaonticStageFacts || {};
      const scriptDrafted = Boolean(stageFactsOf("script").scriptDrafted);
      const scriptApproved = Boolean(stageFactsOf("script").scriptApproved);
      const stageStats = canvas ? canvasSegmentStats(canvas) : { total: 0, produced: 0, shots: 0, assets: 0 };
      const storyboardReady = stageStats.shots > 0 || stageStats.total > 0;
      const assetsReady = stageStats.assets > 0;
      const readiness = canvas ? canvasReadiness(canvas) : [];
      const readinessErrors = readiness.filter((item) => item.severity === "error").length;
      const readinessWarnings = readiness.filter((item) => item.severity === "warning").length;
      const readinessNotes = readiness.length - readinessErrors - readinessWarnings;
      const readinessBrief = [
        readinessErrors ? `${readinessErrors} \u5904\u9519\u8BEF` : "",
        readinessWarnings ? `${readinessWarnings} \u5904\u63D0\u9192` : "",
        readinessNotes ? `${readinessNotes} \u5904\u63D0\u793A` : ""
      ].filter(Boolean).join("\u3001");
      const chainable = canvasSegments(canvas).some((node) => node?.type === "video");
      const geometry = (node) => node ? { ...node, ...sizeOf(node), ...positions[node.id] || {} } : null;
      const at = (id) => geometry((canvas?.nodes || {})[id]);
      const kindOf = (id) => (canvas?.nodes || {})[id]?.type;
      const dialogNode = dialog ? (canvas?.nodes || {})[dialog.nodeId] : null;
      const stageOrder = stageNodes.map((raw) => geometry(raw)).sort((left, right) => left.x - right.x);
      const stageArrows = stageOrder.slice(1).map((to, index) => {
        const from = stageOrder[index];
        const x1 = from.x + from.w + 6, y1 = from.y + from.h / 2, x2 = to.x - 12, y2 = to.y + to.h / 2;
        const bend = Math.max(24, (x2 - x1) / 2);
        return { key: `stage-${to.id}`, d: `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}` };
      });
      const batchChecks = [
        { key: "shots", ok: storyboardReady, label: "\u300C\u786E\u8BA4\u955C\u5934\u300D", hint: "\u81F3\u5C11\u5DF2\u5207\u51FA 1 \u6BB5\u5236\u4F5C\u5185\u5BB9" },
        {
          key: "assets",
          ok: assetsReady || ["not_needed", "text_only"].includes(String(stageFactsOf("requirement").choice || "")),
          label: "\u300C\u51C6\u5907\u7D20\u6750\u300D",
          hint: `\u4E3A\u89D2\u8272\u56FE / \u9996\u5E27 / \u53C2\u8003\u56FE\u51C6\u5907\u5F62\u8C61\u56FE\uFF08\u5F53\u524D ${stageStats.assets} \u5F20\uFF09`
        },
        { key: "cost", ok: true, label: "\u300C\u786E\u8BA4\u8D39\u7528\u300D", hint: "\u6BCF\u6BB5\u751F\u6210\u524D\u4ECD\u8981\u5355\u72EC\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528" }
      ];
      const chainPlanPending = chainDialog?.plan ? chainDialog.plan.segments.filter((segment) => !segment.skip).length : 0;
      const confirmScript = React.useCallback(async () => {
        if (!canvas) return;
        if (!stageFactsOf("script").scriptDrafted) {
          void openScript();
          return;
        }
        const { nodes: rewritten, changed } = rewriteStageNodes(canvas, { scriptApproved: true });
        try {
          for (const id of changed) await saveNode(id, { data: rewritten[id].data });
          await refresh();
          setNotice("\u811A\u672C\u5BA1\u6838\u5DF2\u901A\u8FC7\uFF1A\u753B\u5E03\u4E0A\u7684\u9636\u6BB5\u5361\u2461\u6807\u4E3A\u5DF2\u5B8C\u6210\u3002\u63A5\u7740\u70B9\u300C\u770B\u4F30\u4EF7\u300D\u6838\u5BF9\u6574\u6761\u94FE\u8DEF\uFF0C\u6216\u70B9\u300C\u505A\u8FD9\u4E00\u6BB5\u300D\u9010\u6BB5\u751F\u6210\uFF0C\u6BCF\u6BB5\u4ECD\u8981\u5355\u72EC\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528\u3002");
        } catch (e) {
          setError(e?.message || "\u811A\u672C\u5BA1\u6838\u6CA1\u8BB0\u4E0A\uFF0C\u8BF7\u91CD\u8BD5\u3002");
        }
      }, [canvas, refresh, saveNode, stageFactsOf, openScript]);
      const runStageAction = (key) => {
        if (!canvas) return;
        if (key === "requirement") {
          void openRequirement();
          return;
        }
        if (key === "script") {
          if (!scriptDrafted) {
            void openScript();
            return;
          }
          if (!scriptApproved) {
            void confirmScript();
            return;
          }
          const scriptNode = Object.values(canvas.nodes || {}).find((node) => node?.type === "script");
          if (scriptNode) {
            void openDialog(scriptNode);
            return;
          }
          void openScript();
          return;
        }
        if (key === "storyboard") {
          if (!storyboardReady) {
            void openScript();
            return;
          }
          const board = Object.values(canvas.nodes || {}).find((node) => node?.type === "storyboard");
          if (board) {
            void openDialog(board);
            return;
          }
          setNotice("\u8FD9\u4EFD\u811A\u672C\u6309\u573A\u666F\u4E0E\u53E5\u5B50\u5207\u6BB5\uFF0C\u6CA1\u6709\u5355\u72EC\u7684\u5206\u955C\u8282\u70B9\uFF1B\u6BCF\u6BB5\u63D0\u793A\u8BCD\u5728\u5BF9\u5E94\u7684\u5236\u4F5C\u8282\u70B9\u91CC\u3002");
          return;
        }
        if (key === "assets") {
          const node = (canvas.nodes || {})[nextStep?.id];
          if (!node) {
            setNotice("\u5236\u4F5C\u6BB5\u90FD\u5DF2\u6709\u6210\u679C\uFF1B\u8981\u8865\u7D20\u6750\uFF0C\u70B9\u67D0\u4E2A\u8282\u70B9\u81EA\u5DF1\u7684\u300C\u5236\u4F5C\u300D\uFF0C\u5728\u7A97\u53E3\u91CC\u7528\u300C\u5BFC\u5165\u56FE\u7247\u7D20\u6750\u300D\u6216\u300C\u65B0\u5EFA\u53C2\u8003\u56FE\u8282\u70B9\u300D\u3002");
            return;
          }
          if (!assetsReady) {
            void addReferenceImage(node.id);
            return;
          }
          void openDialog(node);
          return;
        }
        if (key === "cost") {
          void openChain();
          return;
        }
        if (key === "film") {
          void mergeFilm();
          return;
        }
        if (key === "segments") {
          const node = (canvas.nodes || {})[nextStep?.id];
          if (node) {
            void openDialog(node);
            return;
          }
          setNotice("\u5236\u4F5C\u6BB5\u90FD\u5DF2\u6709\u6210\u679C\uFF1B\u8981\u91CD\u505A\u67D0\u4E00\u6BB5\uFF0C\u70B9\u90A3\u4E2A\u8282\u70B9\u81EA\u5DF1\u7684\u300C\u5236\u4F5C\u300D\uFF0C\u91CD\u65B0\u6838\u5BF9\u65B9\u6848\u5E76\u786E\u8BA4\u8D39\u7528\u3002");
        }
      };
      const stageBody = (node) => {
        const key = String(node?.data?.metaonticStage || "");
        const action = pendingStageAction(key, { ...node?.data?.metaonticStageFacts || {}, storyboardReady, assetsReady }) || stageAction(key);
        return h("div", { key: "stage", className: "movc-body" }, [
          h("div", { key: "state", className: "movc-stage-text" }, textOf2(node)),
          action ? h("button", {
            key: "act",
            type: "button",
            className: "movc-stage-action",
            title: action.hint,
            "data-stage-action": key,
            onPointerDown: (e) => e.stopPropagation(),
            onClick: (e) => {
              e.stopPropagation();
              runStageAction(key);
            }
          }, action.label) : null
        ]);
      };
      const mediaInbound = dialog?.type === "video" && dialog.stage === "form" ? edges.filter((edge) => edge.toNode === dialog.nodeId && ["ref", "frame"].includes(edge.toPort) && ["image", "video"].includes(kindOf(edge.fromNode))) : [];
      const formFields = dialog && ["form", "plan", "edit"].includes(dialog.stage) ? h("div", { key: "fields" }, [
        dialog.stage === "edit" ? h("label", { key: "text", className: "movc-field" }, ["\u8282\u70B9\u5185\u5BB9", h("textarea", { value: dialog.form.text, onChange: (e) => patchDialog({ form: { ...dialog.form, text: e.target.value } }) })]) : h("label", { key: "prompt", className: "movc-field" }, ["\u672C\u6B21\u8981\u751F\u6210\u7684\u753B\u9762 / \u7EED\u62CD\u5185\u5BB9", h("textarea", { value: dialog.form.prompt, placeholder: "\u5199\u6E05\u4E3B\u4F53\u3001\u52A8\u4F5C\u3001\u955C\u5934\u4E0E\u58F0\u97F3\uFF1B\u7559\u7A7A\u4F1A\u7528\u8282\u70B9\u4E0E\u4E0A\u6E38\u811A\u672C\u6587\u672C\u3002", onChange: (e) => patchDialog({ form: { ...dialog.form, prompt: e.target.value } }) })]),
        dialog.type === "video" && dialog.stage !== "edit" ? h("div", { key: "spec", className: "movc-row" }, [
          h("label", { key: "ratio", className: "movc-field" }, ["\u753B\u5E45", h("select", { value: dialog.form.ratio, onChange: (e) => patchDialog({ form: { ...dialog.form, ratio: e.target.value } }) }, RATIOS.map((r) => h("option", { key: r, value: r }, r)))]),
          h("label", { key: "duration", className: "movc-field" }, ["\u672C\u6BB5\u65F6\u957F\uFF08\u79D2\uFF09", h("input", { type: "number", min: 4, value: dialog.form.duration, onChange: (e) => patchDialog({ form: { ...dialog.form, duration: e.target.value } }) })]),
          h("label", { key: "resolution", className: "movc-field" }, ["\u6E05\u6670\u5EA6", h("select", { value: dialog.form.resolution, onChange: (e) => patchDialog({ form: { ...dialog.form, resolution: e.target.value } }) }, RESOLUTIONS.map((r) => h("option", { key: r, value: r }, r.toUpperCase())))])
        ]) : null,
        dialog.type === "video" && dialog.stage !== "edit" ? h("label", { key: "audio", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.form.generateAudio === true, onChange: (e) => patchDialog({ form: { ...dialog.form, generateAudio: e.target.checked } }) }), " \u672C\u6B21\u751F\u6210\u97F3\u9891"]) : null,
        // 参考素材在制作窗口里就地补充：导入自己的图片，或新建一个图片节点去生成参考图。
        dialog.type === "video" && dialog.stage === "form" ? h("div", { key: "refs-add", className: "movc-row" }, [
          h("button", { key: "import", type: "button", className: "mov-btn", disabled: importing, title: "\u628A\u81EA\u5DF1\u7684\u56FE\u7247\u5199\u8FDB\u753B\u5E03\u6570\u636E\u76EE\u5F55\uFF0C\u5E76\u63A5\u5230\u672C\u8282\u70B9\u7684\u300C\u53C2\u8003\u56FE\u300D\u7AEF\u53E3", onClick: () => importRef.current?.click() }, importing ? "\u5BFC\u5165\u4E2D\u2026" : "\u5BFC\u5165\u56FE\u7247\u7D20\u6750"),
          h("button", { key: "image-node", type: "button", className: "mov-btn", title: "\u65B0\u5EFA\u4E00\u4E2A\u56FE\u7247\u8282\u70B9\u5E76\u63A5\u5230\u672C\u8282\u70B9\u7684\u300C\u53C2\u8003\u56FE\u300D\u7AEF\u53E3\uFF0C\u5728\u5B83\u81EA\u5DF1\u7684\u300C\u5236\u4F5C\u300D\u91CC\u751F\u6210\u53C2\u8003\u56FE", onClick: () => void addReferenceImage(dialog.nodeId) }, "\u65B0\u5EFA\u53C2\u8003\u56FE\u8282\u70B9"),
          h("input", {
            key: "import-input",
            type: "file",
            multiple: true,
            accept: "image/png,image/jpeg,image/webp",
            ref: importRef,
            style: { display: "none" },
            onChange: (e) => void importImages(e.target.files, dialog.nodeId)
          })
        ]) : null,
        dialog.stage === "plan" && dialog.plan?.operation === "extend" ? h("label", { key: "transition", className: "movc-field" }, ["\u4E0A\u4E00\u6BB5\u7ED3\u5C3E\u5230\u672C\u6BB5\u7684\u8854\u63A5\u63CF\u8FF0", h("textarea", { value: dialog.form.transitionDescription, onChange: (e) => patchDialog({ form: { ...dialog.form, transitionDescription: e.target.value } }) })]) : null,
        mediaInbound.length ? h("div", { key: "ports", className: "movc-plan" }, [
          h("div", { key: "hint" }, "\u4E0A\u6E38\u7D20\u6750\u7AEF\u53E3\uFF1A\u300C\u9996\u5E27\u300D\u7528\u4E00\u5F20\u56FE\u5F00\u753B\uFF0C\u300C\u53C2\u8003\u56FE\u300D\u6309\u53C2\u8003\u7D20\u6750\u53C2\u4E0E\u751F\u6210\uFF1B\u4E24\u8005\u4E0D\u80FD\u540C\u65F6\u4F7F\u7528\u3002"),
          ...mediaInbound.map((edge) => h("div", { key: edge.id, className: "movc-row" }, [
            h("span", { key: "name" }, labelOf((canvas?.nodes || {})[edge.fromNode])),
            h(
              "select",
              { key: "port", value: edge.toPort, onChange: (e) => void setEdgePort(edge, e.target.value) },
              ["ref", "frame"].map((port) => h("option", { key: port, value: port }, port === "frame" ? "\u9996\u5E27" : "\u53C2\u8003\u56FE"))
            ),
            h("button", { key: "off", type: "button", className: "mov-btn movc-danger", onClick: () => void removeEdge(edge.id) }, "\u65AD\u5F00")
          ]))
        ]) : null
      ]) : null;
      const planView = dialog?.stage === "plan" && dialog.plan ? h("div", { key: "plan", className: "movc-plan" }, [
        h("div", { key: "prompt", style: { whiteSpace: "pre-wrap", maxHeight: "26vh", overflow: "auto" } }, dialog.plan.prompt),
        h("div", { key: "spec" }, `${dialog.plan.model} \xB7 ${dialog.plan.ratio}${dialog.plan.duration ? ` \xB7 ${dialog.plan.duration}\u79D2 \xB7 ${String(dialog.plan.resolution).toUpperCase()} \xB7 \u97F3\u9891${dialog.plan.generateAudio ? "\u5F00" : "\u5173"}` : " \xB7 2048\xD72048"}`),
        h("div", { key: "refs" }, dialog.plan.references?.length ? `\u53C2\u8003\u7D20\u6750\uFF1A${dialog.plan.references.map((r) => `${r.port}\u2190${r.nodeId}`).join("\u3001")}` : "\u65E0\u53C2\u8003\u7D20\u6750\uFF08\u7EAF\u6587\u672C\u751F\u6210\uFF09"),
        h("div", { key: "cost" }, dialog.plan.estimate ? `\u9884\u4F30\u8D39\u7528\uFF1A${money2(dialog.plan.estimate.cny)}\uFF08\u57FA\u7840\u516C\u5F0F\u4F30\u4EF7\uFF0C\u5B9E\u9645\u6309\u6E20\u9053\u8D26\u5355\u7ED3\u7B97\uFF09` : "\u5F53\u524D\u4EF7\u76EE\u672A\u77E5\uFF1A\u786E\u8BA4\u540E\u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39\uFF0C\u4E0D\u7F16\u9020\u91D1\u989D\u3002"),
        ...(dialog.plan.notes || []).map((note, index) => h("div", { key: `n${index}` }, note))
      ]) : null;
      const jobView = dialog?.stage === "job" && dialog.job ? h("div", { key: "job" }, [
        h("div", { key: "state", className: "movc-plan" }, [
          h("div", { key: "s" }, `${dialog.job.operation === "extend" ? "\u7EED\u62CD" : "\u751F\u6210"} \xB7 ${phaseText(dialog.job.state)}${dialog.job.taskId ? ` \xB7 \u4EFB\u52A1 ${dialog.job.taskId}` : ""}`),
          h("div", { key: "r" }, `\u7ED3\u679C\u5BA1\u6838\uFF1A${dialog.job.reviewed ? "\u5DF2\u901A\u8FC7" : "\u672A\u901A\u8FC7"}\uFF1B\u56DE\u586B\uFF1A${dialog.job.sync?.status || (dialog.job.media?.length ? "\u5F85\u56DE\u586B" : "\u65E0\u6210\u679C")}`),
          dialog.job.message ? h("div", { key: "m" }, dialog.job.message) : null
        ]),
        ...(dialog.job.media || []).map((media, index) => h(media.kind === "image" ? "img" : "video", {
          key: `m${index}`,
          src: media.url,
          alt: media.label || "",
          controls: media.kind === "video",
          preload: "metadata",
          className: "movc-media",
          style: { maxHeight: "38vh" }
        })),
        h("div", { key: "ops", className: "movc-row" }, [
          dialog.job.media?.length && !dialog.job.reviewed ? h("button", { key: "ok", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void act("review", { accept: true }) }, "\u786E\u8BA4\u7ED3\u679C\u5E76\u7EE7\u7EED") : null,
          dialog.job.media?.length && !dialog.job.reviewed ? h("button", { key: "no", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void closeDialog() }, "\u4E0D\u901A\u8FC7\uFF08\u4FDD\u7559\u6210\u679C\uFF09") : null,
          dialog.job.sync?.status !== "synced" && dialog.job.media?.length ? h("button", { key: "sync", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void act("sync") }, "\u8865\u56DE\u586B\u753B\u5E03") : null,
          ["unknown", "interrupted", "submission_unknown"].includes(dialog.job.state) ? h("button", { key: "query", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void act("query") }, "\u67E5\u8BE2\u539F\u4EFB\u52A1") : null,
          dialog.type === "video" && dialog.job.reviewed && dialog.job.media?.length ? h("button", { key: "extend", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", plan: null }) }, "\u7EED\u62CD\u4E0B\u4E00\u6BB5") : null,
          dialog.job.state !== "running" ? h("button", { key: "again", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", job: null, plan: null }) }, "\u91CD\u65B0\u751F\u6210\uFF08\u91CD\u65B0\u786E\u8BA4\u8D39\u7528\uFF09") : null
        ])
      ]) : null;
      return h("section", { className: ROOT_CLASS }, [
        h("style", { key: "css" }, PAGE_CSS + CSS),
        h("div", { key: "title", className: "mov-section-title" }, "\u6D41\u7A0B\u753B\u5E03"),
        // 画布操作全部放最上面：先选画布、再操作当前画布，画布区只负责画本事。
        h("div", { key: "top", className: "movc-top" }, [
          h("div", { key: "ops", className: "movc-bar movc-ops" }, [
            canvas ? h("span", { key: "name", className: "movc-name" }, inline ? [
              h("input", {
                key: "input",
                autoFocus: true,
                value: inline.value,
                "aria-label": "\u753B\u5E03\u540D\u79F0",
                onChange: (e) => setInline({ value: e.target.value, error: "" }),
                onKeyDown: (e) => {
                  if (e.key === "Enter") {
                    e.preventDefault();
                    void commitRename();
                  }
                  if (e.key === "Escape") {
                    e.preventDefault();
                    setInline(null);
                  }
                },
                onBlur: () => void commitRename()
              })
            ] : [
              h("button", { key: "text", type: "button", className: "movc-name-text", title: "\u53CC\u51FB\u753B\u5E03\u540D\u91CD\u547D\u540D", onDoubleClick: () => setInline({ value: canvas.name || "", error: "" }) }, canvas.name || canvas.projectId),
              h("button", { key: "edit", type: "button", className: "movc-mini", title: "\u91CD\u547D\u540D", onClick: () => setInline({ value: canvas.name || "", error: "" }) }, "\u270E")
            ]) : h("span", { key: "name-empty", className: "movc-name-empty" }, "\u672A\u9009\u62E9\u753B\u5E03"),
            h("span", { key: "sep-a", className: "movc-sep" }),
            h("button", { key: "new-canvas", type: "button", className: "mov-btn mov-btn-primary", onClick: () => setCreateDialog({ value: "", error: "" }) }, "\u65B0\u5EFA\u753B\u5E03\u2026"),
            canvas ? h("span", { key: "sep-b", className: "movc-sep" }) : null,
            canvas ? h("button", { key: "chain", type: "button", className: "mov-btn", title: "\u4E00\u6B21\u786E\u8BA4\u6574\u6761\u94FE\u8DEF\u7684\u65B9\u6848\u4E0E\u603B\u8D39\u7528\uFF0C\u6309\u987A\u5E8F\u9010\u6BB5\u751F\u6210\uFF1B\u6BCF\u6BB5\u6210\u679C\u4ECD\u9700\u4F60\u5BA1\u6838", onClick: () => void openChain() }, "\u8FDE\u62CD") : null,
            canvas ? h("button", {
              key: "merge-film",
              type: "button",
              className: "mov-btn movc-run",
              disabled: Boolean(filmDialog?.busy) || !film?.total,
              title: film?.missing?.length ? `\u8FD8\u6709 ${film.missing.length} \u6BB5\u6CA1\u6709\u6210\u679C\uFF1A${film.missing.join("\u3001")}` : film?.total ? "\u628A\u5DF2\u751F\u6210\u7684\u6BCF\u6BB5\u89C6\u9891\u6309\u8FDE\u7EBF\u987A\u5E8F\u62FC\u6210\u4E00\u6761\u6210\u7247\uFF0C\u53EA\u9700\u4E00\u6B21\u786E\u8BA4" : "\u753B\u5E03\u4E0A\u8FD8\u6CA1\u6709\u89C6\u9891\u8282\u70B9",
              onClick: () => void mergeFilm()
            }, filmDialog?.busy ? "\u5408\u6210\u4E2D\u2026" : "\u5408\u6210\u6210\u7247") : null,
            canvas ? h("span", { key: "sep-flow", className: "movc-sep" }) : null,
            canvas ? h(
              "button",
              {
                key: "run-next",
                type: "button",
                className: "mov-btn movc-run",
                disabled: !nextStep,
                title: nextStep ? `\u5F53\u524D\u8BFB\u53D6\u8282\u70B9\u5185\u5BB9\u5E76\u6CBF\u4E0A\u6E38\u62FC\u63A5\u63D0\u793A\u8BCD\uFF0C\u751F\u6210\u524D\u4ECD\u9700\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528` : "\u6D41\u7A0B\u91CC\u7684\u5236\u4F5C\u8282\u70B9\u90FD\u5DF2\u6709\u6210\u679C",
                onClick: () => {
                  const node = (canvas?.nodes || {})[nextStep?.id];
                  if (node) void openDialog(node);
                }
              },
              nextStep ? `\u5236\u4F5C\u300C${labelOf((canvas?.nodes || {})[nextStep.id])}\u300D` : "\u6D41\u7A0B\u5DF2\u5B8C\u6210"
            ) : null,
            canvas && steps.length ? h("span", { key: "flow-progress", className: "movc-flow" }, `\u6D41\u7A0B\u8FDB\u5EA6 ${doneSteps}/${steps.length}${nextStep ? "" : " \xB7 \u5168\u90E8\u6709\u6210\u679C"}`) : null,
            canvas ? h("span", { key: "sep-c", className: "movc-sep" }) : null,
            canvas ? h("button", { key: "refresh", type: "button", className: "mov-btn", onClick: () => void refresh() }, "\u5237\u65B0") : null,
            canvas ? h("button", { key: "tidy", type: "button", className: "mov-btn", title: "\u6309\u8FDE\u7EBF\u91CD\u6392\u8282\u70B9\u3001\u81EA\u52A8\u7559\u767D\u5BF9\u9F50\u5E76\u9002\u914D\u89C6\u56FE\uFF0C\u4E0D\u6539\u5185\u5BB9\u4E0E\u8FDE\u7EBF", onClick: () => void tidy() }, "\u7F8E\u5316\u5E03\u5C40") : null,
            canvas ? h("button", { key: "reset", type: "button", className: "mov-btn", title: "\u628A\u89C6\u56FE\u6062\u590D\u5230\u9ED8\u8BA4\u4F4D\u7F6E\uFF1B\u5E26\u6D41\u7A0B\u9636\u6BB5\u6761\u65F6\u6309\u6574\u5F20\u56FE\u9002\u914D", onClick: () => stageNodes.length ? fitStage(canvas, {}) : setView({ x: 30, y: 24, scale: 1 }) }, "\u91CD\u7F6E\u89C6\u56FE") : null,
            canvas ? h("button", { key: "export", type: "button", className: "mov-btn", onClick: () => exportCanvas() }, "\u5BFC\u51FA JSON") : null,
            canvas ? h("span", { key: "sep-d", className: "movc-sep" }) : null,
            canvas && selectedIds.length ? h("button", { key: "del-selected", type: "button", className: "mov-btn movc-danger", onClick: () => void removeNodes(selectedIds) }, `\u5220\u9664\u9009\u4E2D\uFF08${selectedIds.length}\uFF09`) : null,
            canvas ? h("button", { key: "del-canvas", type: "button", className: "mov-btn movc-danger", onClick: () => setConfirmDelete(true) }, "\u5220\u9664\u753B\u5E03") : null
          ]),
          h("div", { key: "picker", className: "movc-bar movc-picker" }, [
            h("span", { key: "pick-label", className: "movc-pick" }, "\u9009\u62E9\u753B\u5E03"),
            list.length ? h("div", { key: "list", className: "movc-list" }, list.map((item) => h(
              "button",
              { key: item.projectId, type: "button", className: "movc-chip", "data-active": String(canvas?.projectId === item.projectId), onClick: () => void load(item.projectId) },
              `${item.name} \xB7 ${item.nodeCount} \u8282\u70B9`
            ))) : h("span", { key: "no-canvas", className: "movc-hint" }, "\u6682\u65E0\u753B\u5E03\uFF0C\u70B9\u300C\u65B0\u5EFA\u753B\u5E03\u2026\u300D\u521B\u5EFA\u4E00\u4EFD\u7A7A\u767D\u6587\u6863\u3002")
          ])
        ]),
        error ? h("p", { key: "error", className: "movc-hint" }, error) : null,
        !list.length ? h("p", { key: "empty", className: "movc-hint" }, "\u8FD8\u6CA1\u6709\u6D41\u7A0B\u753B\u5E03\uFF1A\u70B9\u300C\u65B0\u5EFA\u753B\u5E03\u2026\u300D\u53EF\u4EE5\u7ACB\u523B\u521B\u5EFA\u4E00\u4EFD\u7A7A\u767D\u6587\u6863\uFF1B\u5982\u679C\u5728\u8BBE\u7F6E\u9875\u6253\u5F00\u300C\u81EA\u52A8\u521B\u5EFA\u6D41\u7A0B\u753B\u5E03\u300D\uFF08\u9ED8\u8BA4\u5173\u95ED\uFF09\uFF0C\u666E\u901A\u521B\u4F5C\u786E\u8BA4\u9700\u6C42\u540E\u4E5F\u4F1A\u5728\u8FD9\u91CC\u81EA\u52A8\u5EFA\u7ACB\uFF0C\u811A\u672C\u5BA1\u6838\u540E\u540C\u6B65\u5206\u955C\u4E0E\u5236\u4F5C\u6BB5\u8BA1\u5212\uFF0C\u751F\u6210\u6210\u679C\u81EA\u52A8\u56DE\u586B\u3002") : null,
        canvas ? h("div", {
          key: "stage",
          ref: stageRef,
          className: "movc-stage",
          "data-panning": String(panning),
          "data-connect": String(Boolean(connectFrom)),
          onClick: (event) => {
            if (connectFrom) {
              setConnectFrom("");
              return;
            }
            if (marqueeDone.current) {
              marqueeDone.current = false;
              return;
            }
            if (!event?.shiftKey) setSelectedIds([]);
          },
          onWheel,
          onPointerDown,
          onPointerMove,
          onPointerUp,
          onPointerCancel: onPointerUp
        }, [
          h("div", { key: "world", className: "movc-world", style: { transform: `translate(${view.x}px, ${view.y}px) scale(${view.scale})` } }, [
            h(
              "svg",
              { key: "edges", style: { position: "absolute", left: -4e3, top: -4e3, width: 8e3, height: 8e3, overflow: "visible" } },
              h("g", { transform: "translate(4000 4000)" }, [
                // 阶段卡之间的虚线箭头（只画出来，不落进画布连线，阶段卡不参与生成）。
                h("defs", { key: "stage-arrow-def" }, h(
                  "marker",
                  { id: "movc-stage-arrow", viewBox: "0 0 10 10", refX: 8, refY: 5, markerWidth: 6, markerHeight: 6, orient: "auto-start-reverse" },
                  h("path", { key: "head", className: "movc-stage-arrowhead", d: "M0,0 L10,5 L0,10 z" })
                )),
                ...edges.map((edge) => {
                  const from = at(edge.fromNode), to = at(edge.toNode);
                  if (!from || !to) return null;
                  const x1 = from.x + from.w, y1 = from.y + from.h / 2, x2 = to.x, y2 = to.y + to.h / 2;
                  const bend = Math.max(40, Math.abs(x2 - x1) / 2);
                  const path = `M ${x1} ${y1} C ${x1 + bend} ${y1}, ${x2 - bend} ${y2}, ${x2} ${y2}`;
                  return h("g", { key: edge.id || `${edge.fromNode}-${edge.toNode}` }, [
                    h("path", { key: "line", className: "movc-edge", d: path }),
                    h(
                      "path",
                      { key: "hit", className: "movc-edge-hit", d: path, onClick: (e) => {
                        e.stopPropagation();
                        void removeEdge(edge.id);
                      } },
                      h("title", { key: "title" }, "\u70B9\u51FB\u65AD\u5F00\u8FD9\u6761\u8FDE\u7EBF")
                    )
                  ]);
                }),
                ...stageArrows.map((arrow) => h("path", { key: arrow.key, className: "movc-stage-edge", markerEnd: "url(#movc-stage-arrow)", d: arrow.d }))
              ])
            ),
            ...nodes.map((raw) => {
              const node = geometry(raw);
              const media = ["image", "video"].includes(node.type);
              const isStage = Boolean(node?.data?.metaonticStage);
              const chip = nodeChip(node);
              return h("div", {
                key: node.id,
                className: "movc-node",
                "data-selected": String(selectedIds.includes(node.id)),
                "data-current": String(nextStep?.id === node.id || node.id === activeStageId),
                ...node?.data?.metaonticStage ? { "data-stage-state": String(node.data.metaonticStageState || "") } : {},
                style: { left: node.x, top: node.y, width: node.w, height: node.h },
                onPointerDown: (e) => startMove(e, node),
                onClick: (e) => {
                  e.stopPropagation();
                  if (connectFrom && connectFrom !== node.id) {
                    void connectTo(node.id);
                    return;
                  }
                  if (e.shiftKey) setSelectedIds((all) => all.includes(node.id) ? all.filter((id) => id !== node.id) : [...all, node.id]);
                  else setSelectedIds([node.id]);
                }
              }, [
                h("div", { key: "head", className: "movc-node-head" }, [
                  h("span", { key: "label", className: "movc-node-title" }, labelOf(node)),
                  // 状态标签直接复用宿主的结果胶囊样式（.mov-chip / .mov-chip-ok）。
                  h("span", { key: "status", className: chip.className }, chip.text),
                  isStage ? null : h("span", { key: "actions", className: "movc-actions" }, [
                    // 脚本审核就在剧本节点上完成：没审核时按钮用主色突出，审核过就只作状态。
                    node.type === "script" ? h("button", {
                      key: "approve",
                      type: "button",
                      className: `movc-mini${scriptApproved ? "" : " movc-mini-primary"}`,
                      title: scriptApproved ? "\u5267\u672C\u5DF2\u6838\u5BF9\u901A\u8FC7\uFF1B\u70B9\u5F00\u53EF\u7EE7\u7EED\u4FEE\u6539\u5185\u5BB9" : "\u6838\u5BF9\u8FC7\u5267\u672C\u4E0E\u6BCF\u6BB5\u63D0\u793A\u8BCD\u540E\u70B9\u8FD9\u91CC\uFF1A\u811A\u672C\u5BA1\u6838\u901A\u8FC7\uFF0C\u9636\u6BB5\u5361\u2461\u6807\u4E3A\u5DF2\u5B8C\u6210",
                      onPointerDown: (e) => e.stopPropagation(),
                      onClick: (e) => {
                        e.stopPropagation();
                        if (scriptApproved) void openDialog(node);
                        else void confirmScript();
                      }
                    }, scriptApproved ? "\u5DF2\u5BA1\u6838" : "\u786E\u8BA4\u811A\u672C") : null,
                    h("button", { key: "edit", type: "button", className: "movc-mini", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      void openDialog(node);
                    } }, media ? "\u5236\u4F5C" : "\u7F16\u8F91"),
                    h("button", { key: "copy", type: "button", className: "movc-mini", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      void duplicateNode(node);
                    } }, "\u590D\u5236"),
                    h("button", { key: "link", type: "button", className: "movc-mini", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      setConnectFrom(connectFrom === node.id ? "" : node.id);
                      setSelectedIds([node.id]);
                    } }, connectFrom === node.id ? "\u53D6\u6D88\u8FDE\u7EBF" : "\u8FDE\u7EBF"),
                    h("button", { key: "del", type: "button", className: "movc-mini movc-mini-danger", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      void removeNodes([node.id]);
                    } }, "\u5220\u9664")
                  ])
                ]),
                isStage ? stageBody(node) : nodeBody(node)
              ]);
            })
          ]),
          marquee ? h("div", { key: "marquee", className: "movc-marquee", style: {
            left: Math.min(marquee.x1, marquee.x2),
            top: Math.min(marquee.y1, marquee.y2),
            width: Math.abs(marquee.x2 - marquee.x1),
            height: Math.abs(marquee.y2 - marquee.y1)
          } }) : null,
          // 画布本身就是生成流程：入口放在画布上，不放工具条的一排建节点按钮。
          canvas && nodes.length ? h("button", { key: "flow-entry", type: "button", className: "movc-flow-entry", title: "\u8DDF\u5BF9\u8BDD\u4E00\u6837\u4E24\u6B65\u8D70\uFF1A\u5148\u521B\u5EFA\u9700\u6C42\uFF0C\u518D\u5199\u811A\u672C\uFF0C\u7136\u540E\u94FA\u5F00\u5206\u955C\u4E0E\u6BCF\u6BB5\u5236\u4F5C", onClick: (event) => {
            event.stopPropagation();
            void openFlow();
          } }, "\uFF0B \u521B\u4F5C\u6D41\u7A0B") : null,
          canvas && !nodes.length ? h("div", {
            key: "invite",
            className: "movc-invite",
            role: "button",
            tabIndex: 0,
            onClick: (event) => {
              event.stopPropagation();
              void openFlow();
            },
            onKeyDown: (event) => {
              if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                void openFlow();
              }
            }
          }, [
            h("strong", { key: "h" }, "\u70B9\u51FB\u753B\u5E03\u5F00\u59CB\u521B\u4F5C"),
            h("span", { key: "p" }, "\u8DDF\u5BF9\u8BDD\u4E00\u6837\u4E24\u6B65\u8D70\uFF1A\u5148\u521B\u5EFA\u9700\u6C42\uFF0C\u518D\u5199\u811A\u672C\uFF0C\u7136\u540E\u94FA\u5F00\u6574\u6761\u751F\u6210\u6D41\u7A0B\u2014\u2014\u9700\u6C42\u786E\u8BA4 \u2192 \u5267\u672C \u2192 \u5206\u955C \u2192 \u6BCF\u6BB5\u5236\u4F5C \u2192 \u5408\u6210\u6210\u7247\u3002\u751F\u6210\u524D\u4ECD\u8981\u9010\u6BB5\u786E\u8BA4\u65B9\u6848\u4E0E\u8D39\u7528\u3002")
          ]) : null
        ]) : null,
        canvas?.film?.assetId ? h("div", { key: "film-bar", className: "movc-bar" }, [
          h("span", { key: "label", className: "movc-flow" }, `\u6210\u7247\uFF1A${canvas.film.count} \u6BB5${canvas.film.seconds ? ` \xB7 \u7EA6 ${Math.round(canvas.film.seconds)} \u79D2` : ""} \xB7 ${new Date(canvas.film.updatedAt || Date.now()).toLocaleString()} \xB7 \u5DF2\u4FDD\u5B58\u5230\u753B\u5E03\u6570\u636E\u76EE\u5F55`),
          h("button", { key: "play", type: "button", className: "mov-btn", onClick: () => setFilmDialog({ busy: false, film: { ...canvas.film, url: mediaUrl(canvas.film.assetId) }, message: "" }) }, "\u64AD\u653E\u6210\u7247"),
          h("a", { key: "download", className: "movc-link", href: mediaUrl(canvas.film.assetId), download: `${String(canvas.name || "\u6210\u7247")}.mp4` }, "\u4E0B\u8F7D\u6210\u7247")
        ]) : null,
        canvas && steps.length ? h("p", { key: "flow-hint", className: "movc-hint" }, nextStep ? `\u6D41\u7A0B\uFF1A\u6309\u8FDE\u7EBF\u987A\u5E8F\u9010\u4E2A\u5236\u4F5C\uFF0C\u5F53\u524D\u8F6E\u5230\u300C${nextStep.label}\u300D\uFF08\u753B\u5E03\u4E0A\u865A\u7EBF\u6846\u6807\u51FA\uFF09\u3002\u70B9\u300C\u5236\u4F5C\u300C${nextStep.label}\u300D\u300D\u4F1A\u8BFB\u53D6\u8282\u70B9\u5185\u5BB9\u4E0E\u4E0A\u6E38\u5267\u672C/\u5206\u955C\u62FC\u51FA\u63D0\u793A\u8BCD\uFF0C\u4ECD\u7136\u8981\u5148\u6838\u5BF9\u5236\u4F5C\u65B9\u6848\u3001\u5355\u72EC\u786E\u8BA4\u8D39\u7528\u624D\u4F1A\u8C03\u7528\u6A21\u578B\u3002` : `\u6D41\u7A0B\uFF1A${steps.length} \u4E2A\u5236\u4F5C\u8282\u70B9\u90FD\u5DF2\u6709\u56DE\u586B\u6210\u679C\u3002\u8981\u91CD\u505A\u67D0\u4E00\u6BB5\uFF0C\u70B9\u8BE5\u8282\u70B9\u91CC\u7684\u300C\u5236\u4F5C\u300D\uFF0C\u91CD\u65B0\u6838\u5BF9\u65B9\u6848\u5E76\u786E\u8BA4\u8D39\u7528\u3002`) : null,
        stageNodes.length ? h("p", { key: "stage-hint", className: "movc-hint" }, "\u753B\u5E03\u4E0A\u7684\u4E03\u5F20\u300C\u6D41\u7A0B\u9636\u6BB5\u300D\u5361\u5C31\u662F\u8FD9\u6761\u751F\u6210\u6D41\u7A0B\uFF0C\u7BAD\u5934\u8868\u793A\u5148\u540E\uFF0C\u6B65\u9AA4\u8DDF\u5BF9\u8BDD\u4E0E\u4E13\u4E1A\u753B\u5E03\u4E00\u81F4\uFF1A\u2460 \u586B\u9700\u6C42\uFF08\u5199\u60F3\u6CD5/\u65F6\u957F/\u753B\u5E45/\u6E05\u6670\u5EA6\uFF0C\u53EA\u5EFA\u9700\u6C42\u8282\u70B9\u4E0E\u9636\u6BB5\u5361\uFF0C\u4E0D\u8C03\u7528\u6A21\u578B\uFF09\u2192 \u2461 \u5199\u811A\u672C\uFF08\u6CA1\u6709\u811A\u672C\u65F6\uFF09/\u786E\u8BA4\u811A\u672C\uFF08\u5199\u597D\u770B\uFF09/\u770B\u5267\u672C\uFF08\u901A\u8FC7\u540E\uFF09\u2192 \u2462 \u770B\u5206\u955C\uFF08\u6CA1\u6709\u5206\u955C\u65F6\u662F\u300C\u751F\u6210\u5206\u955C\u300D\uFF09\u2192 \u2463 \u51C6\u5907\u7D20\u6750\uFF08\u89D2\u8272\u56FE/\u9996\u5E27/\u53C2\u8003\u56FE\uFF09\u2192 \u2464 \u770B\u4F30\u4EF7 \u2192 \u2465 \u505A\u8FD9\u4E00\u6BB5 \u2192 \u2466 \u5408\u6210\u6210\u7247\u3002\u72B6\u6001\u7531\u63D2\u4EF6\u540C\u6B65\uFF0C\u5F53\u524D\u9636\u6BB5\u7528\u865A\u7EBF\u6846\u6807\u51FA\uFF1B\u5361\u4E0A\u7684\u6309\u94AE\u53EA\u662F\u5165\u53E3\uFF0C\u751F\u6210\u524D\u4ECD\u8981\u9010\u6BB5\u6838\u5BF9\u65B9\u6848\u3001\u5355\u72EC\u786E\u8BA4\u8D39\u7528\uFF0C\u5361\u672C\u8EAB\u4E0D\u53C2\u4E0E\u751F\u6210\u3002") : null,
        canvas && readiness.length ? h("p", { key: "health", className: "movc-hint" }, `\u753B\u5E03\u4F53\u68C0\uFF1A${readinessBrief}\u2014\u2014${readiness[0].message}${chainable ? "\u70B9\u300C\u8FDE\u62CD\u300D\u53EF\u4EE5\u770B\u5230\u5B8C\u6574\u6E05\u5355\u4E0E\u5904\u7406\u5EFA\u8BAE\uFF1B" : ""}\u8FD9\u91CC\u53EA\u63D0\u793A\u753B\u5E03\u5185\u5BB9\u95EE\u9898\uFF0C\u4E0D\u6D89\u53CA\u8D39\u7528\u4E0E\u5BA1\u6838\u3002`) : null,
        canvas ? h("p", { key: "hint", className: "movc-hint" }, `\u70B9\u51FB\u753B\u5E03\u7A7A\u767D\u5904\u5C31\u4F1A\u6253\u5F00\u300C\u521B\u4F5C\u6D41\u7A0B\u300D\u9762\u677F\uFF08\u6709\u9009\u4E2D\u7684\u8282\u70B9\u65F6\u5148\u53D6\u6D88\u9009\u62E9\uFF09\uFF1B\u62D6\u52A8\u7A7A\u767D\u5904\u5E73\u79FB\u3001\u6EDA\u8F6E\u7F29\u653E\uFF0C\u62D6\u52A8\u8282\u70B9\u79FB\u52A8\uFF08\u62D6\u52A8\u5DF2\u9009\u4E2D\u7684\u4EFB\u4E00\u8282\u70B9\u53EF\u6574\u7EC4\u79FB\u52A8\uFF09\uFF0CShift+\u62D6\u7A7A\u767D\u6846\u9009\uFF08Shift+\u70B9\u8282\u70B9\u53EF\u52A0\u9009\uFF09\uFF0C\u70B9\u300C\u8FDE\u7EBF\u300D\u540E\u518D\u70B9\u76EE\u6807\u8282\u70B9\u8FDE\u63A5\uFF08\u70B9\u8FDE\u7EBF\u53EF\u65AD\u5F00\uFF09\uFF1B\u60F3\u4E00\u6B21\u786E\u8BA4\u6574\u6761\u94FE\u8DEF\u518D\u9010\u6BB5\u751F\u6210\u5C31\u70B9\u300C\u8FDE\u62CD\u300D\uFF0C\u53C2\u8003\u7D20\u6750\u5728\u89C6\u9891\u8282\u70B9\u7684\u5236\u4F5C\u7A97\u53E3\u91CC\u7528\u300C\u5BFC\u5165\u56FE\u7247\u7D20\u6750\u300D\u6216\u300C\u65B0\u5EFA\u53C2\u8003\u56FE\u8282\u70B9\u300D\u8865\uFF0C\u6BCF\u6BB5\u90FD\u51FA\u6210\u679C\u540E\u70B9\u300C\u5408\u6210\u6210\u7247\u300D\u62FC\u6210\u4E00\u6761\u53EF\u9884\u89C8\u3001\u53EF\u4E0B\u8F7D\u7684\u6210\u7247\u3002\u6570\u636E\u76EE\u5F55\uFF1A${canvas.dataRoot}\uFF08\u7D20\u6750\u4E0E\u6210\u679C\u7531\u672C\u63D2\u4EF6\u4FDD\u5B58\uFF09`) : null,
        connectFrom ? h("p", { key: "connect", className: "movc-hint" }, "\u8FDE\u7EBF\u6A21\u5F0F\uFF1A\u70B9\u51FB\u76EE\u6807\u8282\u70B9\u5B8C\u6210\u8FDE\u63A5\uFF0C\u70B9\u7A7A\u767D\u5904\u53D6\u6D88\u3002") : null,
        confirmDelete ? h(
          "div",
          { key: "delete-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          } },
          h("div", { key: "body", className: "movc-modal-body", style: { width: "min(420px, calc(100vw - 32px))" } }, [
            h("h4", { key: "h" }, "\u5220\u9664\u753B\u5E03"),
            h("p", { key: "ask", className: "movc-status" }, `\u786E\u5B9A\u5220\u9664\u300C${canvas?.name || ""}\u300D\u5417\uFF1F\u753B\u5E03\u4E0A\u7684\u8282\u70B9\u4E0E\u8FDE\u7EBF\u4F1A\u4E00\u8D77\u5220\u9664\uFF0C\u4E14\u4E0D\u4F1A\u81EA\u52A8\u91CD\u5EFA\uFF1B\u5DF2\u751F\u6210\u7684\u6210\u679C\u7D20\u6750\u6587\u4EF6\u4ECD\u4FDD\u7559\u5728\u63D2\u4EF6\u6570\u636E\u76EE\u5F55\u3002`),
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", onClick: () => setConfirmDelete(false) }, "\u53D6\u6D88"),
              h("button", { key: "ok", type: "button", className: "mov-btn", onClick: () => void deleteCanvas() }, "\u786E\u8BA4\u5220\u9664")
            ])
          ])
        ) : null,
        filmDialog ? h(
          "div",
          { key: "film-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget && !filmDialog.busy) setFilmDialog(null);
          } },
          h("div", { key: "body", className: "movc-modal-body" }, [
            h("h4", { key: "h" }, "\u5408\u6210\u6210\u7247"),
            filmDialog.busy ? h("p", { key: "busy", className: "movc-status" }, "\u6B63\u5728\u6309\u8FDE\u7EBF\u987A\u5E8F\u8BFB\u53D6\u6BCF\u6BB5\u6210\u679C\u5E76\u5408\u5E76\uFF0C\u957F\u89C6\u9891\u9700\u8981\u4E00\u70B9\u65F6\u95F4\u2026") : null,
            filmDialog.film?.url ? h("video", { key: "player", src: filmDialog.film.url, controls: true, preload: "metadata", className: "movc-media", style: { maxHeight: "46vh" } }) : null,
            filmDialog.film ? h(
              "p",
              { key: "info", className: "movc-status" },
              `\u6210\u7247\uFF1A${filmDialog.film.count} \u6BB5${filmDialog.film.seconds ? ` \xB7 \u7EA6 ${Math.round(filmDialog.film.seconds)} \u79D2` : ""}\uFF1B\u6587\u4EF6\u5DF2\u4FDD\u5B58\u5230\u753B\u5E03\u6570\u636E\u76EE\u5F55\uFF0C\u53EF\u76F4\u63A5\u9884\u89C8\u6216\u4E0B\u8F7D\u3002`
            ) : null,
            filmDialog.film?.segments?.length ? h(
              "div",
              { key: "segs", className: "movc-plan" },
              filmDialog.film.segments.map((segment) => h(
                "div",
                { key: `s${segment.index}` },
                `\u7B2C${segment.index}\u6BB5\u300C${segment.label}\u300D${segment.seconds ? `${segment.seconds}\u79D2` : ""}`
              ))
            ) : null,
            filmDialog.message ? h("p", { key: "msg", className: "movc-status", "data-error": "true" }, filmDialog.message) : null,
            h("p", { key: "note", className: "movc-status" }, "\u5408\u6210\u53EA\u8BFB\u53D6\u5DF2\u7ECF\u751F\u6210\u7684\u6210\u679C\uFF0C\u4E0D\u4F1A\u91CD\u65B0\u751F\u6210\u4EFB\u4F55\u6BB5\u843D\uFF0C\u4E5F\u4E0D\u4EA7\u751F\u65B0\u7684\u6A21\u578B\u8D39\u7528\u3002"),
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "close", type: "button", className: "mov-btn", disabled: filmDialog.busy, onClick: () => setFilmDialog(null) }, "\u5173\u95ED"),
              filmDialog.film?.url ? h("a", { key: "download", className: "movc-link", href: filmDialog.film.url, download: `${String(canvas?.name || "\u6210\u7247")}.mp4` }, "\u4E0B\u8F7D\u6210\u7247") : null,
              !filmDialog.busy ? h("button", { key: "again", type: "button", className: "mov-btn mov-btn-primary", onClick: () => void mergeFilm() }, "\u91CD\u65B0\u5408\u6210") : null
            ])
          ])
        ) : null,
        chainDialog ? h(
          "div",
          { key: "chain-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget && !chainDialog.busy) {
              stopChainPolling();
              setChainDialog(null);
            }
          } },
          h("div", { key: "body", className: "movc-modal-body" }, [
            h("h4", { key: "h" }, "\u8FDE\u62CD\uFF1A\u4E00\u6B21\u786E\u8BA4\uFF0C\u9010\u6BB5\u751F\u6210"),
            chainDialog.loading ? h("p", { key: "loading", className: "movc-status" }, "\u6B63\u5728\u6309\u753B\u5E03\u4E0A\u7684\u89C6\u9891\u8282\u70B9\u6392\u8FDE\u62CD\u65B9\u6848\u2026") : null,
            chainDialog.plan ? h("div", { key: "plan", className: "movc-plan" }, [
              h("div", { key: "head" }, chainPlanPending ? `\u8FDE\u62CD\u65B9\u6848\uFF1A\u672C\u6B21\u751F\u6210 ${chainPlanPending} \u6BB5${chainDialog.plan.segments.length > chainPlanPending ? `\uFF08\u53E6\u6709 ${chainDialog.plan.segments.length - chainPlanPending} \u6BB5\u5DF2\u6709\u6210\u679C\uFF0C\u8DF3\u8FC7\u4E0D\u91CD\u590D\u751F\u6210\uFF09` : ""}${chainDialog.plan.cny !== null ? ` \xB7 \u9884\u4F30 \xA5${(Math.round(chainDialog.plan.cny * 1e4) / 1e4).toFixed(4)}\uFF08\u57FA\u7840\u516C\u5F0F\uFF0C\u6309\u6E20\u9053\u8D26\u5355\u7ED3\u7B97\uFF09` : " \xB7 \u6309\u5B9E\u9645\u8C03\u7528\u8BA1\u8D39"}${chainDialog.plan.priceDate ? ` \xB7 \u4EF7\u76EE ${chainDialog.plan.priceDate}` : ""}` : `\u8FDE\u62CD\u65B9\u6848\uFF1A\u6574\u6761\u94FE\u8DEF ${chainDialog.plan.segments.length} \u6BB5\u90FD\u5DF2\u6709\u6210\u679C\uFF0C\u6CA1\u6709\u8981\u751F\u6210\u7684\u4E86`),
              ...chainDialog.plan.segments.map((segment) => h(
                "div",
                { key: `s${segment.index}`, ...segment.skip ? { "data-skip": "true" } : {} },
                segment.skip ? `\u2713 \u7B2C${segment.index + 1}\u6BB5\u300C${segment.label}\u300D${segment.seconds}\u79D2\uFF1A\u5DF2\u6709\u6210\u679C\uFF0C\u672C\u6B21\u8DF3\u8FC7\uFF08\u4E0D\u91CD\u590D\u751F\u6210\u3001\u4E0D\u91CD\u590D\u8BA1\u8D39\uFF09` : `\u7B2C${segment.index + 1}\u6BB5\u300C${segment.label}\u300D${segment.seconds}\u79D2 \xB7 ${segment.operation === "extend" ? "\u7EED\u62CD\u4E0A\u4E00\u6BB5" : "\u9996\u6BB5\u76F4\u51FA"} \xB7 ${segment.ratio} ${String(segment.resolution).toUpperCase()}\uFF1A${String(segment.prompt).slice(0, 70)}${String(segment.prompt).length > 70 ? "\u2026" : ""}`
              )),
              h("div", { key: "note" }, "\u6CA1\u6709\u6210\u679C\u7684\u6BB5\u624D\u4F1A\u751F\u6210\uFF1A\u63A5\u7740\u5DF2\u6709\u6210\u679C\u7684\u6BB5\u843D\u7EED\u62CD\uFF0C\u6574\u6761\u94FE\u8DEF\u4E00\u6BB5\u6210\u679C\u90FD\u6CA1\u6709\u65F6\u7B2C 1 \u6BB5\u76F4\u51FA\uFF1B\u6BCF\u6BB5\u51FA\u6210\u679C\u540E\u90FD\u4F1A\u505C\u4E0B\u6765\u7B49\u4F60\u5BA1\u6838\uFF0C\u5BA1\u6838\u901A\u8FC7\u624D\u7EE7\u7EED\u4E0B\u4E00\u6BB5\u3002\u5DF2\u6709\u6210\u679C\u7684\u6BB5\u4E0D\u91CD\u590D\u751F\u6210\uFF0C\u4E5F\u4E0D\u91CD\u590D\u8BA1\u8D39\u3002")
            ]) : null,
            chainDialog.chain ? h("div", { key: "chain", className: "movc-plan" }, [
              h("div", { key: "head" }, `${chainStatusText(chainDialog.chain)}`),
              chainDialog.chain.segments.map((segment) => h(
                "div",
                { key: `c${segment.index}` },
                `${segment.index < chainDialog.chain.done ? "\u2713 " : segment.index === chainDialog.chain.index ? "\u25B6 " : "\xB7 "}\u7B2C${segment.index + 1}\u6BB5\u300C${segment.label}\u300D${segment.seconds}\u79D2${segment.skip ? "\uFF1A\u5DF2\u6709\u6210\u679C\uFF0C\u672C\u6B21\u8DF3\u8FC7" : segment.index < chainDialog.chain.done ? "\uFF1A\u5DF2\u6709\u6210\u679C" : ""}`
              )),
              chainDialog.chain.message ? h("div", { key: "msg" }, chainDialog.chain.message) : null
            ]) : null,
            chainDialog.chain?.job?.media?.length && chainDialog.chain.state === "review" ? h(
              "div",
              { key: "media" },
              chainDialog.chain.job.media.map((media, index) => h(media.kind === "image" ? "img" : "video", {
                key: `m${index}`,
                src: media.url,
                alt: media.label || "",
                controls: media.kind === "video",
                preload: "metadata",
                className: "movc-media",
                style: { maxHeight: "38vh" }
              }))
            ) : null,
            chainDialog.chain && chainDialog.chain.state === "review" ? h("p", { key: "review-note", className: "movc-status" }, "\u5148\u770B\u8FD9\u4E00\u6BB5\uFF1A\u6EE1\u610F\u5C31\u300C\u786E\u8BA4\u5E76\u7EE7\u7EED\u4E0B\u4E00\u6BB5\u300D\uFF0C\u4E0D\u6EE1\u610F\u53EF\u4EE5\u505C\u6B62\u8FDE\u62CD\uFF0C\u5DF2\u751F\u6210\u7684\u6210\u679C\u90FD\u4FDD\u7559\u5728\u753B\u5E03\u4E0A\u3002") : null,
            chainDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, chainDialog.error) : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("div", { key: "batch-checks", className: "movc-plan" }, [
              h("div", { key: "head" }, "\u5F00\u59CB\u6279\u91CF\u751F\u6210\u524D\uFF0C\u8BF7\u5148\u5B8C\u6210\uFF1A"),
              ...batchChecks.map((item) => h(
                "div",
                { key: item.key, "data-batch-check": item.key, "data-ok": String(item.ok) },
                `${item.ok ? "\u2713 " : "\xB7 "}${item.label}\u2014 ${item.hint}`
              )),
              h("div", { key: "tail" }, "\u8FD9\u51E0\u9879\u90FD\u5C31\u7EEA\u540E\u518D\u5F00\u59CB\u8FDE\u62CD\uFF1B\u6BCF\u6BB5\u51FA\u6210\u679C\u4ECD\u4F1A\u505C\u4E0B\u6765\u7B49\u4F60\u5BA1\u6838\u3002")
            ]) : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("div", { key: "readiness", className: "movc-plan" }, [
              h("div", { key: "head" }, readiness.length ? `\u753B\u5E03\u4F53\u68C0\uFF1A\u8FD8\u6709 ${readiness.length} \u5904\u6CA1\u51C6\u5907\u9F50` : "\u753B\u5E03\u4F53\u68C0\uFF1A\u6CA1\u6709\u53D1\u73B0\u95EE\u9898"),
              ...readiness.slice(0, 6).map((item) => h(
                "div",
                {
                  key: `${item.code}-${item.nodeId}`,
                  "data-readiness": item.code,
                  "data-severity": item.severity
                },
                `${item.severity === "error" ? "\u2715 " : "\xB7 "}${item.message}${item.suggestedAction}`
              )),
              readiness.length > 6 ? h("div", { key: "more" }, `\u8FD8\u6709 ${readiness.length - 6} \u5904\uFF0C\u5148\u5904\u7406\u4E0A\u9762\u8FD9\u4E9B\u3002`) : null,
              h("div", { key: "tail" }, "\u4F53\u68C0\u53EA\u770B\u753B\u5E03\u5185\u5BB9\uFF1A\u7F3A\u6210\u679C\u7684\u6BB5\u3001\u6CA1\u63A5\u5230\u5236\u4F5C\u6BB5\u7684\u7D20\u6750\u3001\u65AD\u6389\u7684\u8FDE\u7EBF\uFF0C\u4EE5\u53CA\u6210\u7247\u6BB5\u6570\u548C\u73B0\u5728\u7684\u89C6\u9891\u6210\u679C\u5BF9\u4E0D\u4E0A\u3002\u8D39\u7528\u4E0E\u5BA1\u6838\u4ECD\u6309\u6BCF\u6BB5\u81EA\u5DF1\u786E\u8BA4\u3002")
            ]) : null,
            chainDialog.plan && !chainDialog.chain && !chainPlanPending ? h("p", { key: "nothing", className: "movc-status" }, "\u6574\u6761\u94FE\u8DEF\u7684\u89C6\u9891\u6BB5\u90FD\u5DF2\u6709\u6210\u679C\uFF0C\u4E0D\u9700\u8981\u518D\u8FDE\u62CD\uFF1B\u8981\u91CD\u505A\u54EA\u4E00\u6BB5\uFF0C\u5C31\u70B9\u90A3\u4E2A\u8282\u70B9\u81EA\u5DF1\u7684\u300C\u5236\u4F5C\u300D\u3002") : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("div", { key: "confirms" }, [
              h("label", { key: "p", className: "movc-check" }, [h("input", { type: "checkbox", checked: chainDialog.confirm.plan === true, onChange: (e) => patchChainDialog({ confirm: { ...chainDialog.confirm, plan: e.target.checked } }) }), " \u6211\u5DF2\u6838\u5BF9\u6574\u6761\u94FE\u8DEF\u7684\u65B9\u6848\uFF08\u6BCF\u6BB5\u63D0\u793A\u8BCD\u3001\u65F6\u957F\u3001\u753B\u5E45\u4E0E\u6E05\u6670\u5EA6\uFF09"]),
              h("label", { key: "c", className: "movc-check" }, [h("input", { type: "checkbox", checked: chainDialog.confirm.cost === true, onChange: (e) => patchChainDialog({ confirm: { ...chainDialog.confirm, cost: e.target.checked } }) }), " \u6211\u5DF2\u786E\u8BA4\u6574\u6761\u94FE\u8DEF\u7684\u9884\u4F30\u8D39\u7528\uFF0C\u6309\u6E20\u9053\u8D26\u5355\u7ED3\u7B97"])
            ]) : null,
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "close", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => {
                stopChainPolling();
                setChainDialog(null);
              } }, "\u5173\u95ED"),
              chainDialog.chain?.state === "running" ? h("button", { key: "stop", type: "button", className: "mov-btn movc-danger", disabled: chainDialog.busy, onClick: () => void stopChain() }, "\u505C\u6B62\u8FDE\u62CD") : null,
              chainDialog.chain?.state === "review" && chainDialog.chain.job?.sync?.status !== "synced" ? h("button", { key: "sync", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => void syncChainSegment() }, "\u8865\u56DE\u586B\u753B\u5E03") : null,
              chainDialog.chain?.state === "review" ? h("button", { key: "stop2", type: "button", className: "mov-btn movc-danger", disabled: chainDialog.busy, onClick: () => void stopChain() }, "\u505C\u6B62\u8FDE\u62CD") : null,
              chainDialog.chain?.state === "review" ? h("button", { key: "next", type: "button", className: "mov-btn mov-btn-primary", disabled: chainDialog.busy, onClick: () => void advanceChain(true) }, "\u786E\u8BA4\u5E76\u7EE7\u7EED\u4E0B\u4E00\u6BB5") : null,
              chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("button", { key: "start", type: "button", className: "mov-btn mov-btn-primary", disabled: chainDialog.busy || !(chainDialog.confirm.plan && chainDialog.confirm.cost), onClick: () => void startChain() }, "\u786E\u8BA4\u5E76\u5F00\u59CB\u8FDE\u62CD") : null,
              chainDialog.chain && ["done", "stopped", "stale"].includes(chainDialog.chain.state) && chainDialog.plan ? h("button", { key: "again", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => void openChain() }, "\u91CD\u65B0\u770B\u65B9\u6848") : null,
              chainDialog.chain && chainDialog.chain.state === "done" ? h("button", { key: "close2", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => {
                stopChainPolling();
                setChainDialog(null);
              } }, "\u5B8C\u6210") : null
            ])
          ])
        ) : null,
        scriptDialog ? h(
          "div",
          { key: "script-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget && !scriptDialog.busy) setScriptDialog(null);
          } },
          h("div", { key: "body", className: "movc-modal-body" }, scriptDialog.step === "requirement" ? [
            // 第一步：只创建需求（想法 + 规格），不写脚本、不调用模型、不产生视频费用。
            h("h4", { key: "h" }, "\u521B\u5EFA\u9700\u6C42"),
            h("p", { key: "flow-note", className: "movc-status" }, "\u8DDF\u5BF9\u8BDD\u4E00\u6837\u5148\u786E\u8BA4\u9700\u6C42\uFF1A\u5199\u4E0B\u60F3\u62CD\u4EC0\u4E48\u4E0E\u89C4\u683C\uFF0C\u521B\u5EFA\u540E\u9636\u6BB5\u5361\u2460\u6807\u4E3A\u5DF2\u5B8C\u6210\uFF1B\u518D\u70B9\u4E00\u6B21\u753B\u5E03\u6216\u9636\u6BB5\u5361\u2461\u5199\u811A\u672C\u3002\u8FD9\u4E00\u6B65\u53EA\u5EFA\u9700\u6C42\u8282\u70B9\u4E0E\u9636\u6BB5\u5361\uFF0C\u4E0D\u8C03\u7528\u4EFB\u4F55\u6A21\u578B\u3001\u4E0D\u4EA7\u751F\u89C6\u9891\u8D39\u7528\u3002"),
            h("label", { key: "idea", className: "movc-field" }, ["\u60F3\u62CD\u4EC0\u4E48", h("input", {
              value: scriptDialog.idea,
              placeholder: "\u4E00\u53E5\u8BDD\u5C31\u591F\uFF0C\u4F8B\u5982\uFF1A\u9752\u65C5\u5929\u53F0\u7684\u6E05\u6668\uFF0C\u4E00\u4E2A\u4EBA\u62D6\u7740\u884C\u674E\u4F4F\u8FDB\u57CE\u5E02\u3002",
              onChange: (e) => patchScriptDialog({ idea: e.target.value, error: "" })
            })]),
            h("label", { key: "work-type", className: "movc-field" }, ["\u4F5C\u54C1\u7C7B\u578B", h("select", { value: scriptDialog.workType || "", onChange: (e) => patchScriptDialog({ workType: e.target.value }) }, [h("option", { key: "unspecified", value: "" }, "\u672A\u6307\u5B9A\uFF0C\u4FDD\u7559\u539F\u610F"), ...availableProfiles().map((p) => h("option", { key: p.work_type, value: p.work_type }, p.label))])]),
            h("div", { key: "spec", className: "movc-row" }, [
              h("label", { key: "total", className: "movc-field" }, ["\u76EE\u6807\u603B\u65F6\u957F\uFF08\u79D2\uFF09", h("input", { type: "number", min: 4, max: 3600, value: scriptDialog.totalSeconds, onChange: (e) => patchScriptDialog({ totalSeconds: e.target.value }) })]),
              h("label", { key: "segment", className: "movc-field" }, ["\u6BCF\u6BB5\u65F6\u957F\uFF08\u79D2\uFF09", h("input", { type: "number", min: 4, max: scriptDialog.singleMax || 15, value: scriptDialog.segmentSeconds, onChange: (e) => patchScriptDialog({ segmentSeconds: e.target.value }) })])
            ]),
            h("div", { key: "spec2", className: "movc-row" }, [
              h("label", { key: "ratio", className: "movc-field" }, ["\u753B\u5E45", h("select", { value: scriptDialog.ratio, onChange: (e) => patchScriptDialog({ ratio: e.target.value }) }, RATIOS.map((r) => h("option", { key: r, value: r }, r)))]),
              h("label", { key: "resolution", className: "movc-field" }, ["\u6E05\u6670\u5EA6", h("select", { value: scriptDialog.resolution, onChange: (e) => patchScriptDialog({ resolution: e.target.value }) }, RESOLUTIONS.map((r) => h("option", { key: r, value: r }, r.toUpperCase())))])
            ]),
            h("p", { key: "note", className: "movc-status" }, `\u5F53\u524D\u6A21\u578B\u5355\u6BB5\u4E0A\u9650 ${scriptDialog.singleMax || 15} \u79D2\uFF1A\u76EE\u6807\u65F6\u957F\u4E0D\u8D85\u8FC7\u4E0A\u9650\u53EA\u5EFA\u4E00\u6BB5\uFF0C\u8D85\u8FC7\u624D\u6309\u6BCF\u6BB5\u65F6\u957F\u6392\u7EED\u62CD\u6BB5\u3002\u9700\u6C42\u786E\u8BA4\u540E\u4ECD\u8981\u9010\u6BB5\u6838\u5BF9\u65B9\u6848\u3001\u5355\u72EC\u786E\u8BA4\u8D39\u7528\u3002`),
            scriptDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, scriptDialog.error) : null,
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", disabled: scriptDialog.busy, onClick: () => setScriptDialog(null) }, "\u53D6\u6D88"),
              h("button", { key: "ok", type: "button", className: "mov-btn mov-btn-primary", disabled: scriptDialog.busy, onClick: () => void createRequirement() }, scriptDialog.busy ? "\u521B\u5EFA\u4E2D\u2026" : "\u521B\u5EFA\u9700\u6C42")
            ])
          ] : [
            // 第二步：按第一步的需求写脚本，预览分段后再铺制作节点。
            h("h4", { key: "h" }, "\u5199\u811A\u672C"),
            h("p", { key: "flow-note", className: "movc-status" }, "\u6309\u7B2C\u4E00\u6B65\u521B\u5EFA\u7684\u9700\u6C42\u5199\u5267\u672C\u4E0E\u5206\u955C\uFF1A\u53EF\u4EE5\u81EA\u5DF1\u5199\uFF0C\u4E5F\u53EF\u4EE5\u8BA9\u6587\u672C\u6A21\u578B\u5199\u3002\u5148\u300C\u9884\u89C8\u5206\u6BB5\u300D\u770B\u6E05\u4F1A\u88AB\u62C6\u6210\u51E0\u6BB5\u3001\u6BCF\u6BB5\u591A\u5C11\u79D2\u4E0E\u63D0\u793A\u8BCD\uFF0C\u518D\u300C\u751F\u6210\u5236\u4F5C\u8282\u70B9\u300D\uFF1B\u8282\u70B9\u5EFA\u597D\u540E\u4ECD\u8981\u9010\u6BB5\u6838\u5BF9\u65B9\u6848\u3001\u5355\u72EC\u786E\u8BA4\u8D39\u7528\u3002"),
            h("div", { key: "need", className: "movc-plan" }, [
              h("div", { key: "brief" }, `\u9700\u6C42\uFF1A${String(scriptDialog.idea || "").trim() || "\uFF08\u9700\u6C42\u8282\u70B9\u91CC\u6CA1\u6709\u5199\u4E0B\u60F3\u6CD5\uFF0C\u5148\u8865\u4E00\u53E5\uFF09"}`),
              h("div", { key: "spec" }, `\u76EE\u6807 ${scriptDialog.totalSeconds} \u79D2 \xB7 \u6BCF\u6BB5 ${scriptDialog.segmentSeconds} \u79D2 \xB7 ${scriptDialog.ratio} \xB7 ${String(scriptDialog.resolution).toUpperCase()}${scriptDialog.textModel ? ` \xB7 \u6587\u672C\u6A21\u578B ${scriptDialog.textModel}` : ""}`)
            ]),
            !String(scriptDialog.idea || "").trim() ? h("label", { key: "idea", className: "movc-field" }, ["\u60F3\u62CD\u4EC0\u4E48\uFF08\u8BA9\u6587\u672C\u6A21\u578B\u5199\u811A\u672C\u7528\uFF09", h("input", {
              value: scriptDialog.idea,
              placeholder: "\u4E00\u53E5\u8BDD\u5C31\u591F\uFF0C\u4F8B\u5982\uFF1A\u9752\u65C5\u5929\u53F0\u7684\u6E05\u6668\uFF0C\u4E00\u4E2A\u4EBA\u62D6\u7740\u884C\u674E\u4F4F\u8FDB\u57CE\u5E02\u3002",
              onChange: (e) => patchScriptDialog({ idea: e.target.value, error: "" })
            })]) : null,
            h("label", { key: "text", className: "movc-field" }, ["\u811A\u672C\u5185\u5BB9\uFF08\u53EF\u4EE5\u76F4\u63A5\u5199\uFF0C\u4E5F\u53EF\u4EE5\u8BA9\u6587\u672C\u6A21\u578B\u5199\uFF09", h("textarea", {
              value: scriptDialog.text,
              placeholder: "\u5199\u4E0B\u8981\u62CD\u7684\u5185\u5BB9\u3002\u5199\u6210 Markdown \u5206\u955C\u8868\uFF08\u8868\u5934\u542B\u300C\u955C\u53F7\u300D\u300C\u955C\u522B\u300D\u300C\u89C6\u89D2\u300D\u300C\u8FD0\u955C\u300D\u300C\u753B\u9762\u300D\u5217\uFF09\u65F6\u4F1A\u6309\u5206\u955C\u5207\u6BB5\uFF0C\u955C\u522B\u3001\u89C6\u89D2\u4E0E\u8FD0\u955C\u4F1A\u4E00\u8D77\u5E26\u8FDB\u8BE5\u6BB5\u63D0\u793A\u8BCD\uFF1B\u5426\u5219\u6309\u53E5\u5B50\u3001\u6BB5\u843D\u6309\u5B57\u6570\u5747\u5206\u3002\u5199\u591A\u5C11\u62C6\u591A\u5C11\uFF0C\u4E0D\u81EA\u52A8\u7F16\u5185\u5BB9\u3002",
              onChange: (e) => patchScriptDialog({ text: e.target.value, error: "" })
            })]),
            h("p", { key: "note", className: "movc-status" }, `\u300CAI \u5199\u811A\u672C\u300D\u4F1A\u6309\u8BBE\u7F6E\u9875\u7684\u6587\u672C\u6A21\u578B\uFF08${scriptDialog.textModel || "\u6587\u672C\u6A21\u578B"}\uFF09\u628A\u9700\u6C42\u5199\u6210\u5267\u672C\u4E0E\u5206\u955C\u8868\uFF0C\u5355\u72EC\u6309\u6587\u672C\u8BA1\u8D39\uFF1B\u8981\u6539\u65F6\u957F\u3001\u753B\u5E45\u6216\u6E05\u6670\u5EA6\uFF0C\u5148\u56DE\u4E0A\u4E00\u6B65\u300C\u6539\u9700\u6C42\u300D\u3002${scriptDialog.writing ? ` \u6587\u672C\u6A21\u578B\u6B63\u5728\u5199\uFF1A\u5DF2\u7B49\u5F85 ${Math.max(0, Math.round((clock - (scriptDialog.writingSince || clock)) / 1e3))} \u79D2\uFF08\u4E00\u6B21\u901A\u5E38 30\u201390 \u79D2\uFF0C\u53EF\u4EE5\u5148\u53BB\u522B\u7684\u5730\u65B9\u770B\u770B\uFF09\u3002` : ""}`),
            scriptDialog.plan ? h("div", { key: "plan", className: "movc-plan" }, [
              h("div", { key: "head" }, `\u5206\u6BB5\u8BA1\u5212\uFF1A${scriptDialog.plan.segments.length} \u6BB5 \xB7 \u5171 ${scriptDialog.plan.totalSeconds} \u79D2${scriptDialog.plan.shots?.length ? ` \xB7 \u8BC6\u522B\u5230 ${scriptDialog.plan.shots.length} \u4E2A\u5206\u955C` : ""}`),
              ...scriptDialog.plan.segments.map((segment, index) => h("div", { key: `s${index}` }, `\u7B2C${index + 1}\u6BB5 ${segment.seconds} \u79D2\uFF08${segment.kind === "extend" ? "\u7EED\u62CD" : "\u9996\u6BB5"}\uFF09\uFF1A${String(segment.prompt).slice(0, 90)}${String(segment.prompt).length > 90 ? "\u2026" : ""}`))
            ]) : null,
            scriptDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, scriptDialog.error) : null,
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", disabled: scriptDialog.busy, onClick: () => setScriptDialog(null) }, "\u53D6\u6D88"),
              h("button", { key: "write", type: "button", className: "mov-btn", disabled: scriptDialog.busy, title: "\u7528\u8BBE\u7F6E\u9875\u91CC\u914D\u7F6E\u7684\u6587\u672C\u6A21\u578B\u628A\u9700\u6C42\u5199\u6210\u5267\u672C\u4E0E\u5206\u955C\u8868\uFF0C\u4F1A\u8C03\u7528\u4E00\u6B21\u6587\u672C\u6A21\u578B", onClick: () => void writeWithModel() }, scriptDialog.writing ? "\u6B63\u5728\u5199\u811A\u672C\u2026" : "AI \u5199\u811A\u672C"),
              h("button", { key: "preview", type: "button", className: "mov-btn", disabled: scriptDialog.busy, onClick: () => void previewScript() }, "\u9884\u89C8\u5206\u6BB5"),
              h("button", { key: "ok", type: "button", className: "mov-btn mov-btn-primary", disabled: scriptDialog.busy, onClick: () => void createFromScript() }, "\u751F\u6210\u5236\u4F5C\u8282\u70B9")
            ])
          ])
        ) : null,
        createDialog ? h(
          "div",
          { key: "create-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget) setCreateDialog(null);
          } },
          h("div", { key: "body", className: "movc-modal-body", style: { width: "min(420px, calc(100vw - 32px))" } }, [
            h("h4", { key: "h" }, "\u65B0\u5EFA\u753B\u5E03"),
            h("label", { key: "name", className: "movc-field" }, ["\u753B\u5E03\u540D\u79F0", h("input", {
              autoFocus: true,
              value: createDialog.value,
              placeholder: "\u753B\u5E03\u540D\u79F0",
              onChange: (e) => setCreateDialog({ ...createDialog, value: e.target.value, error: "" }),
              onKeyDown: (e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  void submitCreate();
                }
                if (e.key === "Escape") {
                  e.preventDefault();
                  setCreateDialog(null);
                }
              }
            })]),
            createDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, createDialog.error) : null,
            h("p", { key: "note", className: "movc-status" }, "\u65B0\u753B\u5E03\u662F\u4E00\u4EFD\u7A7A\u767D\u6587\u6863\uFF0C\u4E0E\u81EA\u52A8\u521B\u5EFA\u7684\u753B\u5E03\u5E76\u5B58\uFF1B\u540D\u79F0\u4E0D\u80FD\u4E3A\u7A7A\uFF0C\u4E5F\u4E0D\u80FD\u548C\u5DF2\u6709\u753B\u5E03\u91CD\u540D\u3002"),
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", onClick: () => setCreateDialog(null) }, "\u53D6\u6D88"),
              h("button", { key: "ok", type: "button", className: "mov-btn mov-btn-primary", onClick: () => void submitCreate() }, "\u65B0\u5EFA\u753B\u5E03")
            ])
          ])
        ) : null,
        selectedIds.length > 1 ? h("p", { key: "multi", className: "movc-hint" }, `\u5DF2\u9009\u4E2D ${selectedIds.length} \u4E2A\u8282\u70B9\uFF1A\u53EF\u6574\u7EC4\u62D6\u52A8\u6216\u5220\u9664\u3002`) : null,
        notice ? h("p", { key: "notice", className: "movc-hint" }, notice) : null,
        dialog ? h(
          "div",
          { key: "modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget) closeDialog();
          } },
          h("div", { key: "body", className: "movc-modal-body" }, [
            h("h4", { key: "h" }, dialogNode ? `${labelOf(dialogNode)} \xB7 ${dialog.stage === "job" ? "\u5236\u4F5C\u8BB0\u5F55\u4E0E\u7ED3\u679C\u5BA1\u6838" : dialog.type === "video" || dialog.type === "image" ? "\u5236\u4F5C\u4E0E\u8D39\u7528\u786E\u8BA4" : "\u7F16\u8F91\u8282\u70B9\u5185\u5BB9"}` : "\u6D41\u7A0B\u753B\u5E03"),
            formFields,
            planView,
            jobView,
            dialog.message ? h("p", { key: "msg", className: "movc-status", "data-error": "true" }, dialog.message) : null,
            h("p", { key: "note", className: "movc-status" }, "\u751F\u6210\u524D\u5FC5\u987B\u5206\u522B\u786E\u8BA4\u5236\u4F5C\u65B9\u6848\u4E0E\u8D39\u7528\uFF1B\u786E\u8BA4\u540E\u624D\u4F1A\u8C03\u7528\u6A21\u578B\u3002\u6210\u679C\u56DE\u586B\u53EA\u65B0\u589E\u6210\u679C\u8282\u70B9\uFF0C\u4E0D\u4EE3\u8868\u7ED3\u679C\u5DF2\u5BA1\u6838\u3002"),
            h("div", { key: "ops", className: "movc-bar" }, [
              dialog.stage === "edit" ? h("button", { key: "save", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: async () => {
                patchDialog({ busy: true, message: "" });
                try {
                  await saveNode(dialog.nodeId, { data: { text: dialog.form.text } });
                  closeDialog();
                } catch (e) {
                  patchDialog({ busy: false, message: e?.message || "\u4FDD\u5B58\u5931\u8D25" });
                }
              } }, "\u4FDD\u5B58\u5185\u5BB9") : null,
              dialog.stage === "form" ? h("button", { key: "gen", type: "button", className: "mov-btn mov-btn-primary", disabled: dialog.busy, onClick: () => void prepare("generate") }, "\u751F\u6210\u5E76\u786E\u8BA4\u8D39\u7528") : null,
              dialog.job?.reviewed && dialog.stage === "job" ? h("button", { key: "extend-form", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", plan: null }) }, "\u7EED\u62CD\u4E0B\u4E00\u6BB5") : null,
              dialog.stage === "form" && dialog.job?.reviewed ? h("button", { key: "extend", type: "button", className: "mov-btn mov-btn-primary", disabled: dialog.busy, onClick: () => void prepare("extend") }, "\u786E\u8BA4\u7EED\u62CD\u4E0E\u8D39\u7528") : null,
              dialog.stage === "plan" ? h("button", { key: "confirm", type: "button", className: "mov-btn mov-btn-primary", disabled: dialog.busy || !(dialog.confirm.plan && dialog.confirm.cost), onClick: () => void start() }, "\u786E\u8BA4\u5E76\u5F00\u59CB") : null,
              dialog.stage === "plan" ? h("button", { key: "back", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", plan: null }) }, "\u8FD4\u56DE\u4FEE\u6539") : null,
              h("button", { key: "close", type: "button", className: "mov-btn", onClick: () => closeDialog() }, "\u5173\u95ED")
            ]),
            dialog.stage === "plan" ? h("div", { key: "confirms" }, [
              h("label", { key: "p", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.confirm.plan === true, onChange: (e) => patchDialog({ confirm: { ...dialog.confirm, plan: e.target.checked } }) }), " \u6211\u5DF2\u6838\u5BF9\u672C\u6B21\u5236\u4F5C\u65B9\u6848\uFF08\u8282\u70B9\u5185\u5BB9\u3001\u753B\u5E45\u3001\u65F6\u957F\u4E0E\u6E05\u6670\u5EA6\uFF09"]),
              h("label", { key: "c", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.confirm.cost === true, onChange: (e) => patchDialog({ confirm: { ...dialog.confirm, cost: e.target.checked } }) }), " \u6211\u5DF2\u786E\u8BA4\u8D39\u7528\uFF0C\u6309\u6E20\u9053\u8D26\u5355\u7ED3\u7B97"]),
              dialog.plan?.kind === "video" && dialog.plan?.operation === "generate" && !(dialog.plan?.references || []).length ? h("label", { key: "t", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.confirm.textOnly === true, onChange: (e) => patchDialog({ confirm: { ...dialog.confirm, textOnly: e.target.checked } }) }), " \u672C\u6B21\u6CA1\u6709\u53C2\u8003\u7D20\u6750\uFF0C\u786E\u8BA4\u6309\u7EAF\u6587\u751F\u89C6\u9891\u63D0\u4EA4"]) : null
            ]) : null
          ])
        ) : null
      ]);
    }
    return { FlowCanvas };
  }

  // icon.svg
  var icon_default = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="MetaOnticVideo"><defs>\n<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#36e8ee"/><stop offset=".5" stop-color="#1688ff"/><stop offset="1" stop-color="#1742e8"/></linearGradient>\n<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#341ad5"/><stop offset=".5" stop-color="#7635ff"/><stop offset="1" stop-color="#176bff"/></linearGradient>\n<linearGradient id="c" x1="1" y1="0" x2="0" y2="1"><stop stop-color="#2ce7ef"/><stop offset=".5" stop-color="#087bff"/><stop offset="1" stop-color="#2026ba"/></linearGradient>\n<linearGradient id="d" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#24e5ec"/><stop offset=".45" stop-color="#1168ff"/><stop offset="1" stop-color="#2539d7"/></linearGradient>\n</defs>\n<path d="M9 25Q9 11 21 13L43 29 32 43 20 33V79Q20 85 14 85Q9 85 9 79Z" fill="url(#b)"/>\n<path d="M91 25Q91 11 79 13L43 39 57 53 80 35V78Q80 85 86 85Q91 85 91 79Z" fill="url(#c)"/>\n<path d="M10 23Q14 9 27 17L75 49Q79 52 75 56L43 77Q37 81 33 74L19 39Q15 27 10 23ZM40 40Q38 39 38 42V65Q38 68 41 66L59 54Q62 52 59 50Z" fill="url(#a)" fill-rule="evenodd"/>\n<path d="M75 49Q80 52 81 64L91 80Q89 88 82 84L62 70 43 77Q38 80 34 75Z" fill="url(#d)"/>\n<path d="M40 40Q38 39 38 42V65Q38 68 41 66L59 54Q62 52 59 50Z" fill="none"/>\n</svg>\n';

  // src/businesses/video/client.ts
  function createVideoClient(require2) {
    const React = require2("react");
    const h = React.createElement;
    const { TOKENS, inputStyle, PAGE_CSS } = createTheme();
    const { MediaPreview } = createMediaPreview({ React, h });
    const { videoExecutionSource: videoExecutionSource2, VideoTaskProgress, VideoProgressDock } = createVideoProgress({ React, h, TOKENS });
    const { ToolResultView } = createToolResultView({ h, MediaPreview, VideoTaskProgress });
    const { PLUGIN_OWNED_KEYS, SELECTS, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, NS, NAMESPACE } = createClientConfig();
    const { zh, en } = createDictionaries();
    const { useSnapshot, same, validateSettings, persistConnection, persistBatch } = createSettingsState({ React });
    const { PLUGIN_VERSION, UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2, UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE: PLUGIN_PACKAGE2, UPDATE_SPEC: UPDATE_SPEC2, UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2, isNewerVersion, updateBell } = createUpdates({ h });
    const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, PLUGIN_VERSION, UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2, UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE: PLUGIN_PACKAGE2, UPDATE_SPEC: UPDATE_SPEC2, UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2, isNewerVersion, updateBell, PAGE_CSS });
    return {
      inject: ["slots", "locale", "configForms", "uiSession"],
      apply(ctx, { settings }) {
        ctx.effect(() => ctx.uiSession.provide({
          hooks: ["videoExecutions"],
          resolve: (binding) => ({ hooks: { videoExecutions: videoExecutionSource2(binding.eventSource) } })
        }), "metaontic-video: actual video execution");
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "metaontic-video: dictionaries");
        ctx.effect(() => ctx.slots.inject("conversation.chat.node", () => registerAuthNotice(ctx, h, t)), "metaontic-video: friendly service authentication notice");
        const form = ctx.configForms.get(NAMESPACE);
        for (const tool of ["video_generate", "video_extend", "video_status", "video_prepare_image", "video_project", "video_estimate"]) {
          ctx.effect(
            () => ctx.slots.inject("tool.call.toolview", () => ctx.slots.register({ name: "tool.call.toolview", key: tool, locale: NS }, ToolResultView)),
            `metaontic-video: ${tool} progress`
          );
        }
        ctx.effect(() => ctx.slots.inject("conversation.input.dock", () => ctx.slots.register(
          { name: "conversation.input.dock", id: "metaontic-video-progress", order: -20 },
          VideoProgressDock
        )), "metaontic-video: visible video progress");
        const pluginManager = () => {
          const tried = [];
          const shape = (value) => value === void 0 ? "undefined" : value === null ? "null" : typeof value;
          try {
            const direct = typeof ctx.get === "function" ? ctx.get("remote.pluginManager") : void 0;
            if (direct && typeof direct.installBundle === "function") return { manager: direct, tried };
            tried.push(`remote.pluginManager=${shape(direct)}`);
          } catch (error) {
            tried.push(`remote.pluginManager \u629B\u9519\uFF1A${error && error.message ? error.message : String(error)}`);
          }
          try {
            const remote = typeof ctx.get === "function" ? ctx.get("remote") : void 0;
            const nested = remote && remote.pluginManager;
            if (nested && typeof nested.installBundle === "function") return { manager: nested, tried };
            tried.push(`remote=${shape(remote)}`);
          } catch (error) {
            tried.push(`remote \u629B\u9519\uFF1A${error && error.message ? error.message : String(error)}`);
          }
          return { manager: null, tried };
        };
        const Page = makePage({ form, t, manager: pluginManager });
        settings.register({ id: "video", namespace: NAMESPACE, locale: NS, Page });
        const { FlowCanvas: FlowCanvasPage } = createCanvasView({ React, h, TOKENS, PAGE_CSS });
        const { PanelIcon, VideoPanel } = createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID, GUIDE_URL, LOGO_SVG: icon_default });
        ensureUpdateHintStyles();
        const updateHint = createUpdateHint({ version: PLUGIN_VERSION, isNewerVersion, fetchRecentVersions, cacheKey: UPDATE_CACHE_KEY2, maxAge: UPDATE_MAX_AGE_MS2 });
        const { UpdateHintDot, UpdateHintBanner } = createUpdateHintView({
          React,
          h,
          t,
          hint: updateHint,
          version: PLUGIN_VERSION,
          isNewerVersion,
          manager: pluginManager,
          pluginPackage: PLUGIN_PACKAGE2,
          updateSpec: UPDATE_SPEC2,
          updateAttempts: UPDATE_ATTEMPTS2,
          cacheKey: UPDATE_CACHE_KEY2,
          maxAge: UPDATE_MAX_AGE_MS2
        });
        const railIcon = (props) => h(
          "span",
          { className: "mov-rail-hint" },
          [h(PanelIcon, props), h(UpdateHintDot, { key: "dot" })]
        );
        ctx.effect(() => {
          const off = ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
            name: "sidebar.panellist",
            id: PANEL_ID,
            order: 30,
            locale: NS,
            // 左侧那一行显示的名字，比面板标题更完整，方便在图标列表里认出来；有更新只加红点，不改文字。
            label: () => t("panelSidebarLabel")
          }, railIcon));
          void updateHint.refresh(false);
          return () => off?.();
        }, "metaontic-video: sidebar entry");
        ctx.effect(() => ctx.slots.inject("main", () => ctx.slots.register({
          name: "main",
          key: PANEL_ID,
          locale: NS,
          // 面板要的两个动作都按需取服务：老宿主没有这些服务时按钮自然失效，不报错。
          inject: () => ({
            startSession: () => ctx.get("uiWorkspace")?.startSession(void 0, { agentPreset: "video-director" }),
            openSettings: () => ctx.get("pluginNavigation")?.openBundle(NAMESPACE),
            manager: pluginManager,
            // 面板顶部的更新入口：与设置页同一套两步确认，点左侧栏的「有更新」进来就能更新。
            updateBanner: () => h(UpdateHintBanner, { key: "update-hint" })
          })
        }, VideoPanel)), "metaontic-video: sidebar panel");
        const canvasSwitchOn = () => {
          try {
            return form?.getSnapshot?.()?.value?.canvasEnabled === true;
          } catch {
            return false;
          }
        };
        const canvasSlots = [
          () => ctx.slots.inject("sidebar.panellist", () => ctx.slots.register({
            name: "sidebar.panellist",
            id: CANVAS_PANEL_ID,
            order: 31,
            locale: NS,
            label: () => t("canvasPanelLabel")
            // 更新入口在视频创作面板顶部，画布这一行不加圆点：点了也看不到更新，会误导。
          }, PanelIcon)),
          () => ctx.slots.inject("main", () => ctx.slots.register({
            name: "main",
            key: CANVAS_PANEL_ID,
            locale: NS
          }, FlowCanvasPage))
        ];
        ctx.effect(() => {
          let active = false;
          let disposers = [];
          const close = () => {
            for (const off of disposers) off();
            disposers = [];
            active = false;
          };
          const sync = () => {
            const wanted = canvasSwitchOn();
            if (wanted === active) return;
            if (!wanted) {
              close();
              return;
            }
            disposers = canvasSlots.map((register) => register()).filter((off) => typeof off === "function");
            active = true;
          };
          sync();
          let unsubscribe;
          try {
            unsubscribe = form?.subscribe?.(sync);
          } catch {
            unsubscribe = void 0;
          }
          return () => {
            if (typeof unsubscribe === "function") unsubscribe();
            close();
          };
        }, "metaontic-video: canvas entry follows the canvas switch");
      }
    };
  }

  // src/client.ts
  window.__ModuleLoader__.load({
    id: PLUGIN_ID,
    factory: (require2) => createClientRuntime(require2, [{ id: "video", create: createVideoClient }])
  });
})();
