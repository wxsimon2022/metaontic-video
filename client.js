(() => {
  // src/platform/settings/client.ts
  function createSettingsPages(h, decorate = (Page) => Page) {
    const pages = /* @__PURE__ */ new Map();
    return {
      register(page) {
        const group = pages.get(page.namespace) || [];
        if (group.some((existing) => existing.id === page.id)) throw new Error(`重复的设置页：${page.id}`);
        group.push(page);
        pages.set(page.namespace, group);
      },
      mount(ctx) {
        for (const [namespace, group] of pages) {
          const Content = group.length === 1 ? group[0].Page : (props) => h("div", {}, ...group.map((page) => h(page.Page, { ...props, key: page.id })));
          const Page = decorate(Content);
          ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({
            name: "plugins.bundle.config",
            key: namespace,
            locale: group[0].locale
          }, Page)), `${namespace}: configuration page`);
        }
      }
    };
  }

  // src/app/composition/client.composer.ts
  function createClientRuntime(require2, modules) {
    const ids = /* @__PURE__ */ new Set();
    const plugins = modules.map((module) => {
      if (!module.id || ids.has(module.id)) throw new Error(`重复或无效的界面模块：${module.id}`);
      ids.add(module.id);
      return module.create(require2);
    });
    return {
      inject: [...new Set(plugins.flatMap((plugin) => plugin.inject || []))],
      apply(ctx, options = {}) {
        const settings = createSettingsPages(require2("react").createElement, options.decorateSettings);
        for (const plugin of plugins) plugin.apply(ctx, { settings });
        settings.mount(ctx);
      }
    };
  }

  // src/shared/constants/plugin.ts
  var PLUGIN_ID = "metaontic-video";
  var PLUGIN_PACKAGE = "dsh-metaontic-video";
  var PLUGIN_NAMESPACE = PLUGIN_ID;
  var PANEL_ID = PLUGIN_ID;
  var FLOW_CANVAS_AVAILABLE = false;
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
    signupUrl: 'https://ai.bileego.com/sign-up?aff=VzYr',
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

  // src/ui/components/support-action.ts
  function createSupportAction({ React, t, PAGE_CSS }) {
    const h = React.createElement;
    return function SupportAction({ subject }) {
      const [open, setOpen] = React.useState(false);
      const dialog = React.useRef(null);
      const ownBundle = subject?.kind === "bundle" && subject.pkg?.name === PLUGIN_PACKAGE;
      React.useEffect(() => {
        setOpen(false);
      }, [ownBundle]);
      React.useEffect(() => {
        if (open && dialog.current && !dialog.current.open) dialog.current.showModal();
      }, [open]);
      if (!ownBundle) return null;
      return h(
        React.Fragment,
        null,
        h("style", null, PAGE_CSS),
        h("button", {
          type: "button",
          className: "mov-btn mov-btn-sm",
          "data-action": "contact-support",
          style: { alignSelf: "center", whiteSpace: "nowrap" },
          "aria-haspopup": "dialog",
          "aria-expanded": open,
          onClick: () => setOpen(true)
        }, t("supportContact")),
        open ? h("dialog", {
          ref: dialog,
          className: "mov-support-dialog",
          "aria-labelledby": "mov-support-title",
          onCancel: () => setOpen(false),
          onClose: () => setOpen(false),
          onClick: (event) => {
            if (event.target === event.currentTarget) {
              const rect = event.currentTarget.getBoundingClientRect();
              if (event.clientX < rect.left || event.clientX > rect.right || event.clientY < rect.top || event.clientY > rect.bottom) setOpen(false);
            }
          }
        }, h(
          "div",
          { className: "mov-support-content" },
          h(
            "div",
            { className: "mov-card-head" },
            h("strong", { id: "mov-support-title" }, t("supportContact")),
            h("button", { type: "button", className: "mov-btn mov-btn-sm mov-trailing", "aria-label": t("supportClose"), onClick: () => setOpen(false) }, t("supportClose"))
          ),
          h("p", { className: "mov-hint" }, t("supportScan")),
          h("iframe", { className: "mov-support-frame", title: t("supportContact"), src: SUPPORT_URL, referrerPolicy: "no-referrer" }),
          h("a", { href: SUPPORT_URL, target: "_blank", rel: "noopener noreferrer" }, t("supportOpenPage"))
        )) : null
      );
    };
  }

  // src/ui/components/auth-notice.ts
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

  // src/businesses/video-generation/client/tool-result.ts
  var SUMMARY_TOOLS = { video_project: "脚本审核", video_estimate: "费用试算" };
  var ACTION_LABELS = { prepare: "准备项目", review: "脚本审核", review_segment: "分段结果审核", status: "读取项目状态" };
  var STATUS_LABELS = { approved: "已通过", draft: "待修改", pending: "待确认", blocked: "未通过校验", running: "进行中" };
  var CANVAS_SYNC_LABELS = { synced: "已同步", pending: "待补传（用video_canvas补传，不重新生成）", unavailable: "暂不可用", external: "沿用所选画布" };
  var textOf = (block) => (Array.isArray(block?.content) ? block.content : []).filter((part) => part?.type === "text").map((part) => String(part.text || "")).join("\n").trim();
  var money = (value) => Number.isFinite(Number(value)) ? `¥${(Math.round(Number(value) * 1e4) / 1e4).toFixed(4)}` : "";
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
      if (args.action) rows2.push(["动作", ACTION_LABELS[String(args.action)] || String(args.action)]);
      if (args.duration) rows2.push(["目标时长", `${Number(args.duration)} 秒`]);
      if (args.resolution) rows2.push(["清晰度", String(args.resolution).toUpperCase()]);
      return { title, state: "running", stateLabel: "进行中", rows: rows2, raw: "" };
    }
    if (block.isError) return { title, state: "error", stateLabel: "未完成", rows: [], raw };
    const data = parseJson(raw);
    if (!data) return { title, state: "done", stateLabel: "已完成", rows: [], raw };
    const rows = [];
    const push = (label, value) => {
      if (value !== void 0 && value !== null && String(value) !== "") rows.push([label, String(value)]);
    };
    if (toolName === "video_estimate") {
      push("目标时长", data.duration ? `${data.duration} 秒` : "");
      push("画幅 / 清晰度", [data.ratio, data.resolution && String(data.resolution).toUpperCase()].filter(Boolean).join(" · "));
      push("火山官方方案", money(data.official?.cny));
      push("插件方案", money(data.plugin?.cny));
      push("价目日期", data.priceDate);
      return { title, state: "ok", stateLabel: "已试算", rows, raw };
    }
    push("状态", STATUS_LABELS[String(data.status)] || data.status);
    push("项目", data.projectId);
    push("下一步", data.nextAction);
    push("说明", data.reason);
    const canvasSync = String(data.canvasProject?.status || "");
    if (canvasSync && canvasSync !== "disabled") push("画布同步", CANVAS_SYNC_LABELS[canvasSync] || canvasSync);
    const state = data.status === "approved" ? "ok" : ["draft", "blocked"].includes(String(data.status)) ? "warn" : "done";
    return { title, state, stateLabel: STATUS_LABELS[String(data.status)] || "已完成", rows, raw };
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
          h("summary", { key: "label" }, "查看完整返回"),
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

  // src/businesses/video-generation/client/media-preview.ts
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
      media.push({ kind, label: match[1] || (kind === "image" ? "图片" : "视频"), ...url ? { url } : { localPath: file } });
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
      const label = String(item.label || (item.kind === "image" ? "图片" : "视频"));
      const media = !source || failed ? h("p", { role: "status", className: "mov-media-error" }, item.kind === "image" ? "图片预览无法加载，文件可能已移动或链接已过期。请尝试打开原图。" : "视频预览无法播放，可能是文件已移动、链接已过期或编码不受支持。请尝试打开原视频或下载后播放。") : item.kind === "image" ? h("button", { type: "button", className: "mov-media-image-button", onClick: () => setZoom(true), "aria-label": `放大${label}` }, h("img", { src: source, alt: label, loading: "lazy", onError: error, className: "mov-media-image", referrerPolicy: "no-referrer" })) : h("video", { key: source, src: source, controls: true, playsInline: true, preload: "metadata", onError: error, className: "mov-media-video", "aria-label": label, referrerPolicy: "no-referrer" });
      return h("figure", { className: "mov-media-item", "data-media-kind": item.kind }, [
        h("figcaption", { key: "caption", className: "mov-media-caption" }, label),
        h("div", { key: "body", className: "mov-media-surface" }, media),
        sources.length ? h("div", { key: "links", className: "mov-media-links" }, [
          h("a", { key: "open", href: source || sources[0], target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, item.kind === "image" ? "打开原图" : "打开原视频"),
          item.localPath && remoteMediaUrl(item.url) ? h("a", { key: "remote", href: remoteMediaUrl(item.url), target: "_blank", rel: "noopener noreferrer", referrerPolicy: "no-referrer" }, "上游链接") : null
        ]) : null,
        zoom && item.kind === "image" ? h("dialog", { key: "zoom", ref: dialog, className: "mov-media-dialog", "aria-label": label, onCancel: () => setZoom(false), onClose: () => setZoom(false), onClick: (e) => {
          if (e.target === e.currentTarget) setZoom(false);
        } }, [
          h("button", { key: "close", type: "button", className: "mov-media-close", onClick: () => {
            dialog.current?.close();
            setZoom(false);
          }, "aria-label": "关闭图片预览" }, "关闭"),
          h("img", { key: "image", src: source, alt: label, className: "mov-media-zoom", referrerPolicy: "no-referrer", onError: error })
        ]) : null
      ]);
    }
    function MediaPreview({ block, toolName }) {
      const items = previewMediaFromBlock(block, toolName);
      const [expanded, setExpanded] = React.useState(false);
      if (!items.length) return null;
      const visible = expanded ? items : items.slice(0, 2);
      return h("section", { className: "mov-media-preview", "aria-label": "生成结果预览", "data-field": "media-preview" }, [
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
        items.length > 2 ? h("button", { key: "more", type: "button", className: "mov-media-more", onClick: () => setExpanded(!expanded), "aria-expanded": expanded }, expanded ? "收起其他成果" : `展开其他成果（${items.length - 2}）`) : null
      ]);
    }
    return { MediaPreview };
  }

  // src/ui/components/theme.ts
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
      /* 仅收紧包含本插件设置的宿主详情区，不依赖宿主生成的 CSS 类名。 */
      div:has(> section[data-plugin-config] .mov-page) { margin-top: 12px; gap: 16px; }
      /* 整页纵向排布：块与块之间统一 16px，比一整片表单好扫 */
      .mov-page { display: flex; flex-direction: column; gap: 16px; padding: 0; color: ${TOKENS.text}; }
      /* 分组卡片：16 个字段摊在一格里太糊，按用途各装一张卡 */
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
      /* 标题左边一道主色竖条，代替纯文字分组标题 */
      .mov-section-title::before { content: ""; flex: 0 0 auto; width: 3px; height: 13px; border-radius: 2px; background: ${TOKENS.primaryFill}; }
      .mov-section-title::after { content: ""; flex: 1 1 auto; height: 1px; background: ${TOKENS.border}; }
      /* 两列自适应：单列至少 240px，窄面板自动落成一列 */
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

      /* 开关没有标签行，靠底对齐才能跟旁边输入框的控制线齐平 */
      .mov-field-switch { justify-content: flex-end; }
      .mov-field-wide { grid-column: 1 / -1; }
      .mov-label { display: block; font-size: 12px; color: ${TOKENS.muted}; margin-bottom: 6px; }
      .mov-input { padding: 8px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; color: ${TOKENS.text}; font: inherit; font-size: 13px; height: 36px; }
      .mov-key-control { display: flex; align-items: center; gap: 6px; min-width: 0; }
      .mov-key-control .mov-input { flex: 1 1 0; width: 0; min-width: 0; }
      .mov-key-eye { display: inline-flex; align-items: center; justify-content: center; flex: 0 0 32px; height: 36px; padding: 0; border: 0; border-radius: 6px; color: ${TOKENS.muted}; background: transparent; cursor: pointer; }
      .mov-key-eye:hover { color: ${TOKENS.text}; background: ${TOKENS.controlFill}; }
      .mov-key-eye:focus-visible { outline: 2px solid currentColor; outline-offset: 2px; }
      .mov-key-verify { flex: 0 0 auto; height: 36px; white-space: nowrap; }
      .mov-input:focus, .mov-input:focus-visible { outline: none; border-color: ${TOKENS.primaryFill}; box-shadow: 0 0 0 3px rgba(36, 123, 191, .18); }
      /* 模型 ID 与可执行文件路径很长：等宽字体 + 省略，不把整行撑变形 */
      .mov-mono { font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12.5px; }
      /* 开关做成跟输入框同高的小方块，和周围控件一条线 */
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
      /* 额度：三个数字块，一眼分清剩余 / 已用 / 总额度 */
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
      /* ffmpeg 安装命令：一行等宽、可复制，不用撑满整行 */
      .mov-cmd-row { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      .mov-tag { flex: 0 0 auto; min-width: 132px; font-size: 12px; color: ${TOKENS.muted}; }
      .mov-code { flex: 0 0 auto; max-width: 100%; padding: 6px 10px; border-radius: 8px; border: 1px solid ${TOKENS.border}; background: ${TOKENS.controlFill}; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; font-size: 12px; white-space: pre-wrap; word-break: break-all; }
      /* 使用记录：斑马纹 + 细表头，模型列吃掉剩余宽度 */
      /* 面板很窄时表格横向滚动，也不把「时间」挤成两行 */
      .mov-table { display: flex; flex-direction: column; margin: 0 -6px; overflow-x: auto; }
      .mov-table-head, .mov-table-row { display: grid; grid-template-columns: 106px 78px minmax(72px, 1fr) 84px 60px; align-items: center; gap: 10px; padding: 8px 10px; }
      .mov-table-head > :nth-child(1), .mov-table-row > :nth-child(1) { white-space: nowrap; }
      .mov-table-head { font-size: 11px; letter-spacing: .03em; color: ${TOKENS.muted}; border-bottom: 1px solid ${TOKENS.border}; }
      .mov-table-row { font-size: 12.5px; border-radius: 8px; }
      .mov-table-row:nth-child(even) { background: rgba(127, 127, 127, .05); }
      .mov-table-row:hover { background: rgba(127, 127, 127, .1); }
      /* 费用与结果两列右对齐，数字竖着对得齐 */
      .mov-table-head > :nth-child(4), .mov-table-row > :nth-child(4),
      .mov-table-head > :nth-child(5), .mov-table-row > :nth-child(5) { text-align: right; }
      .mov-model { min-width: 0; overflow: hidden; color: ${TOKENS.muted}; white-space: nowrap; text-overflow: ellipsis; font-family: ui-monospace, SFMono-Regular, "SF Mono", Menlo, Consolas, monospace; }
      .mov-num { font-variant-numeric: tabular-nums; }
      /* 结果用胶囊标签，比裸文字更容易一眼扫到 */
      .mov-chip { display: inline-flex; align-items: center; justify-content: center; padding: 1px 8px; border-radius: 999px; font-size: 11.5px; line-height: 1.7; }
      .mov-chip-ok { color: ${TOKENS.success}; background: rgba(46, 158, 91, .12); }
      .mov-chip-bad { color: ${TOKENS.error}; background: rgba(217, 83, 79, .12); }
      /* 注册表单：输入框吃掉多余宽度，两个按钮不换行 */
      .mov-register-form { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; }
      /* 底部操作条：上边线把「保存」和配置内容分开 */
      .mov-footer { display: flex; align-items: center; gap: 10px; flex-wrap: wrap; padding: 12px 2px 2px; border-top: 1px solid ${TOKENS.border}; }
      .mov-notice { margin: 0; font-size: 12px; color: ${TOKENS.muted}; line-height: 1.5; }
    `;
    return { TOKENS, inputStyle, PAGE_CSS };
  }

  // src/businesses/video-generation/client/progress.ts
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
      const status = "正在生成 · 等待结果";
      const duration = block.args?.duration;
      const estimatedWait = estimatedVideoWait(duration);
      const progress = estimatedVideoProgress(elapsed, duration);
      const waitingDots = ".".repeat(elapsed % 3 + 1);
      const title = toolName === "video_extend" ? "视频续拍" : "视频生成";
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
          h("span", { key: "elapsed", style: { marginLeft: "auto", fontVariantNumeric: "tabular-nums" } }, `已等待 ${Math.floor(elapsed / 60)}分${String(elapsed % 60).padStart(2, "0")}秒`)
        ]),
        h("div", { key: "progress", className: "mov-task-rail" }, [
          h("div", { className: "mov-task-track mov-task-active", role: "progressbar", "aria-label": "估算进度", "aria-valuemin": 0, "aria-valuemax": 100, "aria-valuenow": progress }, h("div", { className: "mov-task-fill", style: { width: `${progress}%` } })),
          // 装饰用的小乌龟：跟着进度条填充的右端一起从左往右爬，只表示「还在忙」，不代表真实进度；屏幕阅读器不读它。
          h("span", { key: "turtle", className: "mov-task-turtle", style: { left: `${progress}%` }, "aria-hidden": true }, "🐢")
        ]),
        h("div", { key: "percent", className: "mov-task-note" }, `${progress}% · 估算进度`),
        h("div", { key: "note", className: "mov-task-note" }, [
          h("span", { key: "live", className: "mov-task-live", "aria-hidden": true }),
          `${duration ? `目标 ${duration} 秒 · 预计等待约 ${Math.round(estimatedWait)} 秒 · ` : ""}${progress >= 99 ? "任务仍在等待结果，进度停在99%不表示失败。" : "任务处理中，完成后自动显示结果。"}请勿重复提交。`
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

  // src/businesses/video-generation/connection-defaults.ts
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

  // src/businesses/video-generation/client/config.ts
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
      ...FLOW_CANVAS_AVAILABLE ? [{ key: "sectionCanvas", fields: ["canvasEnabled", "autoCreateCanvas"] }] : []
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

  // src/businesses/video-generation/client/locale.ts
  function createDictionaries() {
    const zh = {
      connectionCheckTitle: "API 连接验证",
      connectionCheckButton: "验证连接",
      connectionChecking: "正在验证…",
      connectionCheckSaveFirst: "有未保存的修改，请先保存后验证。",
      connectionCheckHint: "检查已保存的接口、鉴权响应和模型清单，不提交生成任务、不产生模型生成费用；通过不代表实际生成效果已验证。",
      connectionCheckFailed: "验证未完成，请确认插件服务可用后重试。",
      connectionTarget_video: "视频模型",
      connectionTarget_image: "图片模型",
      connectionTarget_text: "文本模型",
      connectionResult_ok: "鉴权接口响应正常，当前模型已列出。",
      connectionResult_model_not_listed: "接口响应正常，但当前模型未列出，请核对模型名称与使用权限。",
      connectionResult_key_missing: "未填写此模型实际使用的 API密钥，请填写并保存。",
      connectionResult_invalid_address: "接口地址格式不正确，请检查已保存的地址。",
      connectionResult_auth_failed: "鉴权未通过（401），请核对 API密钥及接口地址。",
      connectionResult_forbidden: "只读验证接口被拒绝（403），尚不能据此判断生成权限，请核对渠道接口限制。",
      connectionResult_auth_reachable: "密钥鉴权正常；渠道限制了模型清单查询，当前模型生成权限尚未验证。",
      connectionResult_models_unsupported: "服务未提供模型查询接口，无法仅靠只读请求确认可用性。",
      connectionResult_rate_limited: "请求受限（429），请稍后重试并核对渠道限制。",
      connectionResult_server_error: "上游接口异常，请核对地址或稍后重试。",
      connectionResult_invalid_response: "返回内容不是预期的模型清单，请检查接口地址。",
      connectionResult_api_rejected: "上游拒绝了验证请求，请核对 API密钥和地址。",
      connectionResult_timeout: "连接超时，请检查网络和接口地址后重试。",
      connectionResult_network_error: "无法连接接口，请检查网络、证书或接口地址。",
      connectionResult_query_reachable: "查询接口已响应；只读探测尚不能确认当前模型的生成权限。",
      connectionResult_query_unverified: "只读查询未能确认连接，请核对火山接口配置及权限。",
      summaryEmpty: "请选择接入方式，填写 API密钥后保存。",
      panelTitle: "视频创作",
      panelSidebarLabel: "视频创作助手",
      sidebarUpdateBadge: "有更新",
      panelIntro: "在对话里说清创意、时长与画幅，脚本、分镜、生成和本机合并都由插件完成。",
      panelStart: "开始创作",
      panelNew: "新建视频创作会话",
      panelSettings: "打开插件设置",
      panelGuide: "使用说明",
      panelHighlights: "为什么用它",
      panelHighlight1Title: "新手也能上手",
      panelHighlight1Desc: "不用研究提示词：说清创意、时长和画幅就能开始，脚本、分镜、生成和本机合并都由助手完成。",
      panelHighlight2Title: "分段制作长视频",
      panelHighlight2Desc: "超过单段上限时分段续拍，每段预览确认后继续，全部完成后在本机合并。",
      panelFlow: "使用流程",
      panelStep1Title: "说清创意",
      panelStep1Desc: "主题、时长、画幅（16:9 / 9:16）与清晰度；没写画幅时助手会先问。",
      panelStep2Title: "脚本分镜",
      panelStep2Desc: "先出脚本与分镜，你审核确认后再继续。",
      panelStep3Title: "逐段生成",
      panelStep3Desc: "确认费用后生成；分段预览确认后继续下一段，支持断点续做。",
      panelStep4Title: "本机合并",
      panelStep4Desc: "分段生成的结果在本机合并成片，可逐段预览。",
      summary: "{provider} · {model}",
      apiKeyConfigured: "已配置，留空保留现有 API密钥",
      connectionMode: "接入方式",
      connectionModeHint: "使用自己的 MetaOntic AI API密钥。切换后保存生效。",
      connectionVolcengineUnavailable: "火山引擎直连当前暂不提供选择：已有的配置仍可继续生成；如需更换，请在「接入方式」里选择 MetaOntic AI。",
      connectionMetaonticHint: "使用 MetaOntic AI 的 API密钥，填写后保存生效。",
      connectionMetaonticRegister: "注册获取 API密钥",
      volcengineKeyHint: "填写火山方舟控制台的 API密钥后保存，费用由火山引擎账户承担。需要自行核对好 API密钥的模型能力。",
      metaontic: "MetaOntic AI",
      metaonticApiKey: "MetaOntic AI API密钥",
      showKey: "显示 API密钥",
      hideKey: "隐藏 API密钥",
      metaonticKeyHint: "填写 API密钥后保存，无需邮箱登录。按实际调用计费，费用与用量请在渠道平台查看。",
      volcengineApiKey: "火山引擎 API密钥",
      volcengine: "火山引擎直连",
      volcengineUnavailable: "火山引擎直连（暂不提供选择）",
      seamTrimSeconds: "接缝裁剪秒数（如 0.5,0）",
      modelHiddenCurrent: "当前模型（暂不提供选择）",
      releaseNotesTitle: "更新内容",
      releaseUpdatedAt: "{time}",
      resetConfirm: "确定重置插件吗？这会清除本插件保存的配置和API密钥，需要重新配置。已生成的视频不会删除。",
      model: "视频模型",
      imageModel: "图片模型",
      textModel: "文本模型（写脚本）",
      imageUseVideoKey: "视频 / 图片 / 文本模型共用 API密钥",
      sharedModelKey: "共用 API密钥",
      videoModelKey: "视频模型 API密钥",
      imageApiKey: "图片模型 API密钥",
      textApiKey: "文本模型 API密钥",
      resolution: "视频清晰度",
      imageModelHint: "Seedream可生成角色图；遇真人限制时，经同意可转换参考图。图片调用单独计费，结果需审核。",
      textModelHint: "保留配置：流程画布暂隐藏，对话写脚本使用Harness会话模型。原画布「创作流程」里用这个型号把一段想法写成剧本与分镜表；走同一中转站的 /v1/chat/completions，单独按文本计费。候选与中转站在售的文本模型一致，旧的默认型号已下线，读到会自动换成默认项。",
      modelHint: "mini 侧重成本，fast 侧重生成速度。实际价格以所选渠道为准。",
      mergeMode: "合并方式",
      mergeModeSeamless: "直接拼接（旧配置兼容）",
      mergeModeCopy: "无损拼接",
      mergeModeReencode: "重编码拼接",
      ffmpegBinary: "ffmpeg 路径",
      ffprobeBinary: "ffprobe 路径",
      ffmpegTitle: "长视频合并需要 ffmpeg",
      ffmpegBody: "视频超过模型单次上限（2.0 为 15 秒、2.5 为 30 秒）时会拆成几段分别生成、再在本机合并成一条——合并这一步用的是 ffmpeg。默认合并前会检查是否安装；明确选择只生成分段时可不合并。",
      ffmpegInstallFor: "按你的系统装一下（点右边按钮复制命令）：",
      ffmpegCopy: "复制",
      ffmpegCopied: "已复制",
      ffmpegMore: "其他系统",
      ffmpegLess: "收起其他系统",
      ffmpegAfter: "不想自己敲命令的话，直接在对话里说「帮我装 ffmpeg」——插件会执行安装（命令会先让你确认）；装好后用原暂停进度重试下载或合并，不重新提交视频生成。ffmpeg 装在非默认位置的话，把绝对路径填到上面的「ffmpeg 路径」也一样管用。安装包自带 ffprobe，分段时长探测会一起解决。",
      ffmpegManual: "想自己装：macOS 用 Homebrew，Windows 用 winget，Linux 用系统包管理器；装完确认命令行里能跑 ffmpeg -version 就行。",
      supportContact: "客服",
      advancedStats: "使用统计",
      usageStatsEnabled: "匿名使用统计",
      usageStatsHint: "用于统计首次启用、启动和功能使用情况，仅上报匿名标识、版本、基础设备信息与调用结果，不含对话、素材或API密钥。关闭不影响视频创作。",
      toolArgsNoticeTitle: "这一轮助手把工具参数写成了不合法的 JSON",
      toolArgsNoticeHint: "多半是 480p、16:9 这类值少了引号，本轮没有真正调用工具、也没有产生费用；回一句「按原参数重试」即可，助手会补齐引号按原来的清晰度、画幅和时长重发。",
      authNoticeTitle: "服务连接验证未通过",
      authNoticeHint: "请到 Harness 的模型设置检查当前 API密钥和中转地址；如果配置无误，请联系客服核查。",
      supportClose: "关闭",
      supportScan: "请按页面提示使用微信联系客服，咨询使用或接入问题。页面未加载时可点击下方链接。",
      supportOpenPage: "打开客服页面",
      versionTitle: "插件版本",
      versionCurrent: "当前版本 v{version}",
      versionCheck: "检查更新",
      versionChecking: "检查中…",
      versionLatest: "已是最新版本",
      versionNew: "有新版本 v{version}",
      versionFailed: "检查更新失败：{message}",
      versionUpdate: "立即更新",
      versionOptional: "这是普通更新，你可以自行决定是否升级。稍后处理不影响继续使用，插件不会自动安装。",
      versionLater: "稍后再说",
      versionUpdateConfirm: "确认更新到 v{version}",
      versionUpdateConfirmHint: "更新期间设置页可能短暂关闭，现有配置与 API密钥会保留。",
      versionUpdating: "更新中…",
      versionUpdateDone: "已更新到 v{version}，已通过热加载生效，无需重启。现有对话下一轮使用最新插件规则。",
      versionUpdatePending: "v{version} 已安装，当前配置尚未启用新版，请在插件页检查启用状态。",
      versionUpdateRestart: "新版本 v{version} 已装好：重启 Harness 后生效。",
      versionUpdateCancelled: "更新已取消。",
      versionUpdateRetry: "更新未完成，正在重试（{attempt}/{total}）…",
      versionUpdateFailed: "在线更新失败：{message}",
      versionUpdateRemoved: "未能确认插件安装状态，请到「插件」页检查；保留现有配置，不要直接卸载。",
      versionUpdateRateLimited: "Gitee 请求过于频繁，请稍后重试。现有配置与 API密钥会保留。",
      versionUpdateLockfile: "安装目录的 pnpm-lock.yaml 里有本插件缺少 integrity 的旧记录，pnpm 因此拒绝安装（ERR_PNPM_MISSING_TARBALL_INTEGRITY）。插件会每 2 秒检查一次、自动清理这些无效记录并保留备份，更新失败后也会等清理完成自动重试；若仍然失败，完全退出 Harness 后手动删除插件安装目录下的 pnpm-lock.yaml 再试。",
      versionUpdateUnavailable: "当前 Harness 不支持此在线更新入口，请保留现有插件与配置，参考使用说明通过正式版成品包更新。",
      versionHint: "可在此检查并安装新版本，现有配置与 API密钥会保留。",
      versionCheckedAt: "检查于 {time}",
      sectionGeneration: "生成参数",
      sectionConnection: "接入与 API密钥",
      sectionVideo: "画面与声音",
      sectionCanvas: "流程画布",
      canvasPanelLabel: "MetaOnticVideo流程画布",
      canvasEnabled: "流程画布",
      canvasEnabledHint: "默认关闭：关闭时左侧栏不出现「MetaOnticVideo流程画布」入口，画布不可用；已有画布与成果仍保留在插件数据目录，重新打开就能继续。开启后左侧栏出现流程画布入口，可用独立画布页创作。流程画布是本插件自带组件，不需要安装其他画布插件。",
      autoCreateCanvas: "自动创建画布",
      autoCreateCanvasHint: "流程画布打开后有效，默认开启：创作时自动建图，审核前同步剧本、分镜和制作计划，生成后回填成果；关闭后不自动建图，仅在画布内明确选中节点时联动。",
      sectionModels: "模型配置",
      sectionCombined: "更多设置",
      advancedPicture: "画面",
      advancedMerge: "视频合并",
      advancedWait: "查询与等待",
      advancedTools: "本地工具",
      sectionCombinedHint: "画面 · 合并 · 等待 · 本地工具",
      toolsHint: "通常无需填写；已安装但无法自动识别时，可指定可执行文件路径。",
      segmentsRetained: "所有原始分段自动保留，便于预览、续做和重新剪辑。",
      ratio: "画面比例",
      audioSettings: "声音设置",
      ratioLayoutHint: "选择横屏、竖屏或自动适配画面。",
      audioLayoutHint: "对白、音乐与环境声按脚本安排。",
      generateAudio: "生成音频",
      watermark: "添加水印",
      pollIntervalMs: "状态查询间隔（秒）",
      maxWaitMs: "单个任务最长等待时间（秒）",
      save: "保存",
      reset: "重置插件",
      resetHint: "清除本机保存的 API密钥与自定义设置，恢复默认配置。",
      saving: "保存中…",
      saved: "设置已保存，配置重新加载后生效。",
      saveFailed: "保存失败，请检查设置后重试。",
      dirty: "有未保存的改动",
      loading: "读取配置中…",
      unavailable: "暂时无法加载插件设置，请重启 Harness 后重试；若仍无法加载，请检查 Harness 与插件的版本是否兼容。",
      readOnly: "当前配置为只读，无法保存修改。",
      seamTrimSecondsHint: "分别裁剪第 2、3…段开头，例如 0.5,0。留空使用模型默认值，填 0 关闭；每项为 0–3 秒。",
      waitSecondsHint: "至少 1 秒，支持小数。最长等待时间不得小于查询间隔。",
      versionHistory: "历史更新",
      versionCheckFirst: "请先检查并选择可用的正式版本，再确认安装。",
      unknownConnection: "未知接入方式，请重新选择。",
      atomicUnsupported: "当前 Harness 不支持批量保存，请更新 Harness 后重试。",
      atomicRejected: "软件未接受本次保存，输入已保留。请重新打开设置页核对后重试。",
      settingsUnavailable: "设置页正在加载或已更新，输入已保留。请重新打开设置页后重试。",
      settingsConflict: "配置同时被其他操作修改，输入已保留。请核对最新设置后重试。",
      settingsTransport: "保存连接中断，结果尚未确认。输入已保留，请重新打开设置页核对后再保存。",
      invalidWait: "等待时间须为至少 1 秒的有效数值，且最长等待时间不得小于查询间隔。",
      invalidSeam: "接缝裁剪须为逗号分隔的 0–3 秒数值，例如 0.5,0。",
      resetDone: "已清除本机配置，恢复默认设置。",
      resetFailed: "重置失败：{message}"
    };
    const en = {
      connectionCheckTitle: "API connection check",
      connectionCheckButton: "Check connection",
      connectionChecking: "Checking…",
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
      connectionResult_forbidden: "Read-only check denied (403). Generation permissions remain unverified; check provider endpoint restrictions.",
      connectionResult_auth_reachable: "Key authentication responded successfully; model listing is restricted. Generation permissions remain unverified.",
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
      summary: "{provider} · {model}",
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
      textModelHint: "Retained configuration: the workflow canvas is temporarily hidden; chat scripting uses the Harness session model. Previously used inside the canvas flow panel to turn a brief into a script and storyboard table through the same relay (/v1/chat/completions); text calls are billed separately. Options match the text models on sale at the relay; the retired default is replaced with the current default.",
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
      ffmpegAfter: 'Rather not touch a terminal? Just say "帮我装 ffmpeg" in the chat and the plugin runs the install after you confirm the command. Resume the original saved progress to retry downloading or merging without submitting new generation tasks. Installed somewhere unusual? Put the absolute path in the "ffmpeg path" field above. The package ships ffprobe too, so segment probing is fixed at the same time.',
      ffmpegManual: "Installing by hand: Homebrew on macOS, winget on Windows, your distro package manager on Linux — you are set once `ffmpeg -version` works in a terminal.",
      supportContact: "Support",
      advancedStats: "Usage statistics",
      usageStatsEnabled: "Anonymous usage statistics",
      usageStatsHint: "Reports an anonymous installation ID, version, basic device information and operation results. No conversations, media or API keys. Turning it off does not affect video creation.",
      toolArgsNoticeTitle: "The assistant wrote invalid JSON for a tool call",
      toolArgsNoticeHint: "Usually a value like 480p or 16:9 is missing its quotes. Nothing was executed and nothing was billed; reply “retry with the same settings” and the assistant will re-send with the same resolution, aspect ratio and duration.",
      authNoticeTitle: "Service authentication could not be verified",
      authNoticeHint: "Check the API key and relay URL in Harness model settings. If they are correct, contact support.",
      supportClose: "Close",
      supportScan: "Follow the page instructions to contact support with WeChat for usage or connection questions. If it does not load, use the link below.",
      supportOpenPage: "Open support page",
      versionTitle: "Plugin version",
      versionCurrent: "Installed v{version}",
      versionCheck: "Check for updates",
      versionChecking: "Checking…",
      versionLatest: "Up to date",
      versionNew: "v{version} is available",
      versionFailed: "Update check failed: {message}",
      versionUpdate: "Update now",
      versionOptional: "This update is optional. You can keep using the plugin and update later. It will not install automatically.",
      versionLater: "Later",
      versionUpdateConfirm: "Confirm update to v{version}",
      versionUpdateConfirmHint: "The settings page may briefly close during the update. Your settings and keys will be kept.",
      versionUpdating: "Updating…",
      versionUpdateDone: "v{version} applied through hot reload; no restart needed. Existing conversations use updated plugin rules on the next turn.",
      versionUpdatePending: "v{version} installed, but not activated by the current configuration. Check its enabled state in Plugins.",
      versionUpdateRestart: "v{version} installed; restart Harness to apply it.",
      versionUpdateCancelled: "Update cancelled.",
      versionUpdateRetry: "Update incomplete. Retrying ({attempt}/{total})…",
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
      saving: "Saving…",
      saved: "Settings saved. Changes apply after configuration reloads.",
      saveFailed: "Could not save. Check your settings and try again.",
      dirty: "Unsaved changes",
      loading: "Reading configuration…",
      unavailable: "Plugin settings could not be loaded. Restart Harness and try again. If this continues, check that your Harness and plugin versions are compatible.",
      readOnly: "These settings are read-only and cannot be changed.",
      seamTrimSecondsHint: "Trim the start of segments 2, 3, etc., e.g. 0.5,0. Leave blank for model defaults; use 0 to disable. Each value: 0–3 seconds.",
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

  // src/platform/settings/state.ts
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

  // src/businesses/video-generation/client/state.ts
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

  // src/ui/updates/update.service.ts
  function createUpdates({ h, fetchSource }) {
    const PLUGIN_VERSION = true ? "4.0.7".trim().replace(/^v/i, "") : "";
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
      const probe = context.manager ? context.manager() : { manager: null, tried: ["未注入"] };
      const pluginManager = probe.manager;
      if (!pluginManager || typeof pluginManager.installBundle !== "function") {
        context.setUpdateStatus("failed");
        context.setUpdateMessage(context.t("versionUpdateUnavailable", { detail: probe.tried.join("，") }));
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
          context.setUpdateMessage("当前为本地目录链接安装，已停止在线更新，未执行替换。目录链接切换为成品包存在文件被清空或仍加载旧目录的风险。请先备份并保留原目录，使用成品包迁移流程；若目录已空，先恢复完整package。不要重置 API密钥或直接卸载。");
          return;
        }
        if (bundle.error || bundle.meta?.error) throw new Error("metadata-unavailable");
      } catch {
        context.setUpdateStatus("failed");
        context.setUpdateMessage("无法核实插件安装来源或元信息，已停止更新，未执行替换。请保留现有配置和安装目录，核对安装状态后再处理；不要重置 API密钥或先卸载。");
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

  // src/businesses/video-generation/client/connection-check.ts
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

  // src/businesses/video-generation/client/settings-actions.ts
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
        ])),
        context.renderKeyAction?.(field)
      ]);
    }
    return { save, reset, control };
  }

  // package.json
  var package_default = {
    name: "dsh-metaontic-video",
    version: "4.0.7",
    description: "面向新手的 AI 视频创作助手：从想法、脚本到视频生成，全程引导；通过分段续拍与本地合并，提供低成本长视频制作方案。",
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
      "MetaOnticVideo使用说明书.md",
      "MetaOnticVideo使用说明书.pdf",
      "CHANGELOG.md",
      "LICENSE",
      "docs/guide/*.svg",
      "docs/guide/*.png",
      "THIRD_PARTY_NOTICES.md",
      "presets/*.js",
      "locale/presets/**/*.json",
      "presets/icons/*.svg",
      "plugin-detail.md"
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
      version: "4.0.7",
      prerelease: false,
      publishedAt: "2026-11-19T22:46:23.697Z",
      items: [
        "优化：修复专业项目返回解析异常，避免重复建项目或自动降级。",
        "优化：脚本审核受阻时提供准确补展示材料，复用当前项目与原图继续审核。"
      ]
    }
  };

  // src/businesses/video-generation/client/settings.ts
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
      PLUGIN_PACKAGE: PLUGIN_PACKAGE3,
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
            return PLUGIN_PACKAGE3;
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
          renderKeyAction: (field) => showsSharedValidation(field) ? connectionButton() : null,
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
        function showsSharedValidation(field) {
          return !directMode && field.key === "metaonticApiKey" && (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false;
        }
        function fieldCell(field) {
          const classes = ["mov-field"];
          if (field.kind === "switch") classes.push("mov-field-switch");
          if (field.wide) classes.push("mov-field-wide");
          return h("div", { key: field.key, className: classes.join(" ") }, [
            field.kind === "switch" ? null : h("label", { key: "label", className: "mov-label", htmlFor: `metaontic-video-${field.key}` }, t(["metaonticApiKey", "volcengineApiKey"].includes(field.key) ? !directMode && (draft.imageUseVideoKey ?? value.imageUseVideoKey ?? true) !== false ? "sharedModelKey" : "videoModelKey" : field.key)),
            control(field),
            showsSharedValidation(field) ? connectionFeedback() : null,
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
        function connectionButton() {
          return h("button", {
            key: "verify",
            type: "button",
            className: "mov-btn mov-key-verify",
            "data-action": "check-connection",
            disabled: pending.length > 0 || status === "saving" || snapshot.status !== "ready" || connectionCheck.status === "working",
            onClick: () => checkController.current.run(!pending.length && status !== "saving" && form.getSnapshot()?.status === "ready")
          }, t(connectionCheck.status === "working" ? "connectionChecking" : "connectionCheckButton"));
        }
        function connectionFeedback() {
          return h(
            "div",
            { key: "connection-feedback", role: "status", "aria-live": "polite" },
            pending.length ? h("p", { className: "mov-hint" }, t("connectionCheckSaveFirst")) : null,
            connectionCheck.status === "failed" ? h("p", { style: { color: TOKENS.error } }, t("connectionCheckFailed")) : connectionCheck.checks.map((check) => h("p", { key: check.target, style: { margin: "4px 0", fontSize: 12, color: check.level === "error" ? TOKENS.error : check.level === "success" ? TOKENS.success : TOKENS.muted } }, `${t("connectionTarget_" + check.target)}：${t("connectionResult_" + check.code)}`))
          );
        }
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
              h("span", { key: "title", className: "mov-card-title" }, `${releaseNotes.version} · ${t("releaseNotesTitle")}`),
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
        const blobs = notice && !snapshot.value ? [] : [footer, versionBox, resetRow];
        return h("div", { className: "mov-page" }, [
          // hover / focus 这类效果内联样式写不出来，集中在这张样式表里（class 都带 mov- 前缀）。
          h("style", { key: "styles" }, PAGE_CSS),
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
          ...blobs
        ]);
      };
    }
    return { makePage };
  }

  // src/ui/updates/update-notice.ts
  var UPDATE_HINT_CSS = `
  .mov-rail-hint { position: relative; display: inline-flex; align-items: center; }
  /* 收起侧栏：红点落在图标右上角 */
  .mov-rail-dot {
    position: absolute; top: -1px; right: -1px; width: 8px; height: 8px; border-radius: 50%;
    background: var(--dsw-alias-state-error-primary, #e5533d);
    box-shadow: 0 0 0 2px var(--dsw-specific-sidebar-fill, transparent);
  }
  /* 展开侧栏：这一行有名字，组件里的圆点收起，改在名字最后一个字的右上角点一个角标；贴着字不压字，所以不描边 */
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

  // src/businesses/video-generation/client/panel.ts
  function createSidebarPanel({ React, h, TOKENS, PAGE_CSS, t, PANEL_ID: PANEL_ID2, GUIDE_URL: GUIDE_URL2, LOGO_SVG }) {
    const LOGO_SRC = LOGO_SVG ? `data:image/svg+xml,${encodeURIComponent(LOGO_SVG)}` : "";
    const PANEL_CSS = `
      .mov-panel { width: 100%; max-width: 880px; margin: 0 auto; padding: 30px 32px 44px; display: flex; flex-direction: column; gap: 18px; }
      /* 有更新时的顶部提示：沿用设置页的 .mov-notice，只补面板里的间距与左侧色条 */
      .mov-panel-update { display: flex; flex-direction: column; gap: 8px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-left: 3px solid ${TOKENS.primaryFill}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .mov-panel-update .mov-notice strong { display: block; font-size: 13px; color: ${TOKENS.text}; }
      .mov-panel-update-line { margin: 0; font-size: 12px; line-height: 1.5; color: ${TOKENS.muted}; }
      /* 品牌头图：插件 logo + 标题/简介，给空荡的内容区一个视觉锚点 */
      .mov-panel-hero { display: flex; align-items: center; gap: 14px; }
      .mov-panel-mark { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 44px; height: 44px; color: ${TOKENS.primaryFill}; }
      .mov-panel-logo { width: 100%; height: 100%; object-fit: contain; }
      /* 左侧栏那一行的 logo：按宿主给的尺寸原样铺开，不参与主题取色 */
      .mov-rail-logo { display: block; object-fit: contain; }
      .mov-panel-head { display: flex; flex-direction: column; gap: 3px; min-width: 0; }
      .mov-panel-title { margin: 0; font-size: 19px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-intro { margin: 0; font-size: 13px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 主按钮吃掉多余宽度，次要按钮与链接退到第二排 */
      .mov-panel-actions { display: flex; flex-wrap: wrap; align-items: center; gap: 10px; }
      .mov-panel-actions .mov-btn-primary { flex: 1 1 220px; width: auto; min-width: 160px; height: 38px; }
      .mov-panel-actions .mov-btn:not(.mov-btn-primary) { min-width: 132px; }
      .mov-panel-link { margin-left: auto; font-size: 12px; color: ${TOKENS.primaryFill}; text-decoration: none; border-bottom: 1px solid transparent; }
      .mov-panel-link:hover { border-bottom-color: currentColor; }
      /* 两块价值点卡片：图标 + 标题 + 一句说明，窄容器自动落成一列 */
      .mov-panel-highlights { display: grid; grid-template-columns: repeat(auto-fit, minmax(min(100%, 260px), 1fr)); gap: 12px; }
      .mov-panel-highlight { display: flex; align-items: flex-start; gap: 12px; padding: 13px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
      .mov-panel-highlight-icon { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 34px; height: 34px; border-radius: 10px; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; }
      .mov-panel-highlight-body { min-width: 0; }
      .mov-panel-highlight-title { font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-highlight-desc { margin: 4px 0 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 流程演示：四步卡片横排，卡片之间用箭头连起来；窄容器落成一列 */
      .mov-panel-flow { display: flex; align-items: stretch; }
      .mov-panel-step { position: relative; overflow: hidden; flex: 1 1 0; min-width: 0; display: flex; flex-direction: column; gap: 7px; padding: 13px 14px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; animation: mov-flow-card 9s ease-in-out infinite; }
      .mov-panel-step-head { display: flex; align-items: center; gap: 8px; }
      .mov-panel-step-badge { flex: 0 0 auto; display: inline-flex; align-items: center; justify-content: center; width: 22px; height: 22px; border-radius: 50%; font-size: 11px; font-weight: 600; color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; animation: mov-flow-badge 9s ease-in-out infinite; }
      .mov-panel-step-title { min-width: 0; font-size: 13px; font-weight: 600; color: ${TOKENS.text}; }
      .mov-panel-step-desc { margin: 0; font-size: 12px; line-height: 1.55; color: ${TOKENS.muted}; }
      /* 右上角的淡色水印图标，只做装饰 */
      .mov-panel-step-icon { position: absolute; top: 10px; right: 10px; color: ${TOKENS.primaryFill}; opacity: .14; pointer-events: none; }
      /* 卡片之间的箭头：横排时向右，窄容器里转成向下 */
      .mov-panel-conn { flex: 0 0 26px; align-self: center; height: 2px; border-radius: 1px; background: ${TOKENS.border}; position: relative; }
      .mov-panel-conn::after { content: ''; position: absolute; top: 50%; right: -1px; width: 5px; height: 5px; border-top: 2px solid ${TOKENS.border}; border-right: 2px solid ${TOKENS.border}; transform: translateY(-50%) rotate(45deg); }
      /* 四步依次点亮，形成一条走动的流程；延迟按步号错开 */
      @keyframes mov-flow-card { 0%, 16% { border-color: ${TOKENS.primaryFill}; } 28%, 100% { border-color: ${TOKENS.border}; } }
      @keyframes mov-flow-badge { 0%, 16% { color: #fff; background: ${TOKENS.primaryFill}; } 28%, 100% { color: ${TOKENS.primaryFill}; background: ${TOKENS.controlFill}; } }
      .mov-panel-step[data-step="1"], .mov-panel-step[data-step="1"] .mov-panel-step-badge { animation-delay: 2.25s; }
      .mov-panel-step[data-step="2"], .mov-panel-step[data-step="2"] .mov-panel-step-badge { animation-delay: 4.5s; }
      .mov-panel-step[data-step="3"], .mov-panel-step[data-step="3"] .mov-panel-step-badge { animation-delay: 6.75s; }
      .mov-panel { container-type: inline-size; }
      @container (max-width: 620px) {
        .mov-panel-flow { flex-direction: column; align-items: stretch; }
        /* 竖向排布时不能再按剩余空间拉伸，否则卡片会被压扁 */
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

  // src/businesses/video-generation/integrations/canvas-stages.ts
  var STAGE_REV = 2;
  var STAGE_KEYS = ["requirement", "script", "storyboard", "assets", "cost", "segments", "film"];
  var STAGE_LABELS = {
    requirement: "① 需求确认",
    script: "② 脚本审核",
    storyboard: "③ 分镜确认",
    assets: "④ 素材准备",
    cost: "⑤ 费用确认",
    segments: "⑥ 逐段制作",
    film: "⑦ 合成成片"
  };
  var STAGE_STATE_TEXT = { done: "已完成", active: "进行中", review: "待审核", ready: "待合成", pending: "未开始" };
  var STAGE_ACTIONS = {
    requirement: { label: "填需求", hint: "写想拍什么、总时长、每段时长、画幅与清晰度，也可以让文本模型把想法写成剧本（文本按用量单独计费）；铺节点本身不产生视频费用" },
    script: { label: "看剧本", hint: "打开剧本节点核对或修改内容，分镜与分段计划随脚本一起铺开；这一步只改节点内容，不生成视频、不计费" },
    storyboard: { label: "看分镜", hint: "打开分镜节点核对每个镜头的画面、景别、视角与运镜；没识别到分镜表时按场景与句子切段，这一步只改内容、不生成视频、不计费" },
    assets: { label: "准备素材", hint: "逐段生成前把角色图、首帧或参考图准备好：可以导入自己的图，也可以在图片节点里让模型生成（图片单独计费并要审核）；真人照片要先转成非真人二维动画风格" },
    cost: { label: "看估价", hint: "列出每段提示词、时长与整条链路的预估合计，确认方案与费用后才开跑" },
    segments: { label: "做这一段", hint: "打开当前还没成果的制作节点，核对制作方案并单独确认费用后才会调用模型" },
    film: { label: "合成成片", hint: "把已有成果按连线顺序拼成一条成片，只读成果、不重新生成、不额外计费" }
  };
  function stageAction(key) {
    return STAGE_ACTIONS[key] || null;
  }
  var STAGE_DRAFT_ACTION = {
    script: { label: "写脚本", hint: "按第一步创建的需求写剧本与分镜（可以让文本模型写，也可以自己写，文本按用量单独计费）；这一步只出剧本与分镜、不生成视频、不产生视频费用，写好后先核对每段提示词，再确认脚本" }
  };
  var STAGE_STORYBOARD_ACTION = {
    storyboard: { label: "生成分镜", hint: "按已审核的脚本切分镜与每段提示词：写成 Markdown 分镜表就按镜号切段，否则按场景与句子切段；这一步只铺节点、不生成视频、不产生视频费用" }
  };
  var STAGE_REVIEW_ACTION = {
    script: { label: "确认脚本", hint: "核对过剧本与每段提示词就点这里：脚本审核通过后阶段卡②标为已完成，接着看整条链路估价；费用仍逐段单独确认" }
  };
  var STAGE_EDIT_ACTION = {
    requirement: { label: "改需求", hint: "需求已创建：要改想拍什么、总时长、每段时长、画幅或清晰度就点这里，改的是需求节点与阶段卡、不调用模型也不计费；已铺开的脚本与制作段不受影响，要顺着新规格重做就删除旧节点再走一遍" }
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
      `想拍什么：${brief}`,
      `目标总时长：${seconds} 秒`,
      `每段时长：${segmentSeconds} 秒`,
      `画幅：${ratio}`,
      `清晰度：${String(resolution).toUpperCase()}`
    ].join("\n");
    return {
      label: "需求",
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
      return { nodeId: String(node.id), label: String(node?.data?.label || "素材图"), segments: serving };
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
        message: "有一条连线指向已被删除的节点。",
        suggestedAction: "选中那条线断开，或重新连到还在的节点上。"
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
        message: `制作段「${String(node?.data?.label || "未命名")}」还没有成果。`,
        suggestedAction: "点这个节点的「制作」，核对方案并确认费用后生成。"
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
        message: `画面「${String(node?.data?.label || "本段画面")}」还没有出图。`,
        suggestedAction: "先点这个画面节点的「制作」出一张图；出图后它会作为这一段的首帧接给后面的视频节点，图片按用量单独计费并要审核。"
      });
    }
    for (const link of canvasAssetLinks(doc)) {
      if (link.segments.length) continue;
      issues.push({
        code: "ORPHAN_ASSET",
        severity: "info",
        scope: "asset",
        nodeId: link.nodeId,
        message: `素材图「${link.label}」还没接到任何制作段。`,
        suggestedAction: "把它连到某个制作节点的「参考图」或「首帧」端口，不用的素材可以删掉。"
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
        message: `成果「${String(node?.data?.label || "视频成果")}」对应的制作段已被删除。`,
        suggestedAction: "它不参与制作段计数，也不会进入成片；要重做先按流程铺出制作段，成果文件仍保留在画布数据目录。"
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
        message: `已合成的成片是 ${filmCount} 段，画布上现在的视频成果有 ${videoDone} 段。`,
        // 建议按「画布上还有没有视频制作段」分岔：一段都不剩时合并没有任何输入，会直接报错，
        // 也就不能再劝用户「每段都出成果后重新合成」。
        suggestedAction: videoSegments.length ? "每段都出成果后重新点「合成成片」，成片会按当前连线顺序重拼。" : "画布上已经没有视频制作段了：要重做先按流程铺出制作段；已合成的成片文件仍保留在画布数据目录。"
      });
    }
    return issues;
  }
  var CHOICE_TEXT = {
    not_needed: "不需要角色图",
    provided_images: "使用已有角色图",
    generate_first: "先生成角色图再制作",
    text_only: "纯文本生成"
  };
  function stageSummary(facts = {}, stats = {}) {
    const duration = Number.isFinite(Number(facts.duration)) && facts.duration !== null && facts.duration !== void 0 ? Number(facts.duration) : null;
    const produced = Number(stats.produced || 0), total = Math.max(Number(facts.segmentTotal || 0), Number(stats.total || 0));
    const shots = Number(stats.shots || 0), assets = Number(stats.assets || 0);
    const choice = CHOICE_TEXT[facts.choice] || facts.choice || "待确认";
    const requirementText = [
      `目标时长：${duration === null ? "待确认" : `${duration} 秒`}`,
      `画幅：${facts.ratio || "待确认"}`,
      `清晰度：${String(facts.resolution || "待确认").toUpperCase()}`,
      `角色图路线：${choice}`
    ].join("\n");
    const scriptText = [
      `剧本：${facts.scriptDrafted || facts.scriptApproved ? "已同步" : "未开始"}`,
      `审核：${facts.scriptApproved ? "已通过" : facts.scriptDrafted ? "等待用户审核" : "未开始"}`
    ].join("\n");
    const storyboardText = shots > 0 ? [`分镜：${shots} 个镜头`, `每段提示词见制作节点`].join("\n") : total > 0 ? [`分镜：按场景与句子切段，共 ${total} 段`, `每段提示词见制作节点`].join("\n") : "还没有分镜：先写脚本并确认审核，再按分镜表或句子切段。";
    const bound = Number.isFinite(Number(stats.assetsBound)) ? Number(stats.assetsBound) : assets;
    const assetsText = [
      `角色图路线：${choice}`,
      `素材图：${assets} 张（角色图 / 首帧 / 参考图）${assets > bound ? `，其中 ${assets - bound} 张还没接到制作段` : ""}`
    ].join("\n");
    const costText = [
      `制作方案：${facts.specApproved ? "已审核" : "未产出"}`,
      `费用：${produced > 0 ? "已确认（已有生成记录）" : "生成前仍要单独确认"}`
    ].join("\n");
    const segmentsText = total > 0 ? [`制作段：${total} 段`, `已完成：${Math.min(produced, total)} 段`].join("\n") : "暂无制作段：先在画布上写脚本、确认脚本审核与制作方案。";
    const filmText = stats.filmReady ? `已合成成片（${Number(stats.filmCount || 0)} 段）` : total > 0 && produced >= total ? "每段都有成果，可以点「合成成片」" : "等待每段都产出成果";
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

  // src/businesses/film-production/profiles/profile.definition.ts
  var entry = (label, creative, screenwriter, storyboard, criterion) => ({ label, rules: { creative, screenwriter, storyboard, reviewer: criterion }, criterion });

  // src/businesses/film-production/profiles/genres/comedy.ts
  var comedy_default = entry("喜剧", "寻找人物欲望与情境反差，不强制反转。", "以铺垫、升级、行为笑点与回应推进。", "为笑点兑现和反应留时间，不靠密集切镜。", "笑点有铺垫且符合人物逻辑。");

  // src/businesses/film-production/profiles/genres/drama.ts
  var drama_default = entry("剧情", "建立目标、阻碍、选择与后果。", "事件因果推动人物或关系变化。", "呈现决定与后果，不用空镜代替行动。", "人物选择与可见后果成立。");

  // src/businesses/film-production/profiles/genres/documentary.ts
  var documentary_default = entry("纪录", "建立真实问题、观察对象与素材来源。", "使用真实材料、采访问题或明确标注的戏剧化重现，不编造受访者原话。", "区分拟拍摄方案、真实素材和重现镜头。", "陈述有来源，VERIFIED_FACT/USER_PROVIDED/UNVERIFIED/DRAMATIZATION 分离。");

  // src/businesses/film-production/profiles/genres/animation.ts
  var animation_default = entry("动画", "明确世界规则、角色辨识与目标受众。", "动作有视觉因果，遵守世界规则。", "动作路径清楚，角色比例与空间规则稳定。", "世界规则、角色和动作可读性一致。");

  // src/businesses/film-production/profiles/genres/romance.ts
  var romance_default = entry("爱情", "围绕具体关系变化与情感障碍提炼体验。", "用互动、试探、回应推进关系，不靠告白口号。", "通过距离、视线与回应呈现关系变化。", "情感变化有具体互动与回应支撑。");

  // src/businesses/film-production/profiles/genres/thriller.ts
  var thriller_default = entry("悬疑惊悚", "规划观众已知和未知信息及线索。", "悬念有因果铺垫与回收，不依赖无原因反转。", "控制视点与信息揭示，不能藏掉理解所需证据。", "线索公平、因果成立且关键悬念得到处理。");

  // src/businesses/film-production/profiles/formats/skit.ts
  var skit_default = entry("情景小品", "集中在单一情境与核心互动。", "减少支线，动作、对白和反应可在预算内完成。", "少量必要机位保持互动可读。", "单一情境完整，关键反应有时长。");

  // src/businesses/film-production/profiles/formats/short-film.ts
  var short_film_default = entry("短片", "构建适合时长的完整体验。", "每场有功能与状态变化。", "镜头覆盖关键事件并控制节奏。", "结构完整，场景推进有必要性。");

  // src/businesses/film-production/profiles/formats/micro-drama.ts
  var micro_drama_default = entry("微短剧", "设计单集核心事件与连续人物关系。", "记录关系变化和未解决线索，不重置角色。", "关键冲突与回应清楚，不能用快切掩盖因果。", "单集成立并与连续人物线一致。");

  // src/businesses/film-production/profiles/formats/series.ts
  var series_default = entry("连续作品", "建立全片主线、单集功能与跨集状态。", "维护伏笔、前情与人物状态，按章交付。", "分章场镜分层规划，复查跨章边界。", "单集进度和全片完成状态准确，线索可追踪。");

  // src/businesses/film-production/profiles/formats/interview.ts
  var interview_default = entry("访谈", "明确问题、对象与真实素材需求。", "提供采访问题；未取得的回答不得当成真实原话。", "安排采访、反应与相关证据画面，不虚构已拍素材。", "采访来源真实，拟问与已回答内容区分。");

  // src/businesses/film-production/profiles/formats/commercial.ts
  var commercial_default = entry("广告片", "围绕需求、可信利益与行动目标设计。", "只使用有依据的产品主张与演示。", "展示产品使用过程和证据，避免暗示未证实功效。", "产品主张有依据，使用与行动目标清楚。");

  // src/businesses/film-production/profiles/formats/vlog.ts
  var vlog_default = entry("生活记录", "寻找日常观察、细节与体验变化。", "保留自然行动和环境反馈，不强加戏剧冲突。", "观察性构图与自然节奏，避免无意义运镜。", "日常细节有观察价值，节奏自然。");

  // src/businesses/film-production/profiles/formats/music-video.ts
  var music_video_default = entry("音乐影像", "建立音乐与视觉母题的关联。", "用动作和意象递进，不强塞对白或剧情。", "按音乐段落规划节奏与视觉变化。", "声画关联和意象递进明确。");

  // src/businesses/film-production/profiles/purposes/entertainment.ts
  var entertainment_default = entry("娱乐", "明确观众的情绪收益。", "保持人物与事件吸引力，避免空洞刺激。", "保证看点可见且节奏可读。", "观众体验有事件或画面支撑。");

  // src/businesses/film-production/profiles/purposes/promotion.ts
  var promotion_default = entry("宣传", "提炼地域或品牌辨识与记忆点。", "用具体可核实细节代替口号。", "展示可辨识地点、人物和生活细节。", "辨识度与传播信息具体且可信。");

  // src/businesses/film-production/profiles/purposes/education.ts
  var education_default = entry("科普教育", "确定观众要理解的问题与边界。", "按问题、证据、解释推进，事实不确定处标待核实。", "用演示或对比解释信息，不只堆字幕。", "知识准确，解释清楚，有证据与适用边界。");

  // src/businesses/film-production/profiles/purposes/sales.ts
  var sales_default = entry("销售转化", "定义需求、证据与行动目标。", "不编造性能、数据、认证或承诺。", "让使用过程与利益证据可见。", "卖点可信，行动清楚，无夸大主张。");

  // src/businesses/film-production/profiles/styles/rural-documentary.ts
  var rural_documentary_default = entry("乡村观察", "从具体生活观察寻找细节，不刻板化农村。", "语言自然，地域事实需来源。", "自然光、现场声与可辨空间，不自动添加破败贫困。", "生活细节可信，地域事实与观察边界清楚。");

  // src/businesses/film-production/profiles/styles/minidv.ts
  var minidv_default = entry("千禧 MiniDV", "以生活片段与自然观察组织视觉母题。", "对白小声自然，动作与停顿有生活感。", "按需轻微手持、对焦搜索、低饱和原生色彩和颗粒，不掩盖关键动作。", "DV 表现克制，人物动作与关键信息保持清楚。");

  // src/businesses/film-production/profiles/styles/cinematic-realism.ts
  var cinematic_realism_default = entry("写实电影", "以具体事件承载表达。", "行为和对白自然，不用抽象形容词代替剧情。", "以光源、材质、空间和动作描述风格，不堆参数。", "视觉细节真实并服务叙事。");

  // src/businesses/film-production/profiles/styles/stylized-animation.ts
  var stylized_animation_default = entry("风格化动画", "明确统一的造型和世界规则。", "表演与动作符合设定。", "统一比例、材质、色彩和动作物理规则。", "造型风格与世界物理规则跨镜一致。");

  // src/businesses/film-production/profiles/legacy/drama.ts
  var drama_default2 = {
    "id": "DRAMA",
    "revision": "1",
    "label": "剧情短片",
    "strategy": "人物目标→阻碍→选择→可见后果",
    "boundary": "允许克制的日常矛盾，不机械添加悲情或反转。",
    "creative_fields": {
      "character_goal": "人物此刻的具体目标",
      "choice_and_consequence": "关键选择与后果"
    },
    "script_fields": {
      "causal_progression": "事件之间的因果推进",
      "character_change": "人物或关系的变化"
    },
    "review_criteria": [
      {
        "id": "drama_1",
        "description": "动机是否由行动体现"
      },
      {
        "id": "drama_2",
        "description": "选择和结果是否有因果依据"
      }
    ],
    "role_rules": {
      "screenwriter": "围绕人物选择写场景，配角有自身理由，不用机械误会制造阻碍。",
      "storyboard": "让观众看清选择发生的瞬间与后果，反应镜头承担关系变化。"
    }
  };

  // src/businesses/film-production/profiles/legacy/comedy.ts
  var comedy_default2 = {
    "id": "COMEDY",
    "revision": "1",
    "label": "情景喜剧",
    "strategy": "预期→升级→反差→回收",
    "boundary": "笑点来自人物与情境，不依赖刻板印象、夸张表情或音效。",
    "creative_fields": {
      "comic_premise": "观众预期与喜剧前提",
      "payoff": "反差落点与回收"
    },
    "script_fields": {
      "setup_payoff": "铺垫与笑点的对应",
      "reaction_budget": "笑点前后反应与停顿的时间安排"
    },
    "review_criteria": [
      {
        "id": "comedy_1",
        "description": "笑点是否有可辨识的铺垫"
      },
      {
        "id": "comedy_2",
        "description": "反差是否由人物行为引发且有反应时间"
      }
    ],
    "role_rules": {
      "screenwriter": "先让预期成立再偏离，避免角色为笑话突然失去常识。",
      "storyboard": "关键笑点信息不可被运镜遮住，给观众读懂反差和人物反应的时间。"
    }
  };

  // src/businesses/film-production/profiles/legacy/lifestyle.ts
  var lifestyle_default = {
    "id": "LIFESTYLE",
    "revision": "1",
    "label": "生活Vlog／氛围片",
    "strategy": "体验起点→细节发现→感受变化",
    "boundary": "可以无冲突、无对白、无人像；生活质感与观察顺序成立即可，不强造戏剧。",
    "creative_fields": {
      "experience_line": "本片体验或观察主线",
      "detail_discovery": "值得观看的具体细节发现"
    },
    "script_fields": {
      "observation_progression": "细节如何逐步被发现",
      "sensory_rhythm": "生活动作、环境声及留白的节奏"
    },
    "review_criteria": [
      {
        "id": "lifestyle_1",
        "description": "观察是否有推进而非重复风景"
      },
      {
        "id": "lifestyle_2",
        "description": "生活动作和声音是否可信且符合用户氛围"
      }
    ],
    "role_rules": {
      "screenwriter": "以生活动作和感官发现组织内容，允许留白，不虚构苦难或硬加反转。",
      "storyboard": "构图让观众发现细节，空间光线与环境声音参与叙事，固定机位可以成立。"
    }
  };

  // src/businesses/film-production/profiles/legacy/documentary.ts
  var documentary_default2 = {
    "id": "DOCUMENTARY",
    "revision": "1",
    "label": "纪录／知识片",
    "strategy": "核心问题→证据与例子→解释→回应",
    "boundary": "区分已核实事实、用户材料、待核实内容与戏剧化重现；不编造采访和真实经历。",
    "creative_fields": {
      "central_question": "要回应的具体问题",
      "evidence_plan": "已有来源与待补证据计划"
    },
    "script_fields": {
      "evidence_sources": "论据与对应来源，缺失标待核实",
      "fact_fiction_boundary": "事实、解释和重现的边界"
    },
    "review_criteria": [
      {
        "id": "documentary_1",
        "description": "关键陈述是否有来源或明确待核实"
      },
      {
        "id": "documentary_2",
        "description": "事实与虚构重现是否清楚区分"
      }
    ],
    "role_rules": {
      "screenwriter": "用可核实材料支撑说明，不为制造冲突编造真实人物心理。",
      "storyboard": "证据画面与解释对应，重现须明确标识，画面不能暗示未经证实的因果。"
    }
  };

  // src/businesses/film-production/profiles/legacy/commercial.ts
  var commercial_default2 = {
    "id": "COMMERCIAL",
    "revision": "1",
    "label": "产品广告",
    "strategy": "需求→使用过程→价值证据→行动",
    "boundary": "产品外观、功效、数据与认证须有依据，不通过画面暗示未证实效果。",
    "creative_fields": {
      "user_need": "具体用户需求",
      "supported_benefit": "有资料支持的产品利益"
    },
    "script_fields": {
      "claims_and_evidence": "卖点及对应依据，缺失标待核实",
      "usage_and_action": "可观察使用过程与行动引导"
    },
    "review_criteria": [
      {
        "id": "commercial_1",
        "description": "卖点是否由材料支持"
      },
      {
        "id": "commercial_2",
        "description": "使用过程是否清楚且产品身份准确"
      }
    ],
    "role_rules": {
      "screenwriter": "展示真实需求与使用过程，避免堆卖点及无依据前后效果。",
      "storyboard": "关键产品细节和使用步骤清楚可见，品牌文字与Logo依赖授权素材及后期能力。"
    }
  };

  // src/businesses/film-production/profiles/legacy/promotional.ts
  var promotional_default = {
    "id": "PROMOTIONAL",
    "revision": "1",
    "label": "品牌／地域宣传",
    "strategy": "识别特征→具体生活→人物或观察对象→情绪落点",
    "boundary": "地域和品牌特征具体可信，不用空泛赞美替代内容；不强制增加人物。",
    "creative_fields": {
      "recognizable_identity": "品牌或地域的可辨识特征",
      "emotional_anchor": "情绪落点及其具体载体"
    },
    "script_fields": {
      "distinctive_details": "具有辨识度的生活或品牌细节",
      "identity_progression": "细节如何共同呈现主题"
    },
    "review_criteria": [
      {
        "id": "promotional_1",
        "description": "画面是否具有当地或品牌辨识度"
      },
      {
        "id": "promotional_2",
        "description": "情绪是否由具体细节而非口号支撑"
      }
    ],
    "role_rules": {
      "screenwriter": "把身份特征落在具体使用或生活细节，真实地点资料不足标待核实。",
      "storyboard": "空间、人物或物件关系体现地域品牌特征，不用通用航拍和素材堆砌替代。"
    }
  };

  // src/businesses/film-production/profiles/index.ts
  var REGISTRY = Object.fromEntries([drama_default2, comedy_default2, lifestyle_default, documentary_default2, commercial_default2, promotional_default].map((p) => [p.id, p]));
  var WORK_TYPES = Object.keys(REGISTRY);
  function availableProfiles() {
    return Object.values(REGISTRY).map((p) => ({ work_type: p.id, label: p.label, profile_revision: p.revision, strategy: p.strategy }));
  }

  // src/businesses/video-generation/client/canvas-view.ts
  var TEXT_WRITE_TIMEOUT_MS = 18e4;
  async function canvasNativeRpc(args, fetcher = fetch, timeoutMs = 2e4) {
    const response = await fetcher("/metaontic-video/canvas-native", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(args), signal: AbortSignal.timeout(timeoutMs) });
    let body;
    try {
      body = await response.json();
    } catch {
      throw new Error("画布制作服务尚未就绪，请核对插件加载状态。");
    }
    if (!response.ok || body?.error) throw new Error(body?.error || "制作请求未完成，请查询原记录，不要重复生成。");
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
    return ordered.map((node) => ({ id: node.id, type: node.type, label: String(node?.data?.label || (node.type === "image" ? "图片" : "视频")), done: produced.has(node.id) }));
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
      if (!response.ok || body?.error) throw new Error(body?.error || "流程画布服务尚未就绪，请核对插件加载状态。");
      return body;
    };
    const mediaUrl = (assetId) => `/metaontic-video/canvas-media?assetId=${encodeURIComponent(assetId)}`;
    const sizeOf = (node) => nodeSize(node);
    const labelOf = (node) => String(node?.data?.label || { script: "剧本", storyboard: "分镜", text: "说明", video: "视频", image: "图片" }[node?.type] || "节点");
    const textOf2 = (node) => String(node?.data?.output || node?.data?.text || node?.data?.prompt || "");
    const RATIOS = ["16:9", "9:16", "1:1", "4:3", "3:4"];
    const RESOLUTIONS = ["480p", "720p"];
    const money2 = (value) => Number.isFinite(Number(value)) ? `¥${(Math.round(Number(value) * 1e4) / 1e4).toFixed(4)}` : "按实际调用计费";
    const phaseText = (state) => ({
      succeeded: "生成成功",
      running: "正在制作",
      interrupted: "已中断，可查询原任务",
      failed: "制作失败，未自动重试",
      unknown: "任务状态待确认",
      submission_unknown: "提交结果未确认",
      cancelled: "已取消"
    })[state] || "状态未知";
    const CSS = `
.movc { display: flex; flex-direction: column; gap: 14px; }
.movc-bar { display: flex; flex-wrap: wrap; align-items: center; gap: 8px; }
.movc-top { display: flex; flex-direction: column; align-items: stretch; gap: 10px; margin-bottom: 4px; padding: 12px 14px; border: 1px solid ${TOKENS.border}; border-radius: 12px; background: ${TOKENS.cardFill}; }
.movc-list { display: flex; flex-wrap: nowrap; gap: 6px; overflow-x: auto; overflow-y: hidden; padding-bottom: 2px; }
.movc-pick { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; }
.movc-name-empty { font-size: 13px; font-weight: 600; color: ${TOKENS.muted}; }
/* 画布内按钮统一成一套：描边 + 主色悬停，不吃宿主默认的灰底；主按钮才用实心主色。 */
.movc .mov-btn, .movc-modal .mov-btn { display: inline-flex; align-items: center; justify-content: center; gap: 6px; box-sizing: border-box; border: 1px solid ${TOKENS.border}; border-radius: 8px; background: transparent; color: ${TOKENS.text}; font: inherit; font-size: 12px; line-height: 1.2; cursor: pointer; white-space: nowrap; transition: background .15s, border-color .15s, color .15s, opacity .15s; }
.movc .mov-btn:hover:not(:disabled), .movc-modal .mov-btn:hover:not(:disabled) { border-color: ${TOKENS.primaryFill}; background: transparent; color: ${TOKENS.primaryFill}; }
.movc .mov-btn:disabled, .movc-modal .mov-btn:disabled { opacity: .5; cursor: default; }
.movc .mov-btn-primary, .movc-modal .mov-btn-primary { border-color: ${TOKENS.primaryFill}; background: ${TOKENS.primaryFill}; color: #fff; font-weight: 600; }
.movc .mov-btn-primary:hover:not(:disabled), .movc-modal .mov-btn-primary:hover:not(:disabled) { background: ${TOKENS.primaryFill}; color: #fff; opacity: .88; }
.movc .movc-danger:hover:not(:disabled), .movc-modal .movc-danger:hover:not(:disabled) { border-color: ${TOKENS.error}; color: ${TOKENS.error}; }
/* 工具条按钮：只把固定 120px 宽改成按内容排布，高度与内距和选择画布胶囊对齐。 */
.movc-ops { flex: 1 1 auto; min-width: 0; gap: 6px; row-gap: 8px; container-type: inline-size; }
.movc-ops .mov-btn { flex: 0 0 auto; width: auto; min-width: 0; height: 32px; min-height: 32px; padding: 0 14px; overflow-wrap: normal; }
.movc-flow { flex: 0 0 auto; font-size: 12px; color: ${TOKENS.muted}; white-space: nowrap; }
/* 流程主行动：用主色描边突出，但不和「新建画布…」的实心主按钮抢注意力。 */
.movc-ops .movc-run { border-color: ${TOKENS.primaryFill}; color: ${TOKENS.primaryFill}; }
.movc-ops .movc-run:disabled { border-color: ${TOKENS.border}; color: ${TOKENS.text}; }
.movc-sep { flex: 0 0 auto; width: 1px; height: 18px; margin: 0 2px; background: ${TOKENS.border}; }
/* 面板窄的时候按钮本来就会换行，分组竖线会落在行首，直接不收。 */
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
/* 弹窗里的按钮按内容自适应，不撑成设置页那种 120px 方块。 */
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
        h("ul", { key: "list", className: "movc-shots" }, data.shots.slice(0, 12).map((shot, index) => h("li", { key: index }, `${shot?.index || index + 1}. ${[shot?.camera, shotVisual(shot).slice(0, 60)].filter(Boolean).join(" · ")}`))),
        data.shots.length > 12 ? h("div", { key: "more" }, `…共 ${data.shots.length} 个镜头`) : null
      ]);
      const text = textOf2(node);
      return h("div", { key: "text", className: "movc-body" }, text ? text.slice(0, 600) : "（暂无内容，可先编辑）");
    }
    const chainStatusText = (chain) => ({
      running: `连拍进行中：第 ${chain.index + 1}/${chain.total} 段生成中…`,
      review: `第 ${chain.index + 1}/${chain.total} 段已有成果，等你审核`,
      done: `连拍完成：${chain.total} 段都已有成果`,
      stopped: `连拍已停止：已完成 ${chain.done}/${chain.total} 段`,
      stale: `连拍需要重排：已完成 ${chain.done}/${chain.total} 段`
    })[chain.state] || `连拍状态：${chain.state}`;
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
          setError(e?.message || "流程画布读取失败");
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
        setNotice("已复制节点（不含成果素材与原任务标识）；改完内容再生成，费用照常单独确认。");
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
          setError(e?.message || "导出画布失败");
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
            if (!response.ok || body?.error) throw new Error(body?.error || "导入图片未完成。");
            const id = `usr_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;
            const count = Object.keys(canvas.nodes || {}).length + made.length;
            await saveNode(id, {
              type: "image",
              x: 60 + count % 4 * 420,
              y: 60 + Math.floor(count / 4) * 360,
              w: NODE_SIZE.image[0],
              h: NODE_SIZE.image[1],
              data: {
                label: body.name || String(file?.name || "导入图片"),
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
            if (attachTo) setNotice(`已导入 ${made.length} 张参考素材，并连到本节点的「参考图」端口；在制作窗口里也可以把端口切成「首帧」。真人照片会被视频接口拒绝，先把照片连到图片节点生成一张非真人二维动画风格的图，再用那张当首帧。`);
            else setNotice(`已导入 ${made.length} 张图片素材：连到视频节点的「首帧」或「参考图」端口就能直接用于制作。真人照片会被视频接口拒绝，先把照片连到图片节点生成一张非真人二维动画风格的图，再用那张当首帧。`);
          }
        } catch (e) {
          setError(e?.message || "导入图片失败");
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
          setNotice(`成片已合成：${data?.film?.count || 0} 段${data?.film?.seconds ? ` · 约 ${Math.round(data.film.seconds)} 秒` : ""}，可直接预览或下载。`);
        } catch (e) {
          setFilmDialog((current) => ({ ...current || {}, busy: false, message: e?.message || "合成成片未完成。" }));
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
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "连拍状态没读到。" });
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
          if (alive.current) patchChainDialog({ loading: false, error: e?.message || "连拍方案没算出来。" });
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
          setNotice("连拍已开始：会按顺序逐段生成，每段出成果后停下来等你审核，确认无误再继续下一段。");
        } catch (e) {
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "连拍没开始。" });
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
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "这一段没能继续。" });
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
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "连拍没能停下。" });
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
          if (alive.current) patchChainDialog({ busy: false, error: e?.message || "补回填没完成。" });
        }
      }, [chainDialog, patchChainDialog, pullChain, refresh]);
      const tidy = React.useCallback(async () => {
        if (!canvas) return;
        try {
          setError("");
          const { canvas: doc } = await rpc("get", { projectId: canvas.projectId });
          const { spots, moved } = await applyLayout(doc);
          if (!moved) {
            setNotice("当前布局已经整齐，无需调整。");
            return;
          }
          setPositions({});
          await refresh();
          fitStage(doc, spots);
          setNotice(`已美化布局：${moved} 个节点按连线重排；内容与连线没动，之后仍可手动微调。`);
        } catch (e) {
          setError(e?.message || "美化布局失败");
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
            ...info?.videoReady === false ? { error: "还没配置视频API密钥，可以先创建需求，配置好再生成。" } : {}
          });
        } catch (e) {
          if (alive.current) patchScriptDialog({ error: e?.message || "制作服务尚未就绪。" });
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
            ...info?.videoReady === false ? { error: "还没配置视频API密钥，可以先写脚本，配置好再生成。" } : {}
          });
        } catch (e) {
          if (alive.current) patchScriptDialog({ error: e?.message || "制作服务尚未就绪。" });
        }
      }, [canvas, patchScriptDialog]);
      const writeWithModel = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const idea = String(scriptDialog.idea || "").trim();
        if (!idea) {
          patchScriptDialog({ error: "先写一句想拍什么，文本模型才有得写。" });
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
            error: result.truncated === true ? "文本模型写到了输出上限，脚本可能不完整：把目标时长调短一些，或分两次写，再核对分镜表。" : ""
          });
          setNotice(`文本模型（${result.model}）已写出剧本：核对分镜表后点「预览分段」，再生成制作节点。`);
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, writing: false, writingSince: 0, error: e?.message || "文本模型没有写出脚本。" });
        }
      }, [canvas, scriptDialog, patchScriptDialog]);
      const previewScript = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const text = String(scriptDialog.text || "").trim();
        if (!text) {
          patchScriptDialog({ error: "请先写下脚本内容。" });
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
          if (alive.current) patchScriptDialog({ busy: false, error: e?.message || "分段计划没算出来。" });
        }
      }, [canvas, scriptDialog, patchScriptDialog]);
      const createRequirement = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const brief = String(scriptDialog.idea || "").trim();
        if (!brief) {
          patchScriptDialog({ error: "先写一句想拍什么，需求才有内容。" });
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
            choice: "画布内创作",
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
          setNotice("需求已创建：① 需求确认标为已完成。再点画布空白处或阶段卡②的「写脚本」，按这份需求写剧本与分镜。");
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, error: e?.message || "需求节点没建出来。" });
        }
      }, [canvas, scriptDialog, patchScriptDialog, saveNode, applyLayout, refresh, fitStage]);
      const createFromScript = React.useCallback(async () => {
        if (!canvas || !scriptDialog) return;
        const text = String(scriptDialog.text || "").trim();
        if (!text) {
          patchScriptDialog({ error: "请先写下脚本内容。" });
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
          await saveNode(scriptId, { type: "script", x: baseX, y: baseY, w: 420, h: 320, data: { label: "剧本", text } });
          let upstream = scriptId;
          if (plan.shots?.length) {
            const boardId = `usr_${stamp}_board`;
            const shots = plan.shots.map((shot) => ({ index: shot.index, visual: shot.visual, ...shot.camera ? { camera: shot.camera } : {}, ...shot.sfx ? { sfx: shot.sfx } : {}, ...shot.duration ? { duration: shot.duration } : {} }));
            await saveNode(boardId, { type: "storyboard", x: baseX + 560, y: baseY, w: 460, h: 340, data: { label: "分镜", shots } });
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
              data: { label: `第${index + 1}段 · 画面`, prompt: segment.prompt, ratio, resolution, imageCount: 1, [FRAME_MARK]: id }
            });
            await saveNode(id, {
              type: "video",
              x: baseX + 1720,
              y: baseY + index * 340,
              w: 360,
              h: 300,
              data: { label: `第${index + 1}段 · ${segment.seconds}秒`, prompt: segment.prompt, ratio, resolution, duration: segment.seconds }
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
            choice: "画布内创作",
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
          setNotice(`已按脚本铺开 ${plan.segments.length} 段流程（剧本 → 分镜 → 画面 → 视频）：先核对每段提示词，确认无误后点剧本节点或阶段卡②的「确认脚本」，再点「制作「…」」逐段走——先出每段前面的「画面」（它接成这一段的首帧），再出视频；图片与视频都单独确认方案与费用。`);
        } catch (e) {
          if (alive.current) patchScriptDialog({ busy: false, error: e?.message || "脚本节点没建出来。" });
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
          setError(e?.message || "切换素材端口未完成。");
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
              label: "参考图",
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
          setNotice("已新建参考图节点并接到本节点的「参考图」端口：点它的「制作」生成图片，生成前仍要单独确认方案与费用。");
        } catch (e) {
          setError(e?.message || "新建参考图节点未完成。");
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
          setNotice("画布已删除；已生成的成果素材文件仍保留在插件数据目录，便于另行取用。");
        } catch (e) {
          setConfirmDelete(false);
          setError(e?.message || "删除画布失败");
        }
      }, [canvas, list, load]);
      const commitRename = React.useCallback(async () => {
        if (!canvas || !inline) return;
        const name = String(inline.value || "").trim();
        if (!name) {
          setInline(null);
          setError("画布名不能为空，已保留原名。");
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
          setError(e?.message || "改名未保存，已保留原名。");
        }
      }, [canvas, inline, refresh]);
      const submitCreate = React.useCallback(async () => {
        if (!createDialog) return;
        const name = String(createDialog.value || "").trim();
        if (!name) {
          setCreateDialog({ ...createDialog, error: "画布名不能为空" });
          return;
        }
        try {
          const { canvas: made } = await rpc("create", { name });
          setCreateDialog(null);
          await load(made.projectId);
          setNotice("已新建流程画布：可以加节点开始画布内的制作，也可以直接用于既有创作项目。");
        } catch (e) {
          setCreateDialog({ ...createDialog, error: e?.message || "新建画布未完成。" });
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
          if (alive.current) patchDialog({ busy: false, message: e?.message || "制作方案未生成。" });
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
          if (alive.current) patchDialog({ busy: false, message: e?.message || "制作未提交。" });
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
          if (alive.current) patchDialog({ busy: false, message: e?.message || "操作未完成。" });
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
            text: STAGE_STATE_TEXT[state] || "待制作",
            className: state === "done" ? "mov-chip mov-chip-ok" : state === "pending" ? "mov-chip movc-badge" : `mov-chip movc-stage-${state === "active" ? "active" : "review"}`
          };
        }
        if (materialOf(node)) return { text: "素材", className: "mov-chip movc-badge" };
        return achieved(node) ? { text: "已完成", className: "mov-chip mov-chip-ok" } : { text: "待制作", className: "mov-chip movc-badge" };
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
        readinessErrors ? `${readinessErrors} 处错误` : "",
        readinessWarnings ? `${readinessWarnings} 处提醒` : "",
        readinessNotes ? `${readinessNotes} 处提示` : ""
      ].filter(Boolean).join("、");
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
        { key: "shots", ok: storyboardReady, label: "「确认镜头」", hint: "至少已切出 1 段制作内容" },
        {
          key: "assets",
          ok: assetsReady || ["not_needed", "text_only"].includes(String(stageFactsOf("requirement").choice || "")),
          label: "「准备素材」",
          hint: `为角色图 / 首帧 / 参考图准备形象图（当前 ${stageStats.assets} 张）`
        },
        { key: "cost", ok: true, label: "「确认费用」", hint: "每段生成前仍要单独确认方案与费用" }
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
          setNotice("脚本审核已通过：画布上的阶段卡②标为已完成。接着点「看估价」核对整条链路，或点「做这一段」逐段生成，每段仍要单独确认方案与费用。");
        } catch (e) {
          setError(e?.message || "脚本审核没记上，请重试。");
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
          setNotice("这份脚本按场景与句子切段，没有单独的分镜节点；每段提示词在对应的制作节点里。");
          return;
        }
        if (key === "assets") {
          const node = (canvas.nodes || {})[nextStep?.id];
          if (!node) {
            setNotice("制作段都已有成果；要补素材，点某个节点自己的「制作」，在窗口里用「导入图片素材」或「新建参考图节点」。");
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
          setNotice("制作段都已有成果；要重做某一段，点那个节点自己的「制作」，重新核对方案并确认费用。");
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
        dialog.stage === "edit" ? h("label", { key: "text", className: "movc-field" }, ["节点内容", h("textarea", { value: dialog.form.text, onChange: (e) => patchDialog({ form: { ...dialog.form, text: e.target.value } }) })]) : h("label", { key: "prompt", className: "movc-field" }, ["本次要生成的画面 / 续拍内容", h("textarea", { value: dialog.form.prompt, placeholder: "写清主体、动作、镜头与声音；留空会用节点与上游脚本文本。", onChange: (e) => patchDialog({ form: { ...dialog.form, prompt: e.target.value } }) })]),
        dialog.type === "video" && dialog.stage !== "edit" ? h("div", { key: "spec", className: "movc-row" }, [
          h("label", { key: "ratio", className: "movc-field" }, ["画幅", h("select", { value: dialog.form.ratio, onChange: (e) => patchDialog({ form: { ...dialog.form, ratio: e.target.value } }) }, RATIOS.map((r) => h("option", { key: r, value: r }, r)))]),
          h("label", { key: "duration", className: "movc-field" }, ["本段时长（秒）", h("input", { type: "number", min: 4, value: dialog.form.duration, onChange: (e) => patchDialog({ form: { ...dialog.form, duration: e.target.value } }) })]),
          h("label", { key: "resolution", className: "movc-field" }, ["清晰度", h("select", { value: dialog.form.resolution, onChange: (e) => patchDialog({ form: { ...dialog.form, resolution: e.target.value } }) }, RESOLUTIONS.map((r) => h("option", { key: r, value: r }, r.toUpperCase())))])
        ]) : null,
        dialog.type === "video" && dialog.stage !== "edit" ? h("label", { key: "audio", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.form.generateAudio === true, onChange: (e) => patchDialog({ form: { ...dialog.form, generateAudio: e.target.checked } }) }), " 本次生成音频"]) : null,
        // 参考素材在制作窗口里就地补充：导入自己的图片，或新建一个图片节点去生成参考图。
        dialog.type === "video" && dialog.stage === "form" ? h("div", { key: "refs-add", className: "movc-row" }, [
          h("button", { key: "import", type: "button", className: "mov-btn", disabled: importing, title: "把自己的图片写进画布数据目录，并接到本节点的「参考图」端口", onClick: () => importRef.current?.click() }, importing ? "导入中…" : "导入图片素材"),
          h("button", { key: "image-node", type: "button", className: "mov-btn", title: "新建一个图片节点并接到本节点的「参考图」端口，在它自己的「制作」里生成参考图", onClick: () => void addReferenceImage(dialog.nodeId) }, "新建参考图节点"),
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
        dialog.stage === "plan" && dialog.plan?.operation === "extend" ? h("label", { key: "transition", className: "movc-field" }, ["上一段结尾到本段的衔接描述", h("textarea", { value: dialog.form.transitionDescription, onChange: (e) => patchDialog({ form: { ...dialog.form, transitionDescription: e.target.value } }) })]) : null,
        mediaInbound.length ? h("div", { key: "ports", className: "movc-plan" }, [
          h("div", { key: "hint" }, "上游素材端口：「首帧」用一张图开画，「参考图」按参考素材参与生成；两者不能同时使用。"),
          ...mediaInbound.map((edge) => h("div", { key: edge.id, className: "movc-row" }, [
            h("span", { key: "name" }, labelOf((canvas?.nodes || {})[edge.fromNode])),
            h(
              "select",
              { key: "port", value: edge.toPort, onChange: (e) => void setEdgePort(edge, e.target.value) },
              ["ref", "frame"].map((port) => h("option", { key: port, value: port }, port === "frame" ? "首帧" : "参考图"))
            ),
            h("button", { key: "off", type: "button", className: "mov-btn movc-danger", onClick: () => void removeEdge(edge.id) }, "断开")
          ]))
        ]) : null
      ]) : null;
      const planView = dialog?.stage === "plan" && dialog.plan ? h("div", { key: "plan", className: "movc-plan" }, [
        h("div", { key: "prompt", style: { whiteSpace: "pre-wrap", maxHeight: "26vh", overflow: "auto" } }, dialog.plan.prompt),
        h("div", { key: "spec" }, `${dialog.plan.model} · ${dialog.plan.ratio}${dialog.plan.duration ? ` · ${dialog.plan.duration}秒 · ${String(dialog.plan.resolution).toUpperCase()} · 音频${dialog.plan.generateAudio ? "开" : "关"}` : " · 2048×2048"}`),
        h("div", { key: "refs" }, dialog.plan.references?.length ? `参考素材：${dialog.plan.references.map((r) => `${r.port}←${r.nodeId}`).join("、")}` : "无参考素材（纯文本生成）"),
        h("div", { key: "cost" }, dialog.plan.estimate ? `预估费用：${money2(dialog.plan.estimate.cny)}（基础公式估价，实际按渠道账单结算）` : "当前价目未知：确认后按实际调用计费，不编造金额。"),
        ...(dialog.plan.notes || []).map((note, index) => h("div", { key: `n${index}` }, note))
      ]) : null;
      const jobView = dialog?.stage === "job" && dialog.job ? h("div", { key: "job" }, [
        h("div", { key: "state", className: "movc-plan" }, [
          h("div", { key: "s" }, `${dialog.job.operation === "extend" ? "续拍" : "生成"} · ${phaseText(dialog.job.state)}${dialog.job.taskId ? ` · 任务 ${dialog.job.taskId}` : ""}`),
          h("div", { key: "r" }, `结果审核：${dialog.job.reviewed ? "已通过" : "未通过"}；回填：${dialog.job.sync?.status || (dialog.job.media?.length ? "待回填" : "无成果")}`),
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
          dialog.job.media?.length && !dialog.job.reviewed ? h("button", { key: "ok", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void act("review", { accept: true }) }, "确认结果并继续") : null,
          dialog.job.media?.length && !dialog.job.reviewed ? h("button", { key: "no", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void closeDialog() }, "不通过（保留成果）") : null,
          dialog.job.sync?.status !== "synced" && dialog.job.media?.length ? h("button", { key: "sync", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void act("sync") }, "补回填画布") : null,
          ["unknown", "interrupted", "submission_unknown"].includes(dialog.job.state) ? h("button", { key: "query", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => void act("query") }, "查询原任务") : null,
          dialog.type === "video" && dialog.job.reviewed && dialog.job.media?.length ? h("button", { key: "extend", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", plan: null }) }, "续拍下一段") : null,
          dialog.job.state !== "running" ? h("button", { key: "again", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", job: null, plan: null }) }, "重新生成（重新确认费用）") : null
        ])
      ]) : null;
      return h("section", { className: ROOT_CLASS }, [
        h("style", { key: "css" }, PAGE_CSS + CSS),
        h("div", { key: "title", className: "mov-section-title" }, "流程画布"),
        // 画布操作全部放最上面：先选画布、再操作当前画布，画布区只负责画本事。
        h("div", { key: "top", className: "movc-top" }, [
          h("div", { key: "ops", className: "movc-bar movc-ops" }, [
            canvas ? h("span", { key: "name", className: "movc-name" }, inline ? [
              h("input", {
                key: "input",
                autoFocus: true,
                value: inline.value,
                "aria-label": "画布名称",
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
              h("button", { key: "text", type: "button", className: "movc-name-text", title: "双击画布名重命名", onDoubleClick: () => setInline({ value: canvas.name || "", error: "" }) }, canvas.name || canvas.projectId),
              h("button", { key: "edit", type: "button", className: "movc-mini", title: "重命名", onClick: () => setInline({ value: canvas.name || "", error: "" }) }, "✎")
            ]) : h("span", { key: "name-empty", className: "movc-name-empty" }, "未选择画布"),
            h("span", { key: "sep-a", className: "movc-sep" }),
            h("button", { key: "new-canvas", type: "button", className: "mov-btn mov-btn-primary", onClick: () => setCreateDialog({ value: "", error: "" }) }, "新建画布…"),
            canvas ? h("span", { key: "sep-b", className: "movc-sep" }) : null,
            canvas ? h("button", { key: "chain", type: "button", className: "mov-btn", title: "一次确认整条链路的方案与总费用，按顺序逐段生成；每段成果仍需你审核", onClick: () => void openChain() }, "连拍") : null,
            canvas ? h("button", {
              key: "merge-film",
              type: "button",
              className: "mov-btn movc-run",
              disabled: Boolean(filmDialog?.busy) || !film?.total,
              title: film?.missing?.length ? `还有 ${film.missing.length} 段没有成果：${film.missing.join("、")}` : film?.total ? "把已生成的每段视频按连线顺序拼成一条成片，只需一次确认" : "画布上还没有视频节点",
              onClick: () => void mergeFilm()
            }, filmDialog?.busy ? "合成中…" : "合成成片") : null,
            canvas ? h("span", { key: "sep-flow", className: "movc-sep" }) : null,
            canvas ? h(
              "button",
              {
                key: "run-next",
                type: "button",
                className: "mov-btn movc-run",
                disabled: !nextStep,
                title: nextStep ? `当前读取节点内容并沿上游拼接提示词，生成前仍需确认方案与费用` : "流程里的制作节点都已有成果",
                onClick: () => {
                  const node = (canvas?.nodes || {})[nextStep?.id];
                  if (node) void openDialog(node);
                }
              },
              nextStep ? `制作「${labelOf((canvas?.nodes || {})[nextStep.id])}」` : "流程已完成"
            ) : null,
            canvas && steps.length ? h("span", { key: "flow-progress", className: "movc-flow" }, `流程进度 ${doneSteps}/${steps.length}${nextStep ? "" : " · 全部有成果"}`) : null,
            canvas ? h("span", { key: "sep-c", className: "movc-sep" }) : null,
            canvas ? h("button", { key: "refresh", type: "button", className: "mov-btn", onClick: () => void refresh() }, "刷新") : null,
            canvas ? h("button", { key: "tidy", type: "button", className: "mov-btn", title: "按连线重排节点、自动留白对齐并适配视图，不改内容与连线", onClick: () => void tidy() }, "美化布局") : null,
            canvas ? h("button", { key: "reset", type: "button", className: "mov-btn", title: "把视图恢复到默认位置；带流程阶段条时按整张图适配", onClick: () => stageNodes.length ? fitStage(canvas, {}) : setView({ x: 30, y: 24, scale: 1 }) }, "重置视图") : null,
            canvas ? h("button", { key: "export", type: "button", className: "mov-btn", onClick: () => exportCanvas() }, "导出 JSON") : null,
            canvas ? h("span", { key: "sep-d", className: "movc-sep" }) : null,
            canvas && selectedIds.length ? h("button", { key: "del-selected", type: "button", className: "mov-btn movc-danger", onClick: () => void removeNodes(selectedIds) }, `删除选中（${selectedIds.length}）`) : null,
            canvas ? h("button", { key: "del-canvas", type: "button", className: "mov-btn movc-danger", onClick: () => setConfirmDelete(true) }, "删除画布") : null
          ]),
          h("div", { key: "picker", className: "movc-bar movc-picker" }, [
            h("span", { key: "pick-label", className: "movc-pick" }, "选择画布"),
            list.length ? h("div", { key: "list", className: "movc-list" }, list.map((item) => h(
              "button",
              { key: item.projectId, type: "button", className: "movc-chip", "data-active": String(canvas?.projectId === item.projectId), onClick: () => void load(item.projectId) },
              `${item.name} · ${item.nodeCount} 节点`
            ))) : h("span", { key: "no-canvas", className: "movc-hint" }, "暂无画布，点「新建画布…」创建一份空白文档。")
          ])
        ]),
        error ? h("p", { key: "error", className: "movc-hint" }, error) : null,
        !list.length ? h("p", { key: "empty", className: "movc-hint" }, "还没有流程画布：点「新建画布…」可以立刻创建一份空白文档；如果在设置页打开「自动创建流程画布」（默认关闭），普通创作确认需求后也会在这里自动建立，脚本审核后同步分镜与制作段计划，生成成果自动回填。") : null,
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
                      h("title", { key: "title" }, "点击断开这条连线")
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
                      title: scriptApproved ? "剧本已核对通过；点开可继续修改内容" : "核对过剧本与每段提示词后点这里：脚本审核通过，阶段卡②标为已完成",
                      onPointerDown: (e) => e.stopPropagation(),
                      onClick: (e) => {
                        e.stopPropagation();
                        if (scriptApproved) void openDialog(node);
                        else void confirmScript();
                      }
                    }, scriptApproved ? "已审核" : "确认脚本") : null,
                    h("button", { key: "edit", type: "button", className: "movc-mini", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      void openDialog(node);
                    } }, media ? "制作" : "编辑"),
                    h("button", { key: "copy", type: "button", className: "movc-mini", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      void duplicateNode(node);
                    } }, "复制"),
                    h("button", { key: "link", type: "button", className: "movc-mini", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      setConnectFrom(connectFrom === node.id ? "" : node.id);
                      setSelectedIds([node.id]);
                    } }, connectFrom === node.id ? "取消连线" : "连线"),
                    h("button", { key: "del", type: "button", className: "movc-mini movc-mini-danger", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
                      e.stopPropagation();
                      void removeNodes([node.id]);
                    } }, "删除")
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
          canvas && nodes.length ? h("button", { key: "flow-entry", type: "button", className: "movc-flow-entry", title: "跟对话一样两步走：先创建需求，再写脚本，然后铺开分镜与每段制作", onClick: (event) => {
            event.stopPropagation();
            void openFlow();
          } }, "＋ 创作流程") : null,
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
            h("strong", { key: "h" }, "点击画布开始创作"),
            h("span", { key: "p" }, "跟对话一样两步走：先创建需求，再写脚本，然后铺开整条生成流程——需求确认 → 剧本 → 分镜 → 每段制作 → 合成成片。生成前仍要逐段确认方案与费用。")
          ]) : null
        ]) : null,
        canvas?.film?.assetId ? h("div", { key: "film-bar", className: "movc-bar" }, [
          h("span", { key: "label", className: "movc-flow" }, `成片：${canvas.film.count} 段${canvas.film.seconds ? ` · 约 ${Math.round(canvas.film.seconds)} 秒` : ""} · ${new Date(canvas.film.updatedAt || Date.now()).toLocaleString()} · 已保存到画布数据目录`),
          h("button", { key: "play", type: "button", className: "mov-btn", onClick: () => setFilmDialog({ busy: false, film: { ...canvas.film, url: mediaUrl(canvas.film.assetId) }, message: "" }) }, "播放成片"),
          h("a", { key: "download", className: "movc-link", href: mediaUrl(canvas.film.assetId), download: `${String(canvas.name || "成片")}.mp4` }, "下载成片")
        ]) : null,
        canvas && steps.length ? h("p", { key: "flow-hint", className: "movc-hint" }, nextStep ? `流程：按连线顺序逐个制作，当前轮到「${nextStep.label}」（画布上虚线框标出）。点「制作「${nextStep.label}」」会读取节点内容与上游剧本/分镜拼出提示词，仍然要先核对制作方案、单独确认费用才会调用模型。` : `流程：${steps.length} 个制作节点都已有回填成果。要重做某一段，点该节点里的「制作」，重新核对方案并确认费用。`) : null,
        stageNodes.length ? h("p", { key: "stage-hint", className: "movc-hint" }, "画布上的七张「流程阶段」卡就是这条生成流程，箭头表示先后，步骤跟对话与专业画布一致：① 填需求（写想法/时长/画幅/清晰度，只建需求节点与阶段卡，不调用模型）→ ② 写脚本（没有脚本时）/确认脚本（写好看）/看剧本（通过后）→ ③ 看分镜（没有分镜时是「生成分镜」）→ ④ 准备素材（角色图/首帧/参考图）→ ⑤ 看估价 → ⑥ 做这一段 → ⑦ 合成成片。状态由插件同步，当前阶段用虚线框标出；卡上的按钮只是入口，生成前仍要逐段核对方案、单独确认费用，卡本身不参与生成。") : null,
        canvas && readiness.length ? h("p", { key: "health", className: "movc-hint" }, `画布体检：${readinessBrief}——${readiness[0].message}${chainable ? "点「连拍」可以看到完整清单与处理建议；" : ""}这里只提示画布内容问题，不涉及费用与审核。`) : null,
        canvas ? h("p", { key: "hint", className: "movc-hint" }, `点击画布空白处就会打开「创作流程」面板（有选中的节点时先取消选择）；拖动空白处平移、滚轮缩放，拖动节点移动（拖动已选中的任一节点可整组移动），Shift+拖空白框选（Shift+点节点可加选），点「连线」后再点目标节点连接（点连线可断开）；想一次确认整条链路再逐段生成就点「连拍」，参考素材在视频节点的制作窗口里用「导入图片素材」或「新建参考图节点」补，每段都出成果后点「合成成片」拼成一条可预览、可下载的成片。数据目录：${canvas.dataRoot}（素材与成果由本插件保存）`) : null,
        connectFrom ? h("p", { key: "connect", className: "movc-hint" }, "连线模式：点击目标节点完成连接，点空白处取消。") : null,
        confirmDelete ? h(
          "div",
          { key: "delete-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget) setConfirmDelete(false);
          } },
          h("div", { key: "body", className: "movc-modal-body", style: { width: "min(420px, calc(100vw - 32px))" } }, [
            h("h4", { key: "h" }, "删除画布"),
            h("p", { key: "ask", className: "movc-status" }, `确定删除「${canvas?.name || ""}」吗？画布上的节点与连线会一起删除，且不会自动重建；已生成的成果素材文件仍保留在插件数据目录。`),
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", onClick: () => setConfirmDelete(false) }, "取消"),
              h("button", { key: "ok", type: "button", className: "mov-btn", onClick: () => void deleteCanvas() }, "确认删除")
            ])
          ])
        ) : null,
        filmDialog ? h(
          "div",
          { key: "film-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget && !filmDialog.busy) setFilmDialog(null);
          } },
          h("div", { key: "body", className: "movc-modal-body" }, [
            h("h4", { key: "h" }, "合成成片"),
            filmDialog.busy ? h("p", { key: "busy", className: "movc-status" }, "正在按连线顺序读取每段成果并合并，长视频需要一点时间…") : null,
            filmDialog.film?.url ? h("video", { key: "player", src: filmDialog.film.url, controls: true, preload: "metadata", className: "movc-media", style: { maxHeight: "46vh" } }) : null,
            filmDialog.film ? h(
              "p",
              { key: "info", className: "movc-status" },
              `成片：${filmDialog.film.count} 段${filmDialog.film.seconds ? ` · 约 ${Math.round(filmDialog.film.seconds)} 秒` : ""}；文件已保存到画布数据目录，可直接预览或下载。`
            ) : null,
            filmDialog.film?.segments?.length ? h(
              "div",
              { key: "segs", className: "movc-plan" },
              filmDialog.film.segments.map((segment) => h(
                "div",
                { key: `s${segment.index}` },
                `第${segment.index}段「${segment.label}」${segment.seconds ? `${segment.seconds}秒` : ""}`
              ))
            ) : null,
            filmDialog.message ? h("p", { key: "msg", className: "movc-status", "data-error": "true" }, filmDialog.message) : null,
            h("p", { key: "note", className: "movc-status" }, "合成只读取已经生成的成果，不会重新生成任何段落，也不产生新的模型费用。"),
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "close", type: "button", className: "mov-btn", disabled: filmDialog.busy, onClick: () => setFilmDialog(null) }, "关闭"),
              filmDialog.film?.url ? h("a", { key: "download", className: "movc-link", href: filmDialog.film.url, download: `${String(canvas?.name || "成片")}.mp4` }, "下载成片") : null,
              !filmDialog.busy ? h("button", { key: "again", type: "button", className: "mov-btn mov-btn-primary", onClick: () => void mergeFilm() }, "重新合成") : null
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
            h("h4", { key: "h" }, "连拍：一次确认，逐段生成"),
            chainDialog.loading ? h("p", { key: "loading", className: "movc-status" }, "正在按画布上的视频节点排连拍方案…") : null,
            chainDialog.plan ? h("div", { key: "plan", className: "movc-plan" }, [
              h("div", { key: "head" }, chainPlanPending ? `连拍方案：本次生成 ${chainPlanPending} 段${chainDialog.plan.segments.length > chainPlanPending ? `（另有 ${chainDialog.plan.segments.length - chainPlanPending} 段已有成果，跳过不重复生成）` : ""}${chainDialog.plan.cny !== null ? ` · 预估 ¥${(Math.round(chainDialog.plan.cny * 1e4) / 1e4).toFixed(4)}（基础公式，按渠道账单结算）` : " · 按实际调用计费"}${chainDialog.plan.priceDate ? ` · 价目 ${chainDialog.plan.priceDate}` : ""}` : `连拍方案：整条链路 ${chainDialog.plan.segments.length} 段都已有成果，没有要生成的了`),
              ...chainDialog.plan.segments.map((segment) => h(
                "div",
                { key: `s${segment.index}`, ...segment.skip ? { "data-skip": "true" } : {} },
                segment.skip ? `✓ 第${segment.index + 1}段「${segment.label}」${segment.seconds}秒：已有成果，本次跳过（不重复生成、不重复计费）` : `第${segment.index + 1}段「${segment.label}」${segment.seconds}秒 · ${segment.operation === "extend" ? "续拍上一段" : "首段直出"} · ${segment.ratio} ${String(segment.resolution).toUpperCase()}：${String(segment.prompt).slice(0, 70)}${String(segment.prompt).length > 70 ? "…" : ""}`
              )),
              h("div", { key: "note" }, "没有成果的段才会生成：接着已有成果的段落续拍，整条链路一段成果都没有时第 1 段直出；每段出成果后都会停下来等你审核，审核通过才继续下一段。已有成果的段不重复生成，也不重复计费。")
            ]) : null,
            chainDialog.chain ? h("div", { key: "chain", className: "movc-plan" }, [
              h("div", { key: "head" }, `${chainStatusText(chainDialog.chain)}`),
              chainDialog.chain.segments.map((segment) => h(
                "div",
                { key: `c${segment.index}` },
                `${segment.index < chainDialog.chain.done ? "✓ " : segment.index === chainDialog.chain.index ? "▶ " : "· "}第${segment.index + 1}段「${segment.label}」${segment.seconds}秒${segment.skip ? "：已有成果，本次跳过" : segment.index < chainDialog.chain.done ? "：已有成果" : ""}`
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
            chainDialog.chain && chainDialog.chain.state === "review" ? h("p", { key: "review-note", className: "movc-status" }, "先看这一段：满意就「确认并继续下一段」，不满意可以停止连拍，已生成的成果都保留在画布上。") : null,
            chainDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, chainDialog.error) : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("div", { key: "batch-checks", className: "movc-plan" }, [
              h("div", { key: "head" }, "开始批量生成前，请先完成："),
              ...batchChecks.map((item) => h(
                "div",
                { key: item.key, "data-batch-check": item.key, "data-ok": String(item.ok) },
                `${item.ok ? "✓ " : "· "}${item.label}— ${item.hint}`
              )),
              h("div", { key: "tail" }, "这几项都就绪后再开始连拍；每段出成果仍会停下来等你审核。")
            ]) : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("div", { key: "readiness", className: "movc-plan" }, [
              h("div", { key: "head" }, readiness.length ? `画布体检：还有 ${readiness.length} 处没准备齐` : "画布体检：没有发现问题"),
              ...readiness.slice(0, 6).map((item) => h(
                "div",
                {
                  key: `${item.code}-${item.nodeId}`,
                  "data-readiness": item.code,
                  "data-severity": item.severity
                },
                `${item.severity === "error" ? "✕ " : "· "}${item.message}${item.suggestedAction}`
              )),
              readiness.length > 6 ? h("div", { key: "more" }, `还有 ${readiness.length - 6} 处，先处理上面这些。`) : null,
              h("div", { key: "tail" }, "体检只看画布内容：缺成果的段、没接到制作段的素材、断掉的连线，以及成片段数和现在的视频成果对不上。费用与审核仍按每段自己确认。")
            ]) : null,
            chainDialog.plan && !chainDialog.chain && !chainPlanPending ? h("p", { key: "nothing", className: "movc-status" }, "整条链路的视频段都已有成果，不需要再连拍；要重做哪一段，就点那个节点自己的「制作」。") : null,
            chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("div", { key: "confirms" }, [
              h("label", { key: "p", className: "movc-check" }, [h("input", { type: "checkbox", checked: chainDialog.confirm.plan === true, onChange: (e) => patchChainDialog({ confirm: { ...chainDialog.confirm, plan: e.target.checked } }) }), " 我已核对整条链路的方案（每段提示词、时长、画幅与清晰度）"]),
              h("label", { key: "c", className: "movc-check" }, [h("input", { type: "checkbox", checked: chainDialog.confirm.cost === true, onChange: (e) => patchChainDialog({ confirm: { ...chainDialog.confirm, cost: e.target.checked } }) }), " 我已确认整条链路的预估费用，按渠道账单结算"])
            ]) : null,
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "close", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => {
                stopChainPolling();
                setChainDialog(null);
              } }, "关闭"),
              chainDialog.chain?.state === "running" ? h("button", { key: "stop", type: "button", className: "mov-btn movc-danger", disabled: chainDialog.busy, onClick: () => void stopChain() }, "停止连拍") : null,
              chainDialog.chain?.state === "review" && chainDialog.chain.job?.sync?.status !== "synced" ? h("button", { key: "sync", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => void syncChainSegment() }, "补回填画布") : null,
              chainDialog.chain?.state === "review" ? h("button", { key: "stop2", type: "button", className: "mov-btn movc-danger", disabled: chainDialog.busy, onClick: () => void stopChain() }, "停止连拍") : null,
              chainDialog.chain?.state === "review" ? h("button", { key: "next", type: "button", className: "mov-btn mov-btn-primary", disabled: chainDialog.busy, onClick: () => void advanceChain(true) }, "确认并继续下一段") : null,
              chainDialog.plan && !chainDialog.chain && chainPlanPending ? h("button", { key: "start", type: "button", className: "mov-btn mov-btn-primary", disabled: chainDialog.busy || !(chainDialog.confirm.plan && chainDialog.confirm.cost), onClick: () => void startChain() }, "确认并开始连拍") : null,
              chainDialog.chain && ["done", "stopped", "stale"].includes(chainDialog.chain.state) && chainDialog.plan ? h("button", { key: "again", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => void openChain() }, "重新看方案") : null,
              chainDialog.chain && chainDialog.chain.state === "done" ? h("button", { key: "close2", type: "button", className: "mov-btn", disabled: chainDialog.busy, onClick: () => {
                stopChainPolling();
                setChainDialog(null);
              } }, "完成") : null
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
            h("h4", { key: "h" }, "创建需求"),
            h("p", { key: "flow-note", className: "movc-status" }, "跟对话一样先确认需求：写下想拍什么与规格，创建后阶段卡①标为已完成；再点一次画布或阶段卡②写脚本。这一步只建需求节点与阶段卡，不调用任何模型、不产生视频费用。"),
            h("label", { key: "idea", className: "movc-field" }, ["想拍什么", h("input", {
              value: scriptDialog.idea,
              placeholder: "一句话就够，例如：青旅天台的清晨，一个人拖着行李住进城市。",
              onChange: (e) => patchScriptDialog({ idea: e.target.value, error: "" })
            })]),
            h("label", { key: "work-type", className: "movc-field" }, ["作品类型", h("select", { value: scriptDialog.workType || "", onChange: (e) => patchScriptDialog({ workType: e.target.value }) }, [h("option", { key: "unspecified", value: "" }, "未指定，保留原意"), ...availableProfiles().map((p) => h("option", { key: p.work_type, value: p.work_type }, p.label))])]),
            h("div", { key: "spec", className: "movc-row" }, [
              h("label", { key: "total", className: "movc-field" }, ["目标总时长（秒）", h("input", { type: "number", min: 4, max: 3600, value: scriptDialog.totalSeconds, onChange: (e) => patchScriptDialog({ totalSeconds: e.target.value }) })]),
              h("label", { key: "segment", className: "movc-field" }, ["每段时长（秒）", h("input", { type: "number", min: 4, max: scriptDialog.singleMax || 15, value: scriptDialog.segmentSeconds, onChange: (e) => patchScriptDialog({ segmentSeconds: e.target.value }) })])
            ]),
            h("div", { key: "spec2", className: "movc-row" }, [
              h("label", { key: "ratio", className: "movc-field" }, ["画幅", h("select", { value: scriptDialog.ratio, onChange: (e) => patchScriptDialog({ ratio: e.target.value }) }, RATIOS.map((r) => h("option", { key: r, value: r }, r)))]),
              h("label", { key: "resolution", className: "movc-field" }, ["清晰度", h("select", { value: scriptDialog.resolution, onChange: (e) => patchScriptDialog({ resolution: e.target.value }) }, RESOLUTIONS.map((r) => h("option", { key: r, value: r }, r.toUpperCase())))])
            ]),
            h("p", { key: "note", className: "movc-status" }, `当前模型单段上限 ${scriptDialog.singleMax || 15} 秒：目标时长不超过上限只建一段，超过才按每段时长排续拍段。需求确认后仍要逐段核对方案、单独确认费用。`),
            scriptDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, scriptDialog.error) : null,
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", disabled: scriptDialog.busy, onClick: () => setScriptDialog(null) }, "取消"),
              h("button", { key: "ok", type: "button", className: "mov-btn mov-btn-primary", disabled: scriptDialog.busy, onClick: () => void createRequirement() }, scriptDialog.busy ? "创建中…" : "创建需求")
            ])
          ] : [
            // 第二步：按第一步的需求写脚本，预览分段后再铺制作节点。
            h("h4", { key: "h" }, "写脚本"),
            h("p", { key: "flow-note", className: "movc-status" }, "按第一步创建的需求写剧本与分镜：可以自己写，也可以让文本模型写。先「预览分段」看清会被拆成几段、每段多少秒与提示词，再「生成制作节点」；节点建好后仍要逐段核对方案、单独确认费用。"),
            h("div", { key: "need", className: "movc-plan" }, [
              h("div", { key: "brief" }, `需求：${String(scriptDialog.idea || "").trim() || "（需求节点里没有写下想法，先补一句）"}`),
              h("div", { key: "spec" }, `目标 ${scriptDialog.totalSeconds} 秒 · 每段 ${scriptDialog.segmentSeconds} 秒 · ${scriptDialog.ratio} · ${String(scriptDialog.resolution).toUpperCase()}${scriptDialog.textModel ? ` · 文本模型 ${scriptDialog.textModel}` : ""}`)
            ]),
            !String(scriptDialog.idea || "").trim() ? h("label", { key: "idea", className: "movc-field" }, ["想拍什么（让文本模型写脚本用）", h("input", {
              value: scriptDialog.idea,
              placeholder: "一句话就够，例如：青旅天台的清晨，一个人拖着行李住进城市。",
              onChange: (e) => patchScriptDialog({ idea: e.target.value, error: "" })
            })]) : null,
            h("label", { key: "text", className: "movc-field" }, ["脚本内容（可以直接写，也可以让文本模型写）", h("textarea", {
              value: scriptDialog.text,
              placeholder: "写下要拍的内容。写成 Markdown 分镜表（表头含「镜号」「镜别」「视角」「运镜」「画面」列）时会按分镜切段，镜别、视角与运镜会一起带进该段提示词；否则按句子、段落按字数均分。写多少拆多少，不自动编内容。",
              onChange: (e) => patchScriptDialog({ text: e.target.value, error: "" })
            })]),
            h("p", { key: "note", className: "movc-status" }, `「AI 写脚本」会按设置页的文本模型（${scriptDialog.textModel || "文本模型"}）把需求写成剧本与分镜表，单独按文本计费；要改时长、画幅或清晰度，先回上一步「改需求」。${scriptDialog.writing ? ` 文本模型正在写：已等待 ${Math.max(0, Math.round((clock - (scriptDialog.writingSince || clock)) / 1e3))} 秒（一次通常 30–90 秒，可以先去别的地方看看）。` : ""}`),
            scriptDialog.plan ? h("div", { key: "plan", className: "movc-plan" }, [
              h("div", { key: "head" }, `分段计划：${scriptDialog.plan.segments.length} 段 · 共 ${scriptDialog.plan.totalSeconds} 秒${scriptDialog.plan.shots?.length ? ` · 识别到 ${scriptDialog.plan.shots.length} 个分镜` : ""}`),
              ...scriptDialog.plan.segments.map((segment, index) => h("div", { key: `s${index}` }, `第${index + 1}段 ${segment.seconds} 秒（${segment.kind === "extend" ? "续拍" : "首段"}）：${String(segment.prompt).slice(0, 90)}${String(segment.prompt).length > 90 ? "…" : ""}`))
            ]) : null,
            scriptDialog.error ? h("p", { key: "err", className: "movc-status", "data-error": "true" }, scriptDialog.error) : null,
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", disabled: scriptDialog.busy, onClick: () => setScriptDialog(null) }, "取消"),
              h("button", { key: "write", type: "button", className: "mov-btn", disabled: scriptDialog.busy, title: "用设置页里配置的文本模型把需求写成剧本与分镜表，会调用一次文本模型", onClick: () => void writeWithModel() }, scriptDialog.writing ? "正在写脚本…" : "AI 写脚本"),
              h("button", { key: "preview", type: "button", className: "mov-btn", disabled: scriptDialog.busy, onClick: () => void previewScript() }, "预览分段"),
              h("button", { key: "ok", type: "button", className: "mov-btn mov-btn-primary", disabled: scriptDialog.busy, onClick: () => void createFromScript() }, "生成制作节点")
            ])
          ])
        ) : null,
        createDialog ? h(
          "div",
          { key: "create-modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget) setCreateDialog(null);
          } },
          h("div", { key: "body", className: "movc-modal-body", style: { width: "min(420px, calc(100vw - 32px))" } }, [
            h("h4", { key: "h" }, "新建画布"),
            h("label", { key: "name", className: "movc-field" }, ["画布名称", h("input", {
              autoFocus: true,
              value: createDialog.value,
              placeholder: "画布名称",
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
            h("p", { key: "note", className: "movc-status" }, "新画布是一份空白文档，与自动创建的画布并存；名称不能为空，也不能和已有画布重名。"),
            h("div", { key: "ops", className: "movc-bar" }, [
              h("button", { key: "cancel", type: "button", className: "mov-btn", onClick: () => setCreateDialog(null) }, "取消"),
              h("button", { key: "ok", type: "button", className: "mov-btn mov-btn-primary", onClick: () => void submitCreate() }, "新建画布")
            ])
          ])
        ) : null,
        selectedIds.length > 1 ? h("p", { key: "multi", className: "movc-hint" }, `已选中 ${selectedIds.length} 个节点：可整组拖动或删除。`) : null,
        notice ? h("p", { key: "notice", className: "movc-hint" }, notice) : null,
        dialog ? h(
          "div",
          { key: "modal", className: "movc-modal", onPointerDown: (e) => e.stopPropagation(), onClick: (e) => {
            if (e.target === e.currentTarget) closeDialog();
          } },
          h("div", { key: "body", className: "movc-modal-body" }, [
            h("h4", { key: "h" }, dialogNode ? `${labelOf(dialogNode)} · ${dialog.stage === "job" ? "制作记录与结果审核" : dialog.type === "video" || dialog.type === "image" ? "制作与费用确认" : "编辑节点内容"}` : "流程画布"),
            formFields,
            planView,
            jobView,
            dialog.message ? h("p", { key: "msg", className: "movc-status", "data-error": "true" }, dialog.message) : null,
            h("p", { key: "note", className: "movc-status" }, "生成前必须分别确认制作方案与费用；确认后才会调用模型。成果回填只新增成果节点，不代表结果已审核。"),
            h("div", { key: "ops", className: "movc-bar" }, [
              dialog.stage === "edit" ? h("button", { key: "save", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: async () => {
                patchDialog({ busy: true, message: "" });
                try {
                  await saveNode(dialog.nodeId, { data: { text: dialog.form.text } });
                  closeDialog();
                } catch (e) {
                  patchDialog({ busy: false, message: e?.message || "保存失败" });
                }
              } }, "保存内容") : null,
              dialog.stage === "form" ? h("button", { key: "gen", type: "button", className: "mov-btn mov-btn-primary", disabled: dialog.busy, onClick: () => void prepare("generate") }, "生成并确认费用") : null,
              dialog.job?.reviewed && dialog.stage === "job" ? h("button", { key: "extend-form", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", plan: null }) }, "续拍下一段") : null,
              dialog.stage === "form" && dialog.job?.reviewed ? h("button", { key: "extend", type: "button", className: "mov-btn mov-btn-primary", disabled: dialog.busy, onClick: () => void prepare("extend") }, "确认续拍与费用") : null,
              dialog.stage === "plan" ? h("button", { key: "confirm", type: "button", className: "mov-btn mov-btn-primary", disabled: dialog.busy || !(dialog.confirm.plan && dialog.confirm.cost), onClick: () => void start() }, "确认并开始") : null,
              dialog.stage === "plan" ? h("button", { key: "back", type: "button", className: "mov-btn", disabled: dialog.busy, onClick: () => patchDialog({ stage: "form", plan: null }) }, "返回修改") : null,
              h("button", { key: "close", type: "button", className: "mov-btn", onClick: () => closeDialog() }, "关闭")
            ]),
            dialog.stage === "plan" ? h("div", { key: "confirms" }, [
              h("label", { key: "p", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.confirm.plan === true, onChange: (e) => patchDialog({ confirm: { ...dialog.confirm, plan: e.target.checked } }) }), " 我已核对本次制作方案（节点内容、画幅、时长与清晰度）"]),
              h("label", { key: "c", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.confirm.cost === true, onChange: (e) => patchDialog({ confirm: { ...dialog.confirm, cost: e.target.checked } }) }), " 我已确认费用，按渠道账单结算"]),
              dialog.plan?.kind === "video" && dialog.plan?.operation === "generate" && !(dialog.plan?.references || []).length ? h("label", { key: "t", className: "movc-check" }, [h("input", { type: "checkbox", checked: dialog.confirm.textOnly === true, onChange: (e) => patchDialog({ confirm: { ...dialog.confirm, textOnly: e.target.checked } }) }), " 本次没有参考素材，确认按纯文生视频提交"]) : null
            ]) : null
          ])
        ) : null
      ]);
    }
    return { FlowCanvas };
  }

  // icon.svg
  var icon_default = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100" role="img" aria-label="MetaOnticVideo"><defs>\n<linearGradient id="a" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#36e8ee"/><stop offset=".5" stop-color="#1688ff"/><stop offset="1" stop-color="#1742e8"/></linearGradient>\n<linearGradient id="b" x1="0" y1="0" x2="1" y2="1"><stop stop-color="#341ad5"/><stop offset=".5" stop-color="#7635ff"/><stop offset="1" stop-color="#176bff"/></linearGradient>\n<linearGradient id="c" x1="1" y1="0" x2="0" y2="1"><stop stop-color="#2ce7ef"/><stop offset=".5" stop-color="#087bff"/><stop offset="1" stop-color="#2026ba"/></linearGradient>\n<linearGradient id="d" x1="0" y1="1" x2="1" y2="0"><stop stop-color="#24e5ec"/><stop offset=".45" stop-color="#1168ff"/><stop offset="1" stop-color="#2539d7"/></linearGradient>\n</defs>\n<path d="M9 25Q9 11 21 13L43 29 32 43 20 33V79Q20 85 14 85Q9 85 9 79Z" fill="url(#b)"/>\n<path d="M91 25Q91 11 79 13L43 39 57 53 80 35V78Q80 85 86 85Q91 85 91 79Z" fill="url(#c)"/>\n<path d="M10 23Q14 9 27 17L75 49Q79 52 75 56L43 77Q37 81 33 74L19 39Q15 27 10 23ZM40 40Q38 39 38 42V65Q38 68 41 66L59 54Q62 52 59 50Z" fill="url(#a)" fill-rule="evenodd"/>\n<path d="M75 49Q80 52 81 64L91 80Q89 88 82 84L62 70 43 77Q38 80 34 75Z" fill="url(#d)"/>\n<path d="M40 40Q38 39 38 42V65Q38 68 41 66L59 54Q62 52 59 50Z" fill="none"/>\n</svg>\n';

  // src/businesses/video-generation/client.ts
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
    const { PLUGIN_VERSION, UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2, UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2, fetchLatestVersion, fetchRecentVersions, PLUGIN_PACKAGE: PLUGIN_PACKAGE3, UPDATE_SPEC: UPDATE_SPEC2, UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2, isNewerVersion, updateBell } = createUpdates({ h });
    const { makePage } = createSettingsPage({ useSnapshot, React, h, TOKENS, same, validateSettings, persistConnection, PLUGIN_OWNED_KEYS, persistBatch, PLUGIN_VERSION, UPDATE_CACHE_KEY: UPDATE_CACHE_KEY2, UPDATE_MAX_AGE_MS: UPDATE_MAX_AGE_MS2, fetchLatestVersion, SELECTS, inputStyle, optionLabel, FIELD_BY_KEY, SECTIONS, formatMoney, PLUGIN_PACKAGE: PLUGIN_PACKAGE3, UPDATE_SPEC: UPDATE_SPEC2, UPDATE_ATTEMPTS: UPDATE_ATTEMPTS2, isNewerVersion, updateBell, PAGE_CSS });
    return {
      inject: ["slots", "locale", "configForms", "uiSession"],
      apply(ctx, { settings }) {
        ctx.effect(() => ctx.uiSession.provide({
          hooks: ["videoExecutions"],
          resolve: (binding) => ({ hooks: { videoExecutions: videoExecutionSource2(binding.eventSource) } })
        }), "metaontic-video: actual video execution");
        const t = ctx.locale.bind(NS);
        ctx.effect(() => ctx.locale.register(NS, { zh, en }), "metaontic-video: dictionaries");
        const SupportAction = createSupportAction({ React, t, PAGE_CSS });
        ctx.effect(() => ctx.slots.inject("plugins.detail.actions", () => ctx.slots.register({
          name: "plugins.detail.actions",
          id: "metaontic-video-support",
          locale: NS
        }, SupportAction)), "metaontic-video: support action");
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
            tried.push(`remote.pluginManager 抛错：${error && error.message ? error.message : String(error)}`);
          }
          try {
            const remote = typeof ctx.get === "function" ? ctx.get("remote") : void 0;
            const nested = remote && remote.pluginManager;
            if (nested && typeof nested.installBundle === "function") return { manager: nested, tried };
            tried.push(`remote=${shape(remote)}`);
          } catch (error) {
            tried.push(`remote 抛错：${error && error.message ? error.message : String(error)}`);
          }
          return { manager: null, tried };
        };
        const Page = makePage({ form, t, manager: pluginManager });
        settings.register({ id: "video", namespace: PLUGIN_PACKAGE3, locale: NS, Page });
        const FlowCanvasPage = FLOW_CANVAS_AVAILABLE ? createCanvasView({ React, h, TOKENS, PAGE_CSS }).FlowCanvas : null;
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
          pluginPackage: PLUGIN_PACKAGE3,
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
            openSettings: () => ctx.get("pluginNavigation")?.openBundle(PLUGIN_PACKAGE3),
            manager: pluginManager,
            // 面板顶部的更新入口：与设置页同一套两步确认，点左侧栏的「有更新」进来就能更新。
            updateBanner: () => h(UpdateHintBanner, { key: "update-hint" })
          })
        }, VideoPanel)), "metaontic-video: sidebar panel");
        const canvasSwitchOn = () => {
          try {
            return FLOW_CANVAS_AVAILABLE && form?.getSnapshot?.()?.value?.canvasEnabled === true;
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

  // src/platform/migration/bundle-inventory.ts
  var BundleInventoryError = class extends Error {
    constructor(code) {
      super(`Bundle inventory ${code}`);
      this.code = code;
    }
    code;
  };
  function assertMigrationActive(options) {
    if (options.signal?.aborted) throw new BundleInventoryError("aborted");
  }
  function readBundleInventory(manager, options = {}) {
    assertMigrationActive(options);
    return new Promise((resolve, reject) => {
      let settled = false;
      const finish = (error, rows) => {
        if (settled) return;
        settled = true;
        clearTimeout(timer);
        options.signal?.removeEventListener("abort", abort);
        error ? reject(error) : resolve(rows);
      };
      const abort = () => finish(new BundleInventoryError("aborted"));
      const timer = setTimeout(() => finish(new BundleInventoryError("timeout")), options.timeoutMs ?? 8e3);
      options.signal?.addEventListener("abort", abort, { once: true });
      let request;
      try {
        assertMigrationActive(options);
        request = manager.listBundles();
      } catch {
        finish(new BundleInventoryError(options.signal?.aborted ? "aborted" : "unavailable"));
        return;
      }
      Promise.resolve(request).then((result) => {
        const rows = Array.isArray(result) ? result : result?.ok === true ? result.value : null;
        if (!Array.isArray(rows)) finish(new BundleInventoryError("unavailable"));
        else finish(void 0, rows);
      }, () => finish(new BundleInventoryError(options.signal?.aborted ? "aborted" : "unavailable")));
    });
  }

  // src/platform/migration/bundle-identity.ts
  function hasLegacyBundleConflict(rows) {
    return rows.some((row) => row.name === PLUGIN_ID && row.installed === true && row.enabled === true) && rows.some((row) => row.name === PLUGIN_PACKAGE && row.installed === true && row.enabled === true);
  }
  async function disableLegacyBundle(manager, options = {}) {
    if (!hasLegacyBundleConflict(await readBundleInventory(manager, options))) return "ready";
    if (typeof manager.setBundleEnabled !== "function") throw new Error("Bundle migration unavailable");
    assertMigrationActive(options);
    const answer = await manager.setBundleEnabled(PLUGIN_ID, false);
    assertMigrationActive(options);
    const value = answer?.ok === true ? answer.value : answer;
    if (answer?.ok === false || value?.error || !value) throw new Error("Bundle migration rejected");
    if (value.application === "restart-required") return "restart-required";
    const rows = await readBundleInventory(manager, options);
    if (rows.some((row) => row.name === PLUGIN_ID && row.enabled === true) || !rows.some((row) => row.name === PLUGIN_PACKAGE && row.enabled === true)) throw new Error("Bundle migration not applied");
    return "ready";
  }
  function hasLegacyBundle(rows) {
    return rows.some((row) => row.name === PLUGIN_ID && row.installed === true);
  }
  async function cleanupLegacyBundle(manager, options = {}) {
    const rows = await readBundleInventory(manager, options);
    if (!hasLegacyBundle(rows)) return "ready";
    const current = rows.find((row) => row.name === PLUGIN_PACKAGE);
    const legacy = rows.find((row) => row.name === PLUGIN_ID);
    if (current?.installed !== true || current?.enabled !== true || legacy?.enabled !== false) return "retained";
    if (legacy.removable === false || typeof manager.removeBundle !== "function") return "manual";
    let answer;
    assertMigrationActive(options);
    try {
      answer = await manager.removeBundle(PLUGIN_ID);
    } catch {
      return "retained";
    }
    assertMigrationActive(options);
    const value = answer?.ok === true ? answer.value : answer;
    if (value?.error?.code === "stop-profile") return "stop-profile";
    if (value?.application === "restart-required") return "restart-required";
    if (answer?.ok === false || value?.error || !value) return "retained";
    const after = await readBundleInventory(manager, options);
    if (hasLegacyBundle(after)) return "retained";
    if (!after.some((row) => row.name === PLUGIN_PACKAGE && row.installed === true && row.enabled === true)) throw new Error("Current bundle unavailable");
    return "ready";
  }

  // src/ui/installation/bundle-migration.ts
  function migrationManager(ctx) {
    for (const read of [() => ctx.get?.("remote.pluginManager"), () => ctx.get?.("remote")?.pluginManager, () => ctx.remote?.pluginManager]) {
      try {
        const manager = read();
        if (typeof manager?.listBundles === "function") return manager;
      } catch {
      }
    }
    return null;
  }
  async function mountBundleAwareClient(ctx, React, mount) {
    const manager = migrationManager(ctx);
    if (!manager) return mount();
    const abort = new AbortController();
    const inventory = { signal: abort.signal };
    let checking = null;
    let alive = true, status = "checking", confirmed = false, running = null;
    const listeners = /* @__PURE__ */ new Set();
    const notify = () => {
      if (alive) for (const listener of listeners) listener();
    };
    const set = (next) => {
      if (alive) {
        status = next;
        notify();
      }
    };
    ctx.effect(() => () => {
      alive = false;
      abort.abort();
      listeners.clear();
    }, "video: migration lifetime");
    const ns = "settings.metaonticVideoMigration";
    ctx.effect(() => ctx.locale.register(ns, {
      zh: {
        title: "旧版插件迁移",
        checking: "正在检查插件安装状态…",
        conflict: "旧版 metaontic-video 和新版 dsh-metaontic-video 同时启用。更新或重启不会自动移除旧包，请完成迁移。",
        retained: "新版已可使用，但旧包仍在已安装列表中。可清理旧包，避免再次误启用。",
        ready: "迁移完成：已移除旧包，保留新版。",
        action: "切换并清理旧版",
        cleanup: "清理旧版安装包",
        switchOnly: "仅停用旧版并切换",
        working: "正在处理，请勿重复操作…",
        consent: "我已结束所有视频任务，同意停用并卸载旧包 metaontic-video。",
        preserved: "配置、API密钥、历史任务和素材继续保留；仅处理旧安装包。",
        failed: "迁移未完成，请重新检查。不会自动删除配置或重装插件。",
        blocked: "无法核实安装状态，请重新检查；暂不清理旧包。",
        timeout: "安装状态查询超时，请点击重新检查。暂不执行停用或卸载，迟到的查询结果不会继续操作。",
        restart: "宿主要求重启以完成切换。请先保存工作，重启后回到此处检查并继续清理。",
        stop: "新版已可使用，旧包已停用；宿主要求先退出当前运行环境才能卸载。请在插件管理中完成旧包卸载，不要删除配置或任务目录。",
        manual: "新版已可使用；当前宿主不支持在这里卸载旧包，请到插件管理中卸载 metaontic-video。",
        cleanupFailed: "新版已可使用，旧包清理尚未完成。请重新检查后重试，勿再次启用旧版。",
        loadFailed: "插件界面加载失败，请在插件管理中核对启用状态。配置和任务未删除。",
        retry: "重新检查"
      },
      en: {
        title: "Legacy plugin migration",
        checking: "Checking installed plugins…",
        conflict: "metaontic-video and dsh-metaontic-video are both enabled. Updating or restarting does not remove the old package.",
        retained: "The new plugin is ready. Remove the disabled old package to avoid enabling it again.",
        ready: "Migration complete. The old package was removed; the new plugin is retained.",
        action: "Switch and remove old package",
        cleanup: "Remove old package",
        switchOnly: "Disable old plugin and switch only",
        working: "Working…",
        consent: "All video tasks have finished. I agree to disable and uninstall metaontic-video.",
        preserved: "Settings, API credentials, task history and assets are retained. Only the old installation package is removed.",
        failed: "Migration was not completed. Check again. Settings will not be deleted and no reinstall is attempted.",
        blocked: "Installation state could not be verified. Check again before cleanup.",
        timeout: "Installation check timed out. Check again; no disable or uninstall will follow a late response.",
        restart: "Harness requires a restart. Save your work, restart and return here to finish cleanup.",
        stop: "The new plugin is ready and the old plugin is disabled. Harness requires the running profile to stop before uninstalling. Finish removal in plugin management; keep settings and task directories.",
        manual: "The new plugin is ready. Use plugin management to uninstall metaontic-video; this Host cannot remove it here.",
        cleanupFailed: "The new plugin is ready, but cleanup is incomplete. Check and retry; do not enable the old package again.",
        loadFailed: "The plugin UI could not load. Check enabled plugins; settings and tasks are preserved.",
        retry: "Check again"
      }
    }), "video: migration messages");
    const t = ctx.locale.bind(ns), h = React.createElement;
    let activated = false;
    const check = () => {
      if (!alive) return Promise.resolve();
      if (checking) return checking;
      if (running) return running;
      set("checking");
      checking = (async () => {
        try {
          const rows = await readBundleInventory(manager, inventory);
          if (!alive) return;
          if (hasLegacyBundleConflict(rows)) {
            set("conflict");
            return;
          }
          set(hasLegacyBundle(rows) ? "retained" : "ready");
          return activate();
        } catch (error) {
          if (alive) set(error instanceof BundleInventoryError && error.code === "timeout" ? "timeout" : "blocked");
        }
      })().finally(() => {
        checking = null;
      });
      return checking;
    };
    const start = (cleanup) => {
      if (!alive || cleanup && !confirmed) return Promise.resolve();
      if (running) return running;
      set("working");
      running = (async () => {
        try {
          const result = await disableLegacyBundle(manager, inventory);
          if (!alive) return;
          if (result === "restart-required") {
            set("restart");
            return;
          }
          if (cleanup) {
            const outcome = await cleanupLegacyBundle(manager, inventory);
            if (!alive) return;
            set(outcome === "ready" ? "ready" : outcome === "stop-profile" ? "stop" : outcome === "restart-required" ? "restart" : outcome === "manual" ? "manual" : "cleanupFailed");
          } else {
            const rows = await readBundleInventory(manager, inventory);
            set(hasLegacyBundle(rows) ? "retained" : "ready");
          }
          return activate();
        } catch (error) {
          if (!alive) return;
          if (error instanceof BundleInventoryError && error.code === "timeout") {
            set("timeout");
            return;
          }
          try {
            const rows = await readBundleInventory(manager, inventory);
            if (!hasLegacyBundleConflict(rows)) {
              set("cleanupFailed");
              return activate();
            }
          } catch {
          }
          set("failed");
        }
      })().finally(() => {
        running = null;
      });
      return running;
    };
    function Notice() {
      const snapshot = React.useSyncExternalStore((listener) => {
        listeners.add(listener);
        return () => listeners.delete(listener);
      }, () => `${status}:${confirmed}`, () => `${status}:${confirmed}`);
      const state = snapshot.split(":")[0];
      if (state === "ready") return null;
      const cleanupAllowed = ["conflict", "retained", "failed", "cleanupFailed"].includes(state);
      return h(
        "section",
        { style: { padding: 20, maxWidth: 680 }, "data-metaontic-migration": state },
        h("h3", null, t("title")),
        h("p", { role: ["failed", "blocked", "timeout", "cleanupFailed"].includes(state) ? "alert" : "status" }, t(state)),
        h("p", null, t("preserved")),
        cleanupAllowed ? h("label", null, h("input", { type: "checkbox", checked: confirmed, "data-migration-consent": true, onChange: (event) => {
          confirmed = event.target.checked === true;
          notify();
        } }), t("consent")) : null,
        cleanupAllowed ? h("button", { type: "button", disabled: !confirmed, "data-migration-action": "cleanup", onClick: () => start(true) }, t(state === "conflict" ? "action" : "cleanup")) : null,
        state === "conflict" || state === "failed" ? h("button", { type: "button", "data-migration-action": "switch", onClick: () => start(false) }, t("switchOnly")) : null,
        state !== "working" && state !== "checking" ? h("button", { type: "button", "data-migration-action": "check", onClick: () => running || check() }, t("retry")) : null
      );
    }
    const registerPage = () => ctx.effect(() => ctx.slots.inject("plugins.bundle.config", () => ctx.slots.register({ name: "plugins.bundle.config", key: PLUGIN_PACKAGE, locale: ns }, Notice)), "video: migration settings");
    let off = registerPage();
    function activate() {
      if (!alive || activated) return;
      activated = true;
      if (typeof off === "function") off();
      try {
        return mount((Page) => (props) => h("div", null, h(Notice), h(Page, props)));
      } catch {
        activated = false;
        off = registerPage();
        set("loadFailed");
      }
    }
    return check();
  }

  // src/client.ts
  window.__ModuleLoader__.load({
    id: PLUGIN_PACKAGE,
    factory: (require2) => {
      const runtime = createClientRuntime(require2, [{ id: "video", create: createVideoClient }]);
      return { ...runtime, apply: (ctx) => mountBundleAwareClient(ctx, require2("react"), (decorateSettings) => runtime.apply(ctx, { decorateSettings })) };
    }
  });
})();
